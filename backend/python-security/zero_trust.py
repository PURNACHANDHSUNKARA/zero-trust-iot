"""
zero_trust.py
--------------
The core "Never trust, always verify" decision engine. Every access
request runs through ALL of the following checks, in order, and stops
at the first failure:

    1. Identity valid?        (device registered + DID matches its public key)
    2. Authentication valid?  (most recent auth attempt succeeded)
    3. Device active?         (status == ACTIVE, not REVOKED)
    4. Permission exists?     (on-chain AccessControl allows this role/resource/action)
    5. Behavior / risk OK?    (risk_engine score is not HIGH)

    -> only if ALL FIVE pass: ALLOW
    -> otherwise: DENY, with the specific reason recorded

This is deliberately structured as separate, sequential checks (not a
single combined boolean) so each decision can be explained and logged
step by step - this is the main demonstration of "authentication
success does not equal automatic trust" (see main.py's demo scenarios).
"""

import database
import did_manager
import risk_engine
import blockchain


def check_identity(device_id: str) -> tuple:
    device = database.get_device(device_id)
    if device is None:
        return False, "IDENTITY_INVALID: device not registered"
    if not did_manager.verify_did(device["did"], device_id, device["public_key"]):
        return False, "IDENTITY_INVALID: DID does not match public key"
    return True, "identity valid"


def check_authentication(device_id: str) -> tuple:
    with database.get_cursor() as cur:
        cur.execute(
            """
            SELECT authentication_status FROM authentication_logs
            WHERE device_id = %s
            ORDER BY timestamp DESC LIMIT 1;
            """,
            (device_id,),
        )
        row = cur.fetchone()
    if row is None:
        return False, "AUTHENTICATION_INVALID: no authentication attempt on record"
    if row["authentication_status"] != "SUCCESS":
        return False, "AUTHENTICATION_INVALID: most recent attempt failed"
    return True, "authentication valid"


def check_device_active(device_id: str) -> tuple:
    device = database.get_device(device_id)
    if device is None or device["status"] != "ACTIVE":
        return False, "DEVICE_REVOKED: device is not ACTIVE"
    return True, "device active"


def check_permission(device_id: str, resource: str, action: str) -> tuple:
    device = database.get_device(device_id)
    allowed = blockchain.check_permission_onchain(
        role=device["role"], resource=resource, action=action
    )
    if not allowed:
        return False, f"INSUFFICIENT_PERMISSION: role '{device['role']}' cannot {action} {resource}"
    return True, "permission exists"


def check_behavior_risk(device_id: str) -> tuple:
    result = risk_engine.calculate_risk(device_id)
    if result["level"] == "HIGH":
        return False, f"HIGH_RISK: score={result['score']} ({'; '.join(result['reasons'])})", result
    return True, "risk acceptable", result


def evaluate_access(device_id: str, resource: str, action: str) -> dict:
    """
    Runs the full Zero-Trust decision flow and persists the result to
    access_requests (+ security_events for denials). Returns a dict
    with the final decision and the full trail of checks performed.
    """
    trail = []

    ok, msg = check_identity(device_id)
    trail.append(("identity", ok, msg))
    if not ok:
        return _deny(device_id, resource, action, 100, msg, trail)

    ok, msg = check_authentication(device_id)
    trail.append(("authentication", ok, msg))
    if not ok:
        return _deny(device_id, resource, action, 100, msg, trail)

    ok, msg = check_device_active(device_id)
    trail.append(("device_active", ok, msg))
    if not ok:
        return _deny(device_id, resource, action, 100, msg, trail)

    ok, msg = check_permission(device_id, resource, action)
    trail.append(("permission", ok, msg))
    if not ok:
        return _deny(device_id, resource, action, 50, msg, trail)

    ok, msg, risk_result = check_behavior_risk(device_id)
    trail.append(("behavior_risk", ok, msg))
    if not ok:
        return _deny(device_id, resource, action, risk_result["score"], msg, trail)

    # ALL checks passed
    database.insert_access_request(device_id, resource, action,
                                    risk_result["score"], "ALLOW", "all checks passed")
    blockchain.record_audit_log(device_id, resource, action, "ALLOW")
    return {
        "device_id": device_id, "resource": resource, "action": action,
        "decision": "ALLOW", "risk_score": risk_result["score"], "trail": trail,
    }


def _deny(device_id, resource, action, risk_score, reason, trail):
    database.insert_access_request(device_id, resource, action, risk_score, "DENY", reason)
    database.insert_security_event(
        device_id=device_id, event_type="ACCESS_DENIED",
        severity="HIGH" if risk_score >= 60 else "MEDIUM",
        description=reason,
    )
    blockchain.record_audit_log(device_id, resource, action, "DENY")
    return {
        "device_id": device_id, "resource": resource, "action": action,
        "decision": "DENY", "risk_score": risk_score, "reason": reason, "trail": trail,
    }


if __name__ == "__main__":
    result = evaluate_access("IOT001", "Temperature", "READ")
    print(result["decision"], "-", result.get("reason", "all checks passed"))
    for step, ok, msg in result["trail"]:
        print(f"  [{step}] {'PASS' if ok else 'FAIL'} - {msg}")
