#!/usr/bin/env python3
"""
Production Log Analyzer Startup Script
======================================

This script starts the production-grade log analysis system with:
- Real log file processing
- Automatic threat detection
- Incident creation
- MongoDB integration

Requirements:
- MongoDB running on localhost:27017
- Python dependencies installed

Usage:
    python start_production.py

The system will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
"""

import uvicorn
import sys
import os

def main():
    print("🚀 Starting Intelligent Log Analyzer - Production System")
    print("=" * 60)
    print("Features:")
    print("  ✓ Real log file upload and processing")
    print("  ✓ SSH & Apache log format detection")  
    print("  ✓ Automatic threat scoring and severity assessment")
    print("  ✓ Attack pattern detection (brute force, SQL injection, etc.)")
    print("  ✓ Automatic incident creation for attack campaigns")
    print("  ✓ Background threat monitoring every 5 minutes")
    print("  ✓ MongoDB integration for real data storage")
    print("=" * 60)
    
    print("\n📋 Pre-flight checks:")
    
    # Check if MongoDB is expected to be running
    print("  - MongoDB: Expected at mongodb://localhost:27017")
    print("    (The system will connect on startup)")
    
    print("\n🌐 Service URLs:")
    print("  - API Server: http://localhost:8000")
    print("  - API Documentation: http://localhost:8000/docs")
    print("  - Health Check: http://localhost:8000/health")
    print("  - Frontend: http://localhost:5173 (run separately)")
    
    print("\n📁 To test the system:")
    print("  1. Upload real log files via POST /api/v1/logs/upload")
    print("  2. View processed data at GET /api/v1/analysis/summary")
    print("  3. Check incidents at GET /api/v1/incidents")
    print("  4. Monitor logs at GET /api/v1/logs")
    
    print("\n🚀 Starting server...")
    print("-" * 60)
    
    try:
        # Start the production server
        uvicorn.run(
            "production_main:app",
            host="0.0.0.0", 
            port=8000,
            reload=False,  # Disable reload in production
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down gracefully...")
        print("Production system stopped.")
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()