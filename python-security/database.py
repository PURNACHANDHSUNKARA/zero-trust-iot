"""
database.py
-----------
All PostgreSQL access for the project goes through this module.
Every query is parameterized (never string-concatenated) to prevent
SQL injection, per the project's security requirements.
"""

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

PG_CONFIG = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": os.getenv("PG_PORT", "5432"),
    "dbname": os.getenv("PG_DATABASE", "zero_trust_iot"),
    "user": os.getenv("PG_USER", "postgres"),
    "password": os.getenv("PG_PASSWORD", ""),
}


@contextmanager
def get_connection():
    """Yields a psycopg2 connection, always closed afterwards."""
    conn = psycopg2.connect(**PG_CONFIG)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_cursor(commit: bool = False):
    """Yields a dict-cursor. Commits automatically if commit=True."""
    with get_connection() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield cur
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()


DEFAULT_SCHEMA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "schema.sql")


def init_schema(schema_path: str = None):
    """Runs schema.sql against the connected database. Idempotent
    (uses CREATE TABLE IF NOT EXISTS), safe to run multiple times."""
    path = schema_path or DEFAULT_SCHEMA_PATH
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    with get_cursor(commit=True) as cur:
        cur.execute(sql)
    print("[database] schema initialized.")


# ---------------- devices ----------------

def insert_device(device_id, device_name, device_type, did, public_key,
                   blockchain_address=None, role="SENSOR", status="ACTIVE"):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO devices
                (device_id, device_name, device_type, did, public_key,
                 blockchain_address, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (device_id) DO UPDATE SET
                blockchain_address = EXCLUDED.blockchain_address,
                status = EXCLUDED.status
            RETURNING id;
            """,
            (device_id, device_name, device_type, did, public_key,
             blockchain_address, role, status),
        )
        return cur.fetchone()


def get_device(device_id):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM devices WHERE device_id = %s;", (device_id,))
        return cur.fetchone()


def list_devices():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM devices ORDER BY created_at;")
        return cur.fetchall()


def set_device_status(device_id, status):
    """status must be 'ACTIVE' or 'REVOKED'."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE devices SET status = %s WHERE device_id = %s RETURNING device_id;",
            (status, device_id),
        )
        return cur.fetchone()


# ---------------- iot_data ----------------

def insert_iot_data_row(device_id, timestamp, protocol, packet_count, bytes_,
                         connection_duration, traffic_type, label):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO iot_data
                (device_id, timestamp, protocol, packet_count, bytes,
                 connection_duration, traffic_type, label)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (device_id, timestamp, protocol, packet_count, bytes_,
             connection_duration, traffic_type, label),
        )


def insert_iot_data_batch(rows):
    """Batch insert a list of rows into iot_data in a single transaction."""
    if not rows:
        return
    with get_cursor(commit=True) as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO iot_data
                (device_id, timestamp, protocol, packet_count, bytes,
                 connection_duration, traffic_type, label)
            VALUES %s;
            """,
            rows,
        )


def get_recent_iot_data(device_id, limit=50):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT * FROM iot_data
            WHERE device_id = %s
            ORDER BY timestamp DESC
            LIMIT %s;
            """,
            (device_id, limit),
        )
        return cur.fetchall()


# ---------------- authentication_logs ----------------

def insert_auth_log(device_id, nonce, status, method="ED25519_SIGNATURE"):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO authentication_logs
                (device_id, nonce, authentication_status, authentication_method)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
            """,
            (device_id, nonce, status, method),
        )
        return cur.fetchone()


def nonce_already_used(nonce):
    """Replay protection check: has this nonce ever succeeded before?"""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM authentication_logs
            WHERE nonce = %s AND authentication_status = 'SUCCESS';
            """,
            (nonce,),
        )
        return cur.fetchone() is not None


# ---------------- access_requests ----------------

def insert_access_request(device_id, resource, action, risk_score, decision, reason):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO access_requests
                (device_id, resource, action, risk_score, decision, reason)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (device_id, resource, action, risk_score, decision, reason),
        )
        return cur.fetchone()


def list_access_requests(limit=100):
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM access_requests ORDER BY timestamp DESC LIMIT %s;",
            (limit,),
        )
        return cur.fetchall()


# ---------------- security_events ----------------

def insert_security_event(device_id, event_type, severity, description):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO security_events (device_id, event_type, severity, description)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
            """,
            (device_id, event_type, severity, description),
        )
        return cur.fetchone()


def list_security_events(limit=100):
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM security_events ORDER BY timestamp DESC LIMIT %s;",
            (limit,),
        )
        return cur.fetchall()


# ---------------- analytics helpers (used by dashboard export, Phase 18) ----------------

def get_dashboard_stats():
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM devices;")
        total_devices = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS c FROM devices WHERE status = 'ACTIVE';")
        active_devices = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) AS c FROM devices WHERE status = 'REVOKED';")
        revoked_devices = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) AS c FROM authentication_logs WHERE authentication_status = 'SUCCESS';")
        auth_success = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) AS c FROM authentication_logs WHERE authentication_status = 'FAILED';")
        auth_failed = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) AS c FROM access_requests WHERE decision = 'ALLOW';")
        access_granted = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) AS c FROM access_requests WHERE decision = 'DENY';")
        access_denied = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) AS c FROM access_requests WHERE risk_score > 60;")
        high_risk = cur.fetchone()["c"]

        return {
            "total_devices": total_devices,
            "active_devices": active_devices,
            "revoked_devices": revoked_devices,
            "auth_success": auth_success,
            "auth_failed": auth_failed,
            "access_granted": access_granted,
            "access_denied": access_denied,
            "high_risk": high_risk,
        }


if __name__ == "__main__":
    # Quick manual test: `python database.py`
    init_schema()
    print(get_dashboard_stats())
