import sqlite3
from pathlib import Path

# Locate the backend directory
BASE_DIR = Path(__file__).resolve().parent

# Store our database inside the backend folder
DATABASE_PATH = BASE_DIR / "campusbridge.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)

    # Return database rows in dictionary-like form
    connection.row_factory = sqlite3.Row

    return connection