"""
device_simulator.py
---------------------
Since there is no physical IoT hardware, devices are "simulated":
each one is a row in the devices table with a real Ed25519 key pair,
a DID, and a role, whose behavior history comes from the mapped
dataset rows in iot_data (see dataset_loader.assign_records_to_devices).

Private keys are kept ONLY in memory / a local keys.json for demo
purposes (representing "the key material stored on the device
itself"). Only the PUBLIC key is stored in PostgreSQL and on-chain -
this mirrors how a real device would never expose its private key.
"""

import json
import os

import authentication
import database
import did_manager
import blockchain

KEYS_FILE = os.path.join(os.path.dirname(__file__), "device_keys.json")  # gitignored - simulates "keys stored on the device"

SIMULATED_DEVICES = [
    {"device_id": "IOT001", "device_name": "Living Room Temp Sensor", "device_type": "Temperature Sensor", "role": "SENSOR"},
    {"device_id": "IOT002", "device_name": "Hallway Humidity Sensor", "device_type": "Humidity Sensor", "role": "SENSOR"},
    {"device_id": "IOT003", "device_name": "Backyard Motion Sensor", "device_type": "Motion Sensor", "role": "SENSOR"},
    {"device_id": "IOT004", "device_name": "Front Door Sensor", "device_type": "Door Sensor", "role": "SENSOR"},
    {"device_id": "IOT005", "device_name": "Driveway Camera", "device_type": "Smart Camera", "role": "CAMERA"},
    {"device_id": "IOT006", "device_name": "Garage Smart Motor", "device_type": "Smart Motor", "role": "ACTUATOR"},
]


def _load_keys() -> dict:
    if os.path.exists(KEYS_FILE):
        with open(KEYS_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_keys(keys: dict):
    with open(KEYS_FILE, "w") as f:
        json.dump(keys, f, indent=2)


def provision_devices(register_onchain: bool = False):
    """
    For each device in SIMULATED_DEVICES:
      1. Generate an Ed25519 key pair (or load if already provisioned).
      2. Derive its DID from the public key.
      3. Store device_id/DID/public_key/role/status in PostgreSQL.
      4. (Optional) also register it on-chain via DeviceIdentity.sol.
    """
    keys = _load_keys()

    for spec in SIMULATED_DEVICES:
        device_id = spec["device_id"]

        if device_id in keys:
            priv_hex, pub_hex = keys[device_id]["private_key"], keys[device_id]["public_key"]
        else:
            priv_hex, pub_hex = authentication.generate_keypair()
            keys[device_id] = {"private_key": priv_hex, "public_key": pub_hex}

        did = did_manager.generate_did(device_id, pub_hex)

        database.insert_device(
            device_id=device_id,
            device_name=spec["device_name"],
            device_type=spec["device_type"],
            did=did,
            public_key=pub_hex,
            role=spec["role"],
            status="ACTIVE",
        )

        print(f"[device_simulator] provisioned {device_id} ({spec['device_type']}) -> {did}")

        if register_onchain:
            try:
                addr = blockchain.w3.eth.accounts[0] if len(blockchain.w3.eth.accounts) > 0 else blockchain.get_admin_account().address
                result = blockchain.register_device_onchain(
                    device_id, spec["device_type"], did,
                    device_address=addr,
                    role=spec["role"],
                )
                print(f"    on-chain registration: {result.get('status', 'OK')}")
            except Exception as e:
                print(f"    on-chain registration note: {e}")

    _save_keys(keys)
    print(f"[device_simulator] {len(SIMULATED_DEVICES)} device(s) provisioned.")


def get_sign_function(device_id: str):
    """Returns a sign_fn(message)->signature_hex bound to this device's
    private key, for use with authentication.authenticate_device()."""
    keys = _load_keys()
    if device_id not in keys:
        raise ValueError(f"No key material found for {device_id}. Run provision_devices() first.")
    priv_hex = keys[device_id]["private_key"]
    return lambda message: authentication.sign_message(priv_hex, message)


if __name__ == "__main__":
    provision_devices(register_onchain=False)
