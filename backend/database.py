"""Database connection and collection access using Motor async driver.

Motor provides asynchronous MongoDB operations without blocking the event loop.
All database operations are non-blocking and ready for high-concurrency scenarios.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import settings


class DatabaseManager:
    """Manages async MongoDB connection via Motor."""

    _client: AsyncIOMotorClient | None = None
    _db: AsyncIOMotorDatabase | None = None

    @classmethod
    async def connect(cls) -> None:
        """Establish async connection to MongoDB."""
        cls._client = AsyncIOMotorClient(settings.mongodb_uri)
        cls._db = cls._client[settings.database_name]
        print(f"Connected to MongoDB: {settings.database_name}")

    @classmethod
    async def disconnect(cls) -> None:
        """Close async MongoDB connection."""
        if cls._client is not None:
            cls._client.close()
            print("Disconnected from MongoDB")

    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """Get database instance. Call after connect()."""
        if cls._db is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return cls._db

    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        """Get MongoDB client instance."""
        if cls._client is None:
            raise RuntimeError("Database client not initialized. Call connect() first.")
        return cls._client


# Collection getter functions for convenience
async def get_logs_collection():
    """Get logs collection."""
    db = DatabaseManager.get_db()
    return db["logs"]


async def get_threat_actors_collection():
    """Get threat_actors collection."""
    db = DatabaseManager.get_db()
    return db["threat_actors"]


async def get_incidents_collection():
    """Get incidents collection."""
    db = DatabaseManager.get_db()
    return db["incidents"]


async def get_reports_collection():
    """Get reports collection."""
    db = DatabaseManager.get_db()
    return db["reports"]


async def create_indexes() -> None:
    """Create necessary database indexes for performance."""
    db = DatabaseManager.get_db()

    # Logs collection indexes
    logs = db["logs"]
    await logs.create_index("timestamp")
    await logs.create_index("source_ip")
    await logs.create_index("destination_ip")
    await logs.create_index("severity")
    await logs.create_index("event_type")
    await logs.create_index([("source_ip", 1), ("timestamp", -1)])  # Compound index

    # Threat actors collection indexes
    threat_actors = db["threat_actors"]
    await threat_actors.create_index("ip", unique=True)
    await threat_actors.create_index("last_seen")

    # Incidents collection indexes
    incidents = db["incidents"]
    await incidents.create_index("severity")
    await incidents.create_index("status")
    await incidents.create_index("created_at")

    print("Database indexes created")
