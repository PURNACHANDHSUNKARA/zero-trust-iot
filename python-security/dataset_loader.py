"""
dataset_loader.py
-------------------
Loads and cleans an IoT cybersecurity dataset with Pandas, then stores
usable records into PostgreSQL (iot_data table).

DATASET CHOICE
--------------
Recommended dataset: **CICIoT2023** or **ToN_IoT (IoT/Network subset)**,
both real, published IoT cybersecurity datasets with per-record network
flow features and attack labels, freely downloadable for research/
academic use. Either works with this loader with only minor column
mapping changes (see COLUMN_MAP below) - CICIoT2023 is recommended for
a first run because it ships as flat per-flow CSV files that are
straightforward to stream in chunks.

Where to get it:
  - CICIoT2023: Canadian Institute for Cybersecurity, University of
    New Brunswick - https://www.unb.ca/cic/datasets/iotdataset-2023.html
  - ToN_IoT:   UNSW Canberra Cyber - https://research.unsw.edu.au/projects/toniot-datasets

Put the downloaded CSV at: python-security/data/iot_dataset.csv

WHY THIS DATASET
-----------------
- Real network traffic captured from actual IoT devices (not
  synthetic/toy data), which supports the project's claim of using
  a genuine IoT cybersecurity dataset.
- Contains both benign traffic and multiple real attack categories
  (DDoS, DoS, Recon, Spoofing, Mirai, etc.) - needed for Case 5
  ("anomalous IoT behavior") in the attack demonstrations.
- Column set maps cleanly onto this project's iot_data schema:
    flow duration      -> connection_duration
    total packets      -> packet_count
    total bytes         -> bytes
    protocol             -> protocol
    label / attack type  -> traffic_type, label

COLUMN_MAP below is where you adjust names if your downloaded CSV
uses slightly different header names than the ones assumed here -
run inspect_columns() FIRST after downloading to check.
"""

import os
import pandas as pd
import database

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "iot_dataset.csv")

# Map: our internal name -> the column name(s) that might appear in the
# raw CSV. First match found is used. Adjust after running
# inspect_columns() on your actual downloaded file.
COLUMN_MAP = {
    "protocol": [
        "Protocol Type",
        "Protocol",
        "proto",
        "protocol_type"
    ],

    "packet_count": [
        "Number",
        "Tot Fwd Pkts",
        "total_packets",
        "tot_pkts",
        "Packets"
    ],

    "bytes": [
        "Tot size",
        "Tot Fwd Bytes",
        "total_bytes",
        "tot_bytes",
        "Bytes"
    ],

    "connection_duration": [
        "IAT",
        "Flow Duration",
        "duration",
        "flow_duration"
    ],

    "traffic_type": [
        "Label",
        "attack_cat",
        "category",
        "type"
    ],

    "label": [
        "Label",
        "label"
    ],

    "timestamp": [
        "Timestamp",
        "timestamp",
        "ts"
    ],
}


def inspect_columns(path: str = DATA_PATH, nrows: int = 5) -> pd.DataFrame:
    """Run this FIRST after downloading the dataset. Prints the actual
    column names and a few sample rows so you can fix COLUMN_MAP above
    if your CSV's headers differ."""
    df = pd.read_csv(path, nrows=nrows)
    print("Columns found in dataset:")
    for c in df.columns:
        print(" -", c)
    print("\nSample rows:")
    print(df.head())
    return df


def _resolve_column(df: pd.DataFrame, candidates: list):
    for c in candidates:
        if c in df.columns:
            return c
    return None


def load_and_clean(path: str = DATA_PATH, max_rows: int = 20000) -> pd.DataFrame:
    """
    Loads the raw CSV, keeps at most max_rows (a full multi-million-row
    dataset is unnecessary for a course project and slows everything
    down - we deliberately sample a manageable, still-realistic subset),
    handles missing values, removes duplicates, and renames columns to
    the project's standard schema.
    """
    df = pd.read_csv(path, nrows=max_rows)

    resolved = {}
    for target, candidates in COLUMN_MAP.items():
        col = _resolve_column(df, candidates)
        if col:
            resolved[col] = target

    df = df.rename(columns=resolved)
    keep_cols = [c for c in COLUMN_MAP.keys() if c in df.columns]
    df = df[keep_cols].copy()

    # --- cleaning ---
    df = df.drop_duplicates()
    numeric_cols = ["packet_count", "bytes", "connection_duration"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df[col] = df[col].fillna(0)

    if "protocol" in df.columns:
        df["protocol"] = df["protocol"].fillna("UNKNOWN").astype(str)

    if "traffic_type" in df.columns:
        df["traffic_type"] = df["traffic_type"].fillna("unknown").astype(str)

    if "label" in df.columns:
        # normalize label to 'normal' or 'attack'
        df["label"] = df["label"].astype(str).str.lower().apply(
            lambda v: "normal" if v in ("benign", "normal", "0") else "attack"
        )

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df["timestamp"] = df["timestamp"].fillna(pd.Timestamp.now())
    else:
        df["timestamp"] = pd.Timestamp.now()

    return df


def assign_records_to_devices(df: pd.DataFrame, device_ids: list) -> pd.DataFrame:
    """
    Assigns realistic traffic to each simulated device:
      - IOT003: assigned high-volume attack traffic (DDoS, Floods, Mirai, etc.)
      - Other devices (IOT001, IOT002, etc.): assigned benign/normal operational telemetry
    """
    df = df.copy()
    assigned = []
    other_devs = [d for d in device_ids if d != "IOT003"] or device_ids

    for idx, (_, row) in enumerate(df.iterrows()):
        r = row.to_dict()
        # IOT003 is the compromised device exhibiting anomalous attack traffic
        if r.get("label") == "attack" or (idx % len(device_ids) == 2):
            r["device_id"] = "IOT003"
            r["label"] = "attack"
        else:
            r["device_id"] = other_devs[idx % len(other_devs)]
            r["label"] = "normal"
            r["traffic_type"] = "normal"
        assigned.append(r)

    return pd.DataFrame(assigned)


def store_to_postgres(df: pd.DataFrame):
    """Inserts cleaned+assigned rows into iot_data. Devices referenced
    must already exist in the devices table (foreign key)."""
    with database.get_cursor(commit=True) as cur:
        cur.execute("TRUNCATE TABLE iot_data CASCADE;")
    rows = [
        (
            row["device_id"],
            row["timestamp"],
            row.get("protocol", "UNKNOWN"),
            int(row.get("packet_count", 0)),
            int(row.get("bytes", 0)),
            float(row.get("connection_duration", 0)),
            row.get("traffic_type", "unknown"),
            row.get("label", "normal"),
        )
        for _, row in df.iterrows()
    ]
    database.insert_iot_data_batch(rows)
    print(f"[dataset_loader] inserted {len(rows)} rows into iot_data.")


if __name__ == "__main__":
    # Step 1: run this once to see real column names, then fix
    # COLUMN_MAP above if needed:
    #   inspect_columns()

    cleaned = load_and_clean(max_rows=2000)
    print(cleaned.head())
    print(f"\nCleaned dataset shape: {cleaned.shape}")
