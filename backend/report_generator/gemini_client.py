"""Google Gemini SDK integration for every AI-generated report in the app.

This is now the only AI client. It previously coexisted with an
aiohttp/OpenAI client (ai_client.py) that powered the executive-summary
and remediation endpoints — but that client silently returned hardcoded
mock text whenever OPENAI_API_KEY was unset or left at its placeholder,
which is exactly what shipped: the executive summary confidently reported
"SAFE, 0 events" for IPs the platform itself scored CRITICAL. Serving
fabricated security findings as if they were real analysis is worse than
serving an error, so that client is gone and every path here fails loudly
instead of inventing content.

Direct SDK call, no LangChain — one prompt in, one response out, no agent
chains needed.
"""
import logging
from typing import Optional

from google import genai
from google.genai.errors import APIError

from config import settings

logger = logging.getLogger(__name__)


class GeminiError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(f"Gemini error: {detail}")


_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _build_incident_prompt(incident: dict) -> str:
    attack_chain = incident.get("attack_chain") or []
    return f"""You are a professional cybersecurity analyst. Generate a DETAILED INCIDENT REPORT based on this real incident data from our security monitoring system:

Incident: {incident.get('title', 'Security Incident')}
Description: {incident.get('description', 'N/A')}
Severity: {incident.get('severity', 'UNKNOWN')}
Status: {incident.get('status', 'open')}
Total Events: {incident.get('total_events', 0)}
Source IPs: {', '.join(incident.get('source_ips', []))}
Attack/Event Types: {', '.join(incident.get('event_types', []))}
Attack Chain: {' -> '.join(str(s) for s in attack_chain) if attack_chain else 'N/A'}

Format the report with these sections:
1. Incident Overview
2. Attack Timeline / Chain Analysis
3. Impact Assessment
4. Root Cause Analysis
5. Recommended Remediation
6. Prevention Measures

Base every claim strictly on the data provided above — do not invent
details, IPs, or timestamps not present in the data. Keep it professional
and suitable for stakeholder communication."""


def _is_capacity_error(exc: APIError) -> bool:
    """True for 'this model can't serve you right now' — as opposed to a bad
    request, a bad key, or a missing model, none of which another model
    would fix. 503 UNAVAILABLE is the sustained high-demand case that took
    every report endpoint down; 429 RESOURCE_EXHAUSTED is per-model quota.
    Only these are worth retrying elsewhere.
    """
    code = getattr(exc, "code", None)
    if code in (429, 503):
        return True
    text = str(exc).upper()
    return "UNAVAILABLE" in text or "RESOURCE_EXHAUSTED" in text


def _model_chain() -> list[str]:
    """Primary model, then the fallback if one is configured and distinct."""
    chain = [settings.gemini_model]
    fallback = (settings.gemini_fallback_model or "").strip()
    if fallback and fallback not in chain:
        chain.append(fallback)
    return chain


async def _generate(prompt: str) -> str:
    """Single call path for every report type.

    Tries the primary model, and on a capacity failure only (503/429) falls
    back to the secondary. Raises GeminiError on any other failure, and when
    every model in the chain is exhausted — never returns placeholder text,
    so callers must not deduct a credit or present output as analysis unless
    this returns successfully.
    """
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured")

    client = _get_client()
    chain = _model_chain()
    last_capacity_error: str | None = None

    for index, model in enumerate(chain):
        is_last = index == len(chain) - 1
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
            )
        except APIError as e:
            if _is_capacity_error(e) and not is_last:
                logger.warning(
                    f"Gemini model {model!r} unavailable ({getattr(e, 'code', '?')}), "
                    f"falling back to {chain[index + 1]!r}"
                )
                last_capacity_error = str(e)
                continue
            logger.error(f"Gemini API error on {model!r}: {e}")
            raise GeminiError(
                f"{e} (after trying {', '.join(chain[:index + 1])})"
                if last_capacity_error
                else str(e)
            )
        except Exception as e:
            logger.error(f"Gemini request failed on {model!r}: {e}")
            raise GeminiError(str(e))

        text = getattr(response, "text", None)
        if not text:
            raise GeminiError(f"Gemini model {model!r} returned an empty response")
        if index > 0:
            logger.info(f"Gemini report served by fallback model {model!r}")
        return text

    raise GeminiError(last_capacity_error or "No Gemini model available")


async def generate_incident_report(incident: dict) -> str:
    """Generate a narrative incident report from real incident data."""
    return await _generate(_build_incident_prompt(incident))


def _build_executive_prompt(threat_profile: dict, observed: dict) -> str:
    """Build the executive-summary prompt.

    `observed` carries what this org's own logs actually recorded for the IP
    (verdict, severity breakdown, stored threat scores, event types) and is
    the headline risk signal — NOT the profiler's composite score.

    That distinction matters and was the source of a real bug: the composite
    is derived from tag-based threat factors, and ingested events frequently
    carry no tags at all, so the composite collapses to ~3/100 "SAFE" for an
    IP whose own stored events include 13 CRITICAL entries topping out at
    99/100. The rest of the app (/analysis/ip, the UI) reports the verdict
    from the stored scores, so the summary uses the same source of truth
    rather than confidently contradicting every other screen.
    """
    ti = threat_profile.get("threat_intelligence") or {}
    local = threat_profile.get("local_analysis") or {}
    risk_factors = threat_profile.get("risk_factors") or ti.get("risk_factors") or []
    sev = observed.get("severity_breakdown") or {}
    sev_line = ", ".join(f"{k}: {v}" for k, v in sev.items()) if sev else "none recorded"

    return f"""You are a professional cybersecurity analyst. Write a 2-3 paragraph EXECUTIVE SUMMARY for security leadership, based strictly on this real data from our monitoring system:

IP Address: {threat_profile.get('ip')}

PRIMARY ASSESSMENT (from this organisation's own logged events — treat this
as the authoritative risk signal):
  Verdict: {observed.get('verdict', 'UNKNOWN')}
  Events observed from this IP: {observed.get('total_events', 0)}
  Highest event threat score: {observed.get('max_threat_score', 0)}/100
  Average event threat score: {observed.get('avg_threat_score', 0)}/100
  Severity breakdown: {sev_line}
  Event types seen: {', '.join(observed.get('event_types') or []) or 'none recorded'}

SUPPLEMENTARY CONTEXT (external reputation/enrichment — may be sparse or
unavailable, and a low score here does NOT override the verdict above):
  Composite enrichment score: {threat_profile.get('composite_score', 0)}/100
  Enrichment confidence: {threat_profile.get('confidence', 0)}%
  Tag-derived threat factors: {', '.join(local.get('threat_factors') or []) or 'none recorded'}
  AbuseIPDB: {threat_profile.get('abuseipdb')}
  OTX: {threat_profile.get('otx')}
  Geolocation: {threat_profile.get('geolocation')}
  Noted risk factors:
{chr(10).join('    - ' + str(f) for f in risk_factors) if risk_factors else '    - none recorded'}

Base every statement strictly on the figures above — do not invent event
counts, dates, or findings. Lead with the PRIMARY ASSESSMENT verdict and do
not soften it because the supplementary enrichment score is low; sparse
external data means unknown, not safe. If a data source is unavailable, say
so. Close with concrete recommended actions proportionate to the verdict."""


async def generate_executive_summary(threat_profile: dict, observed: dict) -> str:
    """Generate an executive summary from a real IP threat profile plus the
    org's own observed event data (see _build_executive_prompt)."""
    return await _generate(_build_executive_prompt(threat_profile, observed))


def _build_remediation_prompt(threat_factors: list, risk_level: str) -> str:
    return f"""You are a professional cybersecurity analyst. Produce a prioritised REMEDIATION ACTION PLAN.

Risk Level: {risk_level}
Identified threat factors:
{chr(10).join('  - ' + str(f) for f in threat_factors) if threat_factors else '  - none supplied'}

Group actions under:
1. CRITICAL (within 24 hours)
2. HIGH (within 1 week)
3. MEDIUM (within 1 month)

For each action give: what to do, why it matters, how to verify completion,
and what resources are needed. Base the plan strictly on the threat factors
and risk level given above — do not invent findings that were not supplied."""


async def generate_remediation_plan(threat_factors: list, risk_level: str) -> str:
    """Generate a remediation plan from supplied threat factors."""
    return await _generate(_build_remediation_prompt(threat_factors, risk_level))
