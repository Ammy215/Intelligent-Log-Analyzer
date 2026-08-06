"""FastAPI application entry point with middleware, lifespan, and router registration.

This is the main application that orchestrates:
- MongoDB async connection/disconnection via lifespan
- CORS middleware for dashboard communication
- All routers organized by domain
- Automatic Swagger UI at /docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import DatabaseManager, create_indexes
from routers import logs, analysis, incidents, reports

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
        logger.info("✓ Application ready")
    except Exception as e:
        logger.error(f"✗ Startup failed: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down...")
    await DatabaseManager.disconnect()
    logger.info("✓ Shutdown complete")


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
app.include_router(logs.router)
app.include_router(analysis.router)
app.include_router(incidents.router)
app.include_router(reports.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
    )
