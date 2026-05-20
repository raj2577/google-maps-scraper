import sqlite3
import os
from typing import List, Dict, Any
from datetime import datetime

DB_DIR = "data"
DB_PATH = os.path.join(DB_DIR, "search_history.db")

def init_db():
    """Initializes the SQLite database and creates the search history table if it doesn't exist."""
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR, exist_ok=True)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            max_places INTEGER,
            lang TEXT,
            concurrency INTEGER,
            headless INTEGER,
            results_count INTEGER,
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def save_search(query: str, max_places: int, lang: str, concurrency: int, headless: bool, results_count: int):
    """Saves a search configuration and its resulting item count to the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    
    # Normalize max_places for database storage
    db_max_places = max_places if max_places is not None else -1
    
    cursor.execute("""
        INSERT INTO search_history (query, max_places, lang, concurrency, headless, results_count, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (query, db_max_places, lang, concurrency, 1 if headless else 0, results_count, timestamp))
    conn.commit()
    conn.close()

def get_history(limit: int = 10) -> List[Dict[str, Any]]:
    """Retrieves the most recent search history items."""
    if not os.path.exists(DB_PATH):
        return []
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, query, max_places, lang, concurrency, headless, results_count, timestamp
            FROM search_history
            ORDER BY id DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        
        history = []
        for row in rows:
            max_places = row["max_places"]
            if max_places == -1:
                max_places = None
                
            history.append({
                "id": row["id"],
                "query": row["query"],
                "max_places": max_places,
                "lang": row["lang"],
                "concurrency": row["concurrency"],
                "headless": bool(row["headless"]),
                "results_count": row["results_count"],
                "timestamp": row["timestamp"]
            })
        return history
    except sqlite3.OperationalError:
        # Table might not exist yet
        return []
    finally:
        conn.close()

def delete_history_item(item_id: int):
    """Deletes a specific history record by ID."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM search_history WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

def clear_all_history():
    """Clears all history records from the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM search_history")
    conn.commit()
    conn.close()
