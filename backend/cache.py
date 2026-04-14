import sqlite3
import json
from typing import Any, Optional

_conn = sqlite3.connect(":memory:", check_same_thread=False)
_conn.execute("CREATE TABLE cache (key TEXT PRIMARY KEY, value TEXT)")
_conn.commit()

def get(key: str) -> Optional[Any]:
    row = _conn.execute("SELECT value FROM cache WHERE key=?", (key,)).fetchone()
    return json.loads(row[0]) if row else None

def set(key: str, value: Any) -> None:
    _conn.execute("INSERT OR REPLACE INTO cache VALUES (?,?)", (key, json.dumps(value)))
    _conn.commit()
