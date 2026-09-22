"""
generate_dataset.py
-------------------
Generates a representative IoT cybersecurity dataset CSV (CICIoT2023 / ToN_IoT format)
if data/iot_dataset.csv is not present, allowing the full Zero-Trust framework to run
out of the box without requiring manual external file downloads.
"""

import os
import random
from datetime import datetime, timedelta
import pandas as pd

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "iot_dataset.csv")


def generate_sample_dataset(output_path: str = DATA_PATH, num_records: int = 3000):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if os.path.exists(output_path):
        print(f"[dataset] Found existing dataset at {output_path}")
        return output_path

    print(f"[dataset] Generating {num_records} representative IoT network flow records...")
    random.seed(42)

    base_time = datetime.now() - timedelta(days=2)
    rows = []

    devices = ["IOT001", "IOT002", "IOT003", "IOT004", "IOT005", "IOT006"]
    attack_types = ["DDoS-ICMP_Flood", "Mirai-greeth_flood", "PortScan", "Recon-OSScan", "SYN_Flood"]

    for i in range(num_records):
        dev_idx = i % len(devices)
        current_time = base_time + timedelta(seconds=i * 15 + random.randint(1, 10))

        # IOT003 has anomalous attack traffic; others have normal benign telemetry
        is_attack_device = (dev_idx == 2)  # IOT003

        if is_attack_device and random.random() < 0.85:
            # High-risk attack traffic for IOT003
            traffic_type = random.choice(attack_types)
            label = "Attack"
            protocol = random.choice(["TCP", "UDP", "ICMP"])
            packets = random.randint(600, 4500)
            bytes_count = random.randint(120_000, 1_200_000)
            duration = round(random.uniform(0.01, 2.5), 4)
        else:
            # Normal benign IoT telemetry
            traffic_type = "normal"
            label = "Benign"
            protocol = random.choice(["MQTT", "COAP", "HTTP", "TCP", "UDP"])
            packets = random.randint(5, 120)
            bytes_count = random.randint(300, 15_000)
            duration = round(random.uniform(0.1, 30.0), 4)

        rows.append({
            "Timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
            "Protocol": protocol,
            "Tot Fwd Pkts": packets,
            "Tot Fwd Bytes": bytes_count,
            "Flow Duration": duration,
            "Label": label,
            "traffic_type": traffic_type,
        })

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"[dataset] Successfully generated dataset with {len(df)} rows at {output_path}")
    return output_path


if __name__ == "__main__":
    generate_sample_dataset()
