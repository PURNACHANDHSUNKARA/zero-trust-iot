"""
dataset_analysis.py
---------------------
Computes statistics and flags abnormal behavior from the iot_data table.
This is the bridge between raw dataset rows and the risk_engine, which
consumes the per-device summary this module produces.

Mapping (dataset -> project pipeline):
    iot_data rows (packet_count, bytes, traffic_type, label, ...)
        -> per-device behavior summary (this file)
            -> risk_engine.py (turns behavior summary into a risk score)
                -> zero_trust.py (turns risk score into ALLOW/DENY)
"""

import pandas as pd
import database


def load_iot_data_as_df() -> pd.DataFrame:
    with database.get_cursor() as cur:
        cur.execute("SELECT * FROM iot_data;")
        rows = cur.fetchall()
    return pd.DataFrame(rows)


def overall_statistics(df: pd.DataFrame = None) -> dict:
    if df is None:
        df = load_iot_data_as_df()
    if df.empty:
        return {
            "total_records": 0, "normal_records": 0, "attack_records": 0,
            "device_distribution": {}, "protocol_distribution": {},
        }

    total = len(df)
    normal = int((df["label"] == "normal").sum())
    attack = int((df["label"] == "attack").sum())

    return {
        "total_records": total,
        "normal_records": normal,
        "attack_records": attack,
        "device_distribution": df["device_id"].value_counts().to_dict(),
        "protocol_distribution": df["protocol"].value_counts().to_dict(),
    }


def device_behavior_summary(device_id: str) -> dict:
    """
    Produces the summary risk_engine.py needs for ONE device:
      - average packet count / bytes / duration
      - proportion of 'attack'-labeled traffic
      - most common traffic_type
    Returns None if the device has no traffic history yet (treated as
    NORMAL/low-risk by the risk engine, since there's nothing to flag).
    """
    rows = database.get_recent_iot_data(device_id, limit=200)
    if not rows:
        return None

    df = pd.DataFrame(rows)
    attack_ratio = float((df["label"] == "attack").mean())

    return {
        "device_id": device_id,
        "record_count": len(df),
        "avg_packet_count": float(df["packet_count"].mean()),
        "avg_bytes": float(df["bytes"].mean()),
        "avg_connection_duration": float(df["connection_duration"].mean()),
        "attack_ratio": attack_ratio,
        "dominant_traffic_type": df["traffic_type"].mode().iloc[0] if not df["traffic_type"].mode().empty else "unknown",
        "is_anomalous": attack_ratio > 0.3,  # more than 30% attack-labeled traffic -> flag
    }


def flag_security_events_from_dataset():
    """Scans every device's behavior and writes a security_events row
    for any device whose recent traffic looks anomalous. Run this
    periodically (or once after loading a fresh dataset batch)."""
    devices = database.list_devices()
    flagged = 0
    for device in devices:
        summary = device_behavior_summary(device["device_id"])
        if summary and summary["is_anomalous"]:
            database.insert_security_event(
                device_id=device["device_id"],
                event_type="ANOMALOUS_TRAFFIC",
                severity="HIGH",
                description=(
                    f"{summary['attack_ratio']*100:.1f}% of recent traffic for "
                    f"{device['device_id']} is attack-labeled "
                    f"(dominant type: {summary['dominant_traffic_type']})."
                ),
            )
            flagged += 1
    print(f"[dataset_analysis] flagged {flagged} device(s) as anomalous.")
    return flagged


if __name__ == "__main__":
    print(overall_statistics())
