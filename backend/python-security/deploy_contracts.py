"""
deploy_contracts.py
-------------------
Deploys DeviceIdentity, AccessControl, and AuditLog contracts using web3.py
to whatever local Ethereum node is reachable (Ganache at 7545, Hardhat node at 8545, etc.).
Automatically updates ABI artifacts in frontend/src/contracts and python-security/contracts_abi,
seeds standard permissions in AccessControl, and updates .env files.
"""

import json
import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
BLOCKCHAIN_DIR = os.path.join(BASE_DIR, "blockchain")
PYTHON_DIR = os.path.join(BASE_DIR, "python-security")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

FRONTEND_CONTRACTS = os.path.join(FRONTEND_DIR, "src", "contracts")
PYTHON_ABI = os.path.join(PYTHON_DIR, "contracts_abi")


def get_web3_connection():
    # Try Ganache 7545 first, then 8545
    candidates = [
        os.getenv("GANACHE_RPC_URL", "http://127.0.0.1:7545"),
        "http://127.0.0.1:8545",
    ]

    for url in candidates:
        try:
            w3 = Web3(Web3.HTTPProvider(url))
            if w3.is_connected():
                print(f"[blockchain] Connected to Ethereum node at {url}")
                return w3, url
        except Exception:
            continue

    return None, None


def load_compiled_artifact(contract_name: str):
    artifact_path = os.path.join(
        BLOCKCHAIN_DIR, "artifacts", "contracts", f"{contract_name}.sol", f"{contract_name}.json"
    )
    if not os.path.exists(artifact_path):
        raise FileNotFoundError(f"Artifact not found: {artifact_path}. Run 'npx hardhat compile' first.")

    with open(artifact_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["abi"], data["bytecode"]


def save_contract_artifact(contract_name: str, address: str, abi: list):
    for d in [FRONTEND_CONTRACTS, PYTHON_ABI]:
        os.makedirs(d, exist_ok=True)
        out_path = os.path.join(d, f"{contract_name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"contractName": contract_name, "address": address, "abi": abi}, f, indent=2)
        print(f"[blockchain] Saved artifact -> {out_path}")


def update_env_file(file_path: str, updates: dict):
    lines = []
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    existing_keys = set()
    new_lines = []
    for line in lines:
        matched = False
        for k, v in updates.items():
            if line.startswith(f"{k}="):
                new_lines.append(f"{k}={v}\n")
                existing_keys.add(k)
                matched = True
                break
        if not matched:
            new_lines.append(line)

    for k, v in updates.items():
        if k not in existing_keys:
            new_lines.append(f"{k}={v}\n")

    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


def deploy_all():
    w3, rpc_url = get_web3_connection()
    if not w3:
        print("[blockchain] No active Ethereum node detected on 7545 or 8545. Skipping on-chain deployment.")
        return False

    accounts = w3.eth.accounts
    admin_account = accounts[0]
    print(f"[blockchain] Deploying with account: {admin_account}")

    contracts = ["DeviceIdentity", "AccessControl", "AuditLog"]
    deployed = {}

    for name in contracts:
        abi, bytecode = load_compiled_artifact(name)
        contract_factory = w3.eth.contract(abi=abi, bytecode=bytecode)
        tx_hash = contract_factory.constructor().transact({"from": admin_account})
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        address = receipt.contractAddress
        print(f"[blockchain] {name} deployed at: {address}")
        deployed[name] = {"address": address, "abi": abi, "instance": w3.eth.contract(address=address, abi=abi)}
        save_contract_artifact(name, address, abi)

    # Grant initial role permissions in AccessControl
    access_ctrl = deployed["AccessControl"]["instance"]
    permissions = [
        ("SENSOR", "Temperature", "READ"),
        ("SENSOR", "Humidity", "READ"),
        ("SENSOR", "Motion", "READ"),
        ("SENSOR", "DoorStatus", "READ"),
        ("CAMERA", "CameraFeed", "READ"),
        ("ACTUATOR", "GarageDoor", "WRITE"),
        ("ACTUATOR", "MotorControl", "WRITE"),
    ]
    print("[blockchain] Granting standard role permissions in AccessControl...")
    for role, resource, action in permissions:
        tx = access_ctrl.functions.grantPermission(role, resource, action).transact({"from": admin_account})
        w3.eth.wait_for_transaction_receipt(tx)
    print("[blockchain] Permissions granted successfully.")

    # Update .env files
    update_env_file(
        os.path.join(PYTHON_DIR, ".env"),
        {
            "GANACHE_RPC_URL": rpc_url,
            "DEVICE_IDENTITY_CONTRACT_ADDRESS": deployed["DeviceIdentity"]["address"],
            "ACCESS_CONTROL_CONTRACT_ADDRESS": deployed["AccessControl"]["address"],
            "AUDIT_LOG_CONTRACT_ADDRESS": deployed["AuditLog"]["address"],
        },
    )

    chain_id = w3.eth.chain_id
    update_env_file(
        os.path.join(FRONTEND_DIR, ".env"),
        {
            "VITE_GANACHE_RPC_URL": rpc_url,
            "VITE_CHAIN_ID": chain_id,
        },
    )

    print("[blockchain] All contracts deployed and configured successfully!")
    return True


if __name__ == "__main__":
    deploy_all()
