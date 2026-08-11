"""Shared, connection-pooled httpx client for all outbound calls this backend
makes (Supabase, Upstash, threat intel providers, Razorpay, Resend).

httpx's own docs recommend reusing one client instance across requests
instead of opening a fresh one per call — every outbound module here was
doing the latter, meaning every authenticated request paid a fresh TCP+TLS
handshake to Supabase REST, plus another to Upstash for rate limiting,
compounding into real latency on every screen. This client keeps connections
alive and pooled instead.
"""
import httpx

client = httpx.AsyncClient(timeout=10)
