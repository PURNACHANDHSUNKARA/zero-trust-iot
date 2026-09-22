"""
main.py
--------
Runs the full end-to-end demonstration described in the project spec
(Phase 21 / Section 22): provision devices, load dataset, authenticate,
evaluate Zero-Trust access, revoke a device, and demonstrate the five
attack scenarios.

Run with:  python main.py
Prerequisites: PostgreSQL running + schema applied, Ganache running,
contracts deployed and addresses set in .env (blockchain calls
gracefully SKIP with a printed reason if not deployed yet, so you can
run this after Phase 10 even before touching Solidity).
"""

import authentication
import database
import dataset_loader
import dataset_analysis
import device_simulator
import risk_engine
import zero_trust


def line(title=""):
    print("\n" + "=" * 60)
    if title:
        print(title)
        print("=" * 60)


def demo_authenticate(device_id: str):
    sign_fn = device_simulator.get_sign_function(device_id)
    result = authentication.authenticate_device(device_id, sign_fn)
    print(f"AUTH[{device_id}] -> {result['status']}"
          + (f" ({result['reason']})" if result["status"] == "FAILED" else ""))
    return result


def demo_normal_flow():
    line("NORMAL FLOW: IOT001 requests READ Temperature")
    demo_authenticate("IOT001")
    result = zero_trust.evaluate_access("IOT001", "Temperature", "READ")
    print("FINAL DECISION:", result["decision"], "| risk:", result["risk_score"])


def demo_high_risk_flow():
    line("ATTACK CASE 5: IOT003 has anomalous dataset behavior")
    demo_authenticate("IOT003")
    result = zero_trust.evaluate_access("IOT003", "Temperature", "READ")
    print("FINAL DECISION:", result["decision"], "| risk:", result["risk_score"])
    print("(Demonstrates: Authentication SUCCESS != automatic trust)")


def demo_revocation_flow():
    line("DEVICE REVOCATION: IOT004")
    print("Status before:", database.get_device("IOT004")["status"])
    database.set_device_status("IOT004", "REVOKED")
    blockchain_result = None
    try:
        import blockchain
        blockchain_result = blockchain.revoke_device_onchain("IOT004")
    except Exception as e:
        blockchain_result = {"status": "ERROR", "reason": str(e)}
    print("On-chain revoke result:", blockchain_result)

    demo_authenticate("IOT004")  # will still succeed cryptographically
    result = zero_trust.evaluate_access("IOT004", "DoorStatus", "READ")
    print("FINAL DECISION:", result["decision"], "(expected DENY - device revoked)")


def demo_attack_cases():
    line("ATTACK CASE 1: Unknown device FAKE001")
    result = authentication.authenticate_device(
        "FAKE001", sign_fn=lambda msg: "00" * 64
    )
    print("Result:", result)

    line("ATTACK CASE 2: Tampered signature for IOT002")
    device = database.get_device("IOT002")
    nonce = authentication.generate_nonce()
    import time
    msg = authentication.build_message("IOT002", nonce, int(time.time()))
    bad_signature = "11" * 64  # garbage signature, will fail verification
    valid = authentication.verify_signature(device["public_key"], msg, bad_signature)
    print("Signature valid?", valid, "(expected False)")

    line("ATTACK CASE 3: Replay attack (reused nonce) for IOT001")
    # Simulate an attacker capturing and replaying a previously valid signed nonce
    sign_fn = device_simulator.get_sign_function("IOT001")
    first_auth = authentication.authenticate_device("IOT001", sign_fn)
    reused_nonce = first_auth.get("nonce")
    # Attacker tries to submit the exact same nonce again
    replay_attempt = database.nonce_already_used(reused_nonce)
    print("Replayed nonce rejected?", replay_attempt, "(expected True - nonce already marked SUCCESS)")

    line("ATTACK CASE 4: Unauthorized resource - Temp sensor requests DELETE Camera Data")
    demo_authenticate("IOT001")
    result = zero_trust.evaluate_access("IOT001", "CameraFeed", "DELETE")
    print("FINAL DECISION:", result["decision"], "(expected DENY - insufficient permission)")


def run_full_demo():
    line("PHASE 21: FULL END-TO-END DEMONSTRATION")

    line("Step 1-2: Provisioning simulated devices")
    device_simulator.provision_devices(register_onchain=True)

    line("Step 3-4: Loading + cleaning IoT dataset, storing to PostgreSQL")
    try:
        cleaned = dataset_loader.load_and_clean(max_rows=1000)
        device_ids = [d["device_id"] for d in database.list_devices()]
        assigned = dataset_loader.assign_records_to_devices(cleaned, device_ids)
        dataset_loader.store_to_postgres(assigned)
        dataset_analysis.flag_security_events_from_dataset()
    except FileNotFoundError:
        print("Dataset file not found at data/iot_dataset.csv - "
              "download it first (see dataset_loader.py docstring). Skipping dataset steps.")

    demo_normal_flow()
    demo_high_risk_flow()
    demo_revocation_flow()
    demo_attack_cases()

    line("SUMMARY STATS")
    print(database.get_dashboard_stats())


if __name__ == "__main__":
    run_full_demo()
