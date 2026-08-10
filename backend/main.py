"""FastAPI application entry point with middleware, lifespan, and router registration.

This is the main application that orchestrates:
- MongoDB async connection/disconnection via lifespan
- CORS middleware for dashboard communication
- All routers organized by domain
- Automatic Swagger UI at /docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import DatabaseManager, create_indexes
from middleware.rate_limit import global_rate_limit
from routers import logs, analysis, incidents, reports, auth, billing, admin

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


# Create FastAPI app with lifespan
app = FastAPI(
    title="Intelligent Log Analyzer API",
    description="Production cybersecurity log analysis platform",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware for dashboard communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global rate limit — 200/15min per IP, the ceiling behind every more
# specific per-category limit (auth/ingest/AI analyst) applied at the
# router level. Scoped to /api/v1 only — /docs, /openapi.json, and /health
# stay unlimited (dev tooling and uptime checks, not attacker-reachable
# expensive operations).
@app.middleware("http")
async def _global_rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/v1"):
        try:
            await global_rate_limit(request)
        except HTTPException as e:
            return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    return await call_next(request)


# Root endpoint
@app.get("/")
async def root() -> dict:
    """Root endpoint with API information."""
    return {
        "name": "Intelligent Log Analyzer API",
        "version": "1.0.0",
        "docs": "/docs",
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
    )
