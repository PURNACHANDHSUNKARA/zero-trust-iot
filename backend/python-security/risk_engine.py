"""
risk_engine.py
---------------
Calculates a numeric risk score (0-100+) for a device based on its
recent dataset behavior, then maps that score to LOW/MEDIUM/HIGH.

IMPORTANT: these weights are a PROJECT-DEFINED POLICY MODEL, not a
scientifically validated formula. They are intentionally simple and
explainable so they can be demonstrated and tuned during a viva. In a
production system these would come from a trained anomaly-detection
model, not fixed weights.

Weight table (project policy):
    baseline normal behavior      +10
    high packet count (>threshold) +30
    high byte volume (>threshold)  +30
    abnormal traffic_type           +40
    unknown protocol                +30
    device status == REVOKED        +100  (auto-caps at HIGH)

Thresholds:
    0-30    LOW
    31-60   MEDIUM
    61-100+ HIGH
"""

import database
import dataset_analysis

# Tunable thresholds - change these and re-run to see how outcomes shift.
PACKET_COUNT_THRESHOLD = 500
BYTES_THRESHOLD = 100_000
KNOWN_PROTOCOLS = {"TCP", "UDP", "HTTP", "HTTPS", "MQTT", "COAP", "ICMP"}

WEIGHT_BASELINE = 10
WEIGHT_HIGH_PACKETS = 30
WEIGHT_HIGH_BYTES = 30
WEIGHT_ABNORMAL_TRAFFIC = 60
WEIGHT_UNKNOWN_PROTOCOL = 30
WEIGHT_REVOKED = 100


def risk_level(score: int) -> str:
    if score <= 30:
        return "LOW"
    elif score <= 60:
        return "MEDIUM"
    else:
        return "HIGH"


def calculate_risk(device_id: str) -> dict:
    """
    Returns:
        {
            "device_id": ...,
            "score": int,
            "level": "LOW"/"MEDIUM"/"HIGH",
            "reasons": [list of strings explaining the score],
        }
    """
    device = database.get_device(device_id)
    reasons = []
    score = 0

    if device is None:
        return {"device_id": device_id, "score": 100, "level": "HIGH",
                "reasons": ["Device not found in registry."]}

    if device["status"] == "REVOKED":
        score += WEIGHT_REVOKED
        reasons.append(f"+{WEIGHT_REVOKED}: device status is REVOKED")

    summary = dataset_analysis.device_behavior_summary(device_id)

    if summary is None:
        # No traffic history at all -> treat as baseline-normal, low risk
        score += WEIGHT_BASELINE
        reasons.append(f"+{WEIGHT_BASELINE}: no traffic history, baseline normal behavior assumed")
    else:
        score += WEIGHT_BASELINE
        reasons.append(f"+{WEIGHT_BASELINE}: baseline normal behavior")

        if summary["avg_packet_count"] > PACKET_COUNT_THRESHOLD:
            score += WEIGHT_HIGH_PACKETS
            reasons.append(f"+{WEIGHT_HIGH_PACKETS}: high packet count "
                            f"(avg={summary['avg_packet_count']:.0f} > {PACKET_COUNT_THRESHOLD})")

        if summary["avg_bytes"] > BYTES_THRESHOLD:
            score += WEIGHT_HIGH_BYTES
            reasons.append(f"+{WEIGHT_HIGH_BYTES}: high byte volume "
                            f"(avg={summary['avg_bytes']:.0f} > {BYTES_THRESHOLD})")

        if summary["is_anomalous"]:
            score += WEIGHT_ABNORMAL_TRAFFIC
            reasons.append(f"+{WEIGHT_ABNORMAL_TRAFFIC}: abnormal traffic "
                            f"({summary['attack_ratio']*100:.1f}% attack-labeled)")

        if summary["dominant_traffic_type"] and summary["dominant_traffic_type"].upper() not in KNOWN_PROTOCOLS \
           and summary["dominant_traffic_type"].lower() not in ("normal", "unknown"):
            # dominant_traffic_type here doubles as a loose "unusual pattern" signal
            score += WEIGHT_UNKNOWN_PROTOCOL
            reasons.append(f"+{WEIGHT_UNKNOWN_PROTOCOL}: unrecognized/unusual traffic pattern "
                            f"('{summary['dominant_traffic_type']}')")

    level = risk_level(score)
    return {"device_id": device_id, "score": score, "level": level, "reasons": reasons}


if __name__ == "__main__":
    for device in database.list_devices():
        result = calculate_risk(device["device_id"])
        print(f"{result['device_id']}: score={result['score']} level={result['level']}")
        for r in result["reasons"]:
            print("   ", r)
