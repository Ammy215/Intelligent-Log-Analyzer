"""FastAPI application entry point with middleware, lifespan, and router registration.

This is the main application that orchestrates:
- MongoDB async connection/disconnection via lifespan
- CORS middleware for dashboard communication
- All routers organized by domain
- Automatic Swagger UI at /docs (dev only — off when ENVIRONMENT=production)
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import DatabaseManager, create_indexes
from middleware.rate_limit import global_rate_limit
from routers import logs, analysis, incidents, reports, auth, billing, admin, superadmin

# Configure logging
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: startup and shutdown.

    Startup:
    - Connect to MongoDB
    - Create database indexes

    Shutdown:
    - Disconnect from MongoDB
    """
    # Startup
    logger.info("Starting Intelligent Log Analyzer...")
    try:
        await DatabaseManager.connect()
        await create_indexes()
        logger.info("Application ready")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down...")
    await DatabaseManager.disconnect()
    logger.info("Shutdown complete")


# Interactive docs/schema are dev-only — a real deploy sets
# ENVIRONMENT=production, which disables both routes entirely (404, not
# just hidden from a nav menu).
_is_production = settings.environment.lower() == "production"

# Create FastAPI app with lifespan
app = FastAPI(
    title="Intelligent Log Analyzer API",
    description="Production cybersecurity log analysis platform",
    version="1.0.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
    lifespan=lifespan,
)

# Global rate limit — 200/15min per IP, the ceiling behind every more
# specific per-category limit (auth/ingest/AI analyst) applied at the
# router level. Scoped to /api/v1 only — /docs, /openapi.json, and /health
# stay unlimited (dev tooling and uptime checks, not attacker-reachable
# expensive operations).
#
# ORDER MATTERS, and it is the opposite of how it reads. Starlette's
# add_middleware inserts at position 0, so whatever is registered LAST runs
# OUTERMOST. This block is deliberately above the CORS registration below so
# that CORS ends up outside the limiter: a 429 raised here short-circuits
# before the route, and if CORS were inner it would never get to attach
# Access-Control-Allow-Origin. The browser then reports a rate-limited
# request as an opaque CORS failure instead of a 429, and the app looks
# broken rather than throttled. Registering CORS last also lets it answer
# preflight OPTIONS itself, so preflights no longer burn quota.
@app.middleware("http")
async def _global_rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/v1"):
        try:
            await global_rate_limit(request)
        except HTTPException as e:
            return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    return await call_next(request)


# CORS middleware for dashboard communication. Registered last on purpose —
# see the ordering note above.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root endpoint
@app.get("/")
async def root() -> dict:
    """Root endpoint with API information.

    `docs` reflects the actual state rather than always claiming "/docs":
    in production that route is disabled, and advertising a 404 as the
    documentation URL is just a wrong answer.
    """
    return {
        "name": "Intelligent Log Analyzer API",
        "version": "1.0.0",
        "environment": "production" if _is_production else "development",
        "docs": None if _is_production else "/docs",
        "health": "/health",
    }


# Health check endpoint
@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint returning application status."""
    return {
        "status": "healthy",
        "database": "connected",
    }


# Register routers
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(logs.router)
app.include_router(analysis.router)
app.include_router(incidents.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(superadmin.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
    )
