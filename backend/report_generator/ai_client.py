"""OpenAI GPT-4o-mini integration for AI report generation.

Provides async interface to OpenAI API for generating security reports,
incident summaries, and threat analysis narratives.

Learning: LLM API integration, streaming responses, token counting, error handling.
"""
import asyncio
import aiohttp
import logging
from typing import Optional, Dict, AsyncGenerator

from config import settings


logger = logging.getLogger(__name__)


class AIReportClient:
    """Async client for OpenAI GPT-4o-mini report generation.
    
    Uses GPT-4o-mini (affordable, fast model) for:
    - Executive summaries
    - Incident narratives
    - Threat assessment reports
    - Remediation recommendations
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize OpenAI client.
        
        Args:
            api_key: OpenAI API key from environment or parameter
        
        Learning: Configuration management with environment variables
        """
        self.api_key = api_key or settings.openai_api_key
        self.model = settings.openai_model  # "gpt-4o-mini"
        self.base_url = "https://api.openai.com/v1"
        self.max_tokens = settings.max_tokens  # 2000
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def generate_executive_summary(
        self,
        threat_profile: Dict,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate executive summary for threat profile.
        
        Args:
            threat_profile: Threat profile dict from IP profiler
            max_tokens: Override default token limit
            
        Returns:
            Generated executive summary text
            
        Learning: Prompt engineering for specific output formats
        """
        if not self.api_key or self.api_key == "your_key_here":
            logger.info("OpenAI API key not configured, returning mock summary")
            return self._mock_executive_summary(threat_profile)

        prompt = f"""
Analyze this threat profile and generate a 2-3 paragraph EXECUTIVE SUMMARY for a security team:

IP Address: {threat_profile.get('ip')}
Risk Level: {threat_profile.get('risk_level', 'UNKNOWN')}
Composite Score: {threat_profile.get('composite_score', 0)}/100
Local Events: {threat_profile.get('total_events', 0)}
Confidence: {threat_profile.get('threat_intelligence', {}).get('confidence', 0)}%

Risk Factors:
{chr(10).join('- ' + f for f in threat_profile.get('threat_intelligence', {}).get('risk_factors', []))}

Local Analysis: {threat_profile.get('threat_intelligence', {}).get('local_analysis', {})}
AbuseIPDB: {threat_profile.get('threat_intelligence', {}).get('abuseipdb', {})}

Generate a concise, actionable executive summary appropriate for security leadership.
"""
        
        return await self._call_openai(prompt, max_tokens or self.max_tokens)

    async def generate_incident_report(
        self,
        incident_data: Dict,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate detailed incident report from incident data.
        
        Args:
            incident_data: Incident dict with attack details
            max_tokens: Override default token limit
            
        Returns:
            Generated incident report
            
        Learning: Converting structured data to narrative report
        """
        if not self.api_key or self.api_key == "your_key_here":
            logger.info("OpenAI API key not configured, returning mock report")
            return self._mock_incident_report(incident_data)

        prompt = f"""
Generate a DETAILED INCIDENT REPORT based on this incident data:

Incident: {incident_data.get('title', 'Security Incident')}
Description: {incident_data.get('description', 'N/A')}
Severity: {incident_data.get('severity', 'UNKNOWN')}
Status: {incident_data.get('status', 'OPEN')}

Source IPs: {', '.join(incident_data.get('source_ips', []))}
Attack Types: {', '.join(incident_data.get('event_types', []))}

Format the report with:
1. Incident Overview
2. Attack Timeline
3. Impact Assessment
4. Root Cause Analysis
5. Immediate Actions Taken
6. Recommended Remediation
7. Prevention Measures

Keep it professional and suitable for stakeholder communication.
"""
        
        return await self._call_openai(prompt, max_tokens or self.max_tokens)

    async def generate_remediation_plan(
        self,
        threat_factors: list,
        risk_level: str,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate remediation recommendations.
        
        Args:
            threat_factors: List of threat factors (e.g., ['brute_force', 'malware'])
            risk_level: Risk level (SAFE, SUSPICIOUS, HIGH_RISK, CRITICAL)
            max_tokens: Override default token limit
            
        Returns:
            Generated remediation plan
            
        Learning: Context-aware prompt generation
        """
        if not self.api_key or self.api_key == "your_key_here":
            logger.info("OpenAI API key not configured, returning mock plan")
            return self._mock_remediation_plan(threat_factors, risk_level)

        prompt = f"""
Based on these threat factors, generate a REMEDIATION ACTION PLAN:

Risk Level: {risk_level}
Threat Factors:
{chr(10).join('- ' + factor for factor in threat_factors)}

Provide prioritized recommendations including:
1. CRITICAL (immediate, within 24 hours)
2. HIGH (within 1 week)
3. MEDIUM (within 1 month)

For each action, include:
- What to do
- Why it matters
- How to verify completion
- Resources needed

Make recommendations specific and actionable.
"""
        
        return await self._call_openai(prompt, max_tokens or self.max_tokens)

    async def _call_openai(self, prompt: str, max_tokens: int) -> str:
        """Make async call to OpenAI API.
        
        Args:
            prompt: System prompt for the model
            max_tokens: Maximum tokens in response
            
        Returns:
            Generated text response
            
        Learning: Async HTTP with aiohttp, error handling, token limits
        """
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a professional cybersecurity analyst and report writer. Generate clear, concise, actionable security reports."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.7,  # Balanced: not too random, not too robotic
                "max_tokens": max_tokens,
                "top_p": 0.9
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Extract generated text
                        if data.get("choices") and len(data["choices"]) > 0:
                            return data["choices"][0]["message"]["content"]
                        else:
                            logger.warning("No choices in OpenAI response")
                            return "Error: No response generated"
                    
                    elif response.status == 401:
                        logger.error("OpenAI authentication failed - invalid API key")
                        return "Error: Authentication failed. Check your OpenAI API key."
                    
                    elif response.status == 429:
                        logger.warning("OpenAI rate limit exceeded")
                        return "Error: Rate limit exceeded. Try again in a moment."
                    
                    else:
                        error_text = await response.text()
                        logger.error(f"OpenAI API error {response.status}: {error_text}")
                        return f"Error: API returned status {response.status}"

        except asyncio.TimeoutError:
            logger.error("OpenAI API request timeout")
            return "Error: Request timed out"
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            return f"Error: {str(e)}"

    def _mock_executive_summary(self, threat_profile: Dict) -> str:
        """Mock summary when API key not configured.
        
        Learning: Graceful degradation for demos without API key
        """
        ip = threat_profile.get("ip")
        risk = threat_profile.get("risk_level")
        score = threat_profile.get("composite_score", 0)
        events = threat_profile.get("total_events", 0)

        return f"""
EXECUTIVE SUMMARY: IP {ip}

Risk Assessment:
The IP address {ip} has been assigned a {risk} risk rating with a composite threat score of {score}/100. This assessment is based on {events} detected security events in our logs, combined with external threat intelligence data.

Recommended Actions:
Based on the {risk} classification, we recommend immediate investigation of this IP address. Review all connection attempts, block if necessary, and monitor for escalation.

Confidence Level: {threat_profile.get('threat_intelligence', {}).get('confidence', 'Unknown')}% confidence in this assessment.
"""

    def _mock_incident_report(self, incident_data: Dict) -> str:
        """Mock incident report when API key not configured."""
        return f"""
INCIDENT REPORT: {incident_data.get('title', 'Security Incident')}

Severity: {incident_data.get('severity')}
Status: {incident_data.get('status')}

Description:
{incident_data.get('description', 'No description provided')}

Attack Sources: {', '.join(incident_data.get('source_ips', []))}
Attack Methods: {', '.join(incident_data.get('event_types', []))}

Recommendation:
Immediately investigate and isolate affected systems. Review logs for persistence mechanisms.
"""

    def _mock_remediation_plan(self, threat_factors: list, risk_level: str) -> str:
        """Mock remediation plan when API key not configured."""
        return f"""
REMEDIATION PLAN for {risk_level} Risk

CRITICAL (24 hours):
1. Isolate affected systems if score > 80
2. Reset credentials for compromised accounts
3. Enable enhanced monitoring

HIGH (1 week):
1. Review firewall rules and update access controls
2. Scan systems for malware/backdoors
3. Patch identified vulnerabilities

MEDIUM (1 month):
1. Update incident response procedures
2. Conduct security awareness training
3. Implement additional monitoring
"""


# Global client instance
_ai_client: Optional[AIReportClient] = None


def get_ai_client(api_key: Optional[str] = None) -> AIReportClient:
    """Get or create global AI report client instance."""
    global _ai_client
    if _ai_client is None:
        _ai_client = AIReportClient(api_key)
    return _ai_client
