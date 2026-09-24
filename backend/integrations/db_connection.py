# db_connection.py
import os

from pymongo import MongoClient


def get_collection():
    """Collection the ingest pipeline inserts leads into. Configure via the
    repo-root .env; defaults point at a local MongoDB."""
    client = MongoClient(os.environ.get("MONGODB_URI", "mongodb://localhost:27017/"))
    db = client[os.environ.get("MONGODB_DB", "bench_outreach")]
    return db[os.environ.get("MONGODB_COLLECTION", "consultants")]
