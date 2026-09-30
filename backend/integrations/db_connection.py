import os

from pymongo import MongoClient
from pymongo.collection import Collection


def get_consultants_collection() -> Collection:
    """The collection uploads are inserted into and the read models count from.
    Configured by MONGODB_URI / MONGODB_DB / MONGODB_COLLECTION."""
    client = MongoClient(os.environ.get("MONGODB_URI", "mongodb://localhost:27017/"))
    return client[os.environ.get("MONGODB_DB", "bench_outreach")][os.environ.get("MONGODB_COLLECTION", "consultants")]
