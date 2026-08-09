"""Log management endpoints for uploading, ingesting, and retrieving logs.

This router handles:
- POST /logs/upload - Upload raw log files
- POST /logs/ingest - Ingest single JSON log entry
- GET /logs - Paginated log retrieval with filtering
- GET /logs/{id} - Single log entry
- DELETE /logs/{id} - Delete log entry
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, UploadFile, Query, HTTPException
from bson import ObjectId

from database import get_logs_collection
from models.log_entry import LogEntry
from parsers.ssh_parser import SSHParser

router = APIRouter(prefix="/api/v1/logs", tags=["logs"])
ssh_parser = SSHParser()


@router.post("/upload")
async def upload_log_file(file: UploadFile = File(...)) -> dict:
    """Upload a raw log file for parsing.

    Supports .log, .txt, and other text-based log files.
    Attempts to detect format and parse accordingly.

    Args:
        file: Upload file containing raw logs

    Returns:
        Dictionary with upload results and parsed count
    """
    try:
        from analyzers.threat_scorer import calculate_threat_score
        
        contents = await file.read()
        text = contents.decode("utf-8")
        lines = text.strip().split("\n")

        # For Phase 1, use SSH parser as default
        # In Phase 2, implement format detection logic
        parsed_logs = ssh_parser.parse_batch(lines)

        if not parsed_logs:
            return {
                "status": "warning",
                "message": "File uploaded but no logs could be parsed",
                "total_lines": len(lines),
                "parsed_count": 0,
            }

        # Calculate threat scores for each log before insertion
        for log in parsed_logs:
            if log.tags:
                threat_result = calculate_threat_score(log.tags)
                log.threat_score = threat_result['score']
                if not log.severity or log.severity == "LOW":
                    log.severity = threat_result['severity']

        # Insert parsed logs into MongoDB
        logs_collection = await get_logs_collection()
        insert_result = await logs_collection.insert_many(
            [log.model_dump(by_alias=True, exclude_none=True) for log in parsed_logs]
        )

        return {
            "status": "success",
            "message": f"Successfully parsed and stored logs",
            "total_lines": len(lines),
            "parsed_count": len(parsed_logs),
            "inserted_ids": [str(id) for id in insert_result.inserted_ids],
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File processing error: {str(e)}")


@router.post("/ingest")
async def ingest_single_log(log_entry: LogEntry) -> dict:
    """Ingest a single structured log entry as JSON.

    Args:
        log_entry: Pydantic LogEntry model from request body

    Returns:
        Dictionary with insert result and ID
    """
    try:
        from analyzers.threat_scorer import calculate_threat_score
        
        logs_collection = await get_logs_collection()

        # Calculate threat score if tags are present
        if log_entry.tags:
            threat_result = calculate_threat_score(log_entry.tags)
            log_entry.threat_score = threat_result['score']
            if not log_entry.severity or log_entry.severity == "LOW":
                log_entry.severity = threat_result['severity']

        # Convert to dict for insertion
        log_dict = log_entry.model_dump(by_alias=True, exclude_none=True)

        result = await logs_collection.insert_one(log_dict)

        return {
            "status": "success",
            "message": "Log entry ingested successfully",
            "id": str(result.inserted_id),
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ingest error: {str(e)}")


@router.get("/")
async def get_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    source_ip: Optional[str] = None,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    """Retrieve paginated logs with optional filtering.

    Args:
        page: Page number (1-indexed)
        limit: Items per page (1-500)
        source_ip: Filter by source IP
        severity: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
        event_type: Filter by event type
        start_date: Filter start date (ISO format)
        end_date: Filter end date (ISO format)

    Returns:
        Dictionary with paginated logs and metadata
    """
    try:
        logs_collection = await get_logs_collection()

        # Build filter query
        filters = {}
        if source_ip:
            filters["source_ip"] = source_ip
        if severity:
            filters["severity"] = severity
        if event_type:
            filters["event_type"] = event_type

        # Date range filtering
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = datetime.fromisoformat(start_date)
            if end_date:
                date_filter["$lte"] = datetime.fromisoformat(end_date)
            if date_filter:
                filters["timestamp"] = date_filter

        # Count total matching documents
        total_count = await logs_collection.count_documents(filters)

        # Calculate skip for pagination
        skip = (page - 1) * limit

        # Query with sorting
        cursor = (
            logs_collection.find(filters)
            .sort("timestamp", -1)  # Sort by timestamp descending
            .skip(skip)
            .limit(limit)
        )

        logs = await cursor.to_list(length=limit)

        # Convert ObjectId to string for JSON serialization
        for log in logs:
            if "_id" in log:
                log["_id"] = str(log["_id"])

        return {
            "status": "success",
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "returned_count": len(logs),
            "total_pages": (total_count + limit - 1) // limit,
            "data": logs,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query error: {str(e)}")


@router.get("/{log_id}")
async def get_log_by_id(log_id: str) -> dict:
    """Get a single log entry by ID.

    Args:
        log_id: MongoDB ObjectId as string

    Returns:
        Dictionary with log data
    """
    try:
        logs_collection = await get_logs_collection()

        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(log_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid log ID format")

        log = await logs_collection.find_one({"_id": obj_id})

        if not log:
            raise HTTPException(status_code=404, detail="Log not found")

        # Convert ObjectId to string
        log["_id"] = str(log["_id"])

        return {
            "status": "success",
            "data": log,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query error: {str(e)}")


@router.delete("/{log_id}")
async def delete_log(log_id: str) -> dict:
    """Delete a single log entry by ID.

    Args:
        log_id: MongoDB ObjectId as string

    Returns:
        Dictionary with deletion result
    """
    try:
        logs_collection = await get_logs_collection()

        try:
            obj_id = ObjectId(log_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid log ID format")

        result = await logs_collection.delete_one({"_id": obj_id})

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Log not found")

        return {
            "status": "success",
            "message": "Log entry deleted",
            "deleted_count": result.deleted_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Delete error: {str(e)}")
