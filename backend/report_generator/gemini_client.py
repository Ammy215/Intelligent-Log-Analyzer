"""Google Gemini SDK integration for the AI Analyst's credit-metered
incident report generation.

Separate from ai_client.py (the pre-existing aiohttp/OpenAI-based client
powering the unmetered executive-summary/remediation/stats endpoints) on
purpose — this is a different SDK entirely, and keeping it in its own
module avoids mixing two unrelated HTTP transports in one class. Direct
SDK call, no LangChain (same reasoning as the OpenAI decision this
replaces: one prompt in, one response out, no agent chains needed).
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


async def generate_incident_report(incident: dict) -> str:
    """Generate a narrative incident report from real incident data via
    Gemini. Raises GeminiError on any failure — callers must not deduct a
    credit unless this returns successfully."""
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured")

    prompt = _build_incident_prompt(incident)
    client = _get_client()

    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
    except APIError as e:
        logger.error(f"Gemini API error: {e}")
        raise GeminiError(str(e))
    except Exception as e:
        logger.error(f"Gemini request failed: {e}")
        raise GeminiError(str(e))

    text = getattr(response, "text", None)
    if not text:
        raise GeminiError("Gemini returned an empty response")
    return text
