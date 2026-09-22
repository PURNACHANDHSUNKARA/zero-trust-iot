"""
authentication.py
------------------
Cryptographic device authentication using Ed25519 asymmetric signatures.

Flow:
    1. Each simulated device has an Ed25519 key pair (generated once,
       stored as hex strings - private key stays "on the device",
       public key is registered in PostgreSQL + on-chain).
    2. The verifier (this module, playing the role of the Zero-Trust
       engine) generates a random nonce and sends it to the device.
    3. The device signs the nonce with its private key.
    4. This module verifies the signature against the device's stored
       public key.
    5. The nonce is checked against authentication_logs so it can never
       be reused (replay protection).

No plaintext passwords are ever used or stored for devices.
"""

import os
import secrets
import time

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

import database


# ---------------- key generation ----------------

def generate_keypair():
    """Generates a new Ed25519 key pair.
    Returns (private_key_hex, public_key_hex)."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return private_bytes.hex(), public_bytes.hex()


def load_private_key(private_key_hex: str) -> Ed25519PrivateKey:
    return Ed25519PrivateKey.from_private_bytes(bytes.fromhex(private_key_hex))


def load_public_key(public_key_hex: str) -> Ed25519PublicKey:
    return Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex))


# ---------------- nonce + message ----------------

def generate_nonce() -> str:
    """32 bytes of cryptographically secure randomness, hex-encoded.
    Used once per authentication attempt -> replay protection."""
    return secrets.token_hex(32)


def build_message(device_id: str, nonce: str, timestamp: int) -> bytes:
    """The exact byte string that gets signed. Binding device_id and
    timestamp into the message (not just the nonce) stops an attacker
    from replaying a valid signature under a different device_id."""
    return f"{device_id}|{nonce}|{timestamp}".encode("utf-8")


# ---------------- signing (device side, simulated) ----------------

def sign_message(private_key_hex: str, message: bytes) -> str:
    private_key = load_private_key(private_key_hex)
    signature = private_key.sign(message)
    return signature.hex()


# ---------------- verification (Zero-Trust engine side) ----------------

def verify_signature(public_key_hex: str, message: bytes, signature_hex: str) -> bool:
    public_key = load_public_key(public_key_hex)
    try:
        public_key.verify(bytes.fromhex(signature_hex), message)
        return True
    except InvalidSignature:
        return False
    except Exception:
        # malformed hex, wrong length, etc. -> treat as failed auth, never crash
        return False


def authenticate_device(device_id: str, sign_fn) -> dict:
    """
    Full authentication round-trip for one device.

    sign_fn: a callable(message: bytes) -> signature_hex, representing
    "the device signing with its private key". In device_simulator.py
    this wraps sign_message() with the device's stored private key.

    Returns a dict describing the result and logs the attempt to
    PostgreSQL either way (successes AND failures are logged).
    """
    device = database.get_device(device_id)
    if device is None:
        database.insert_security_event(
            device_id=None,
            event_type="UNKNOWN_DEVICE",
            severity="MEDIUM",
            description=f"Authentication attempted for unregistered device '{device_id}'.",
        )
        return {"status": "FAILED", "reason": "DEVICE_NOT_FOUND"}

    nonce = generate_nonce()
    timestamp = int(time.time())
    message = build_message(device_id, nonce, timestamp)

    signature_hex = sign_fn(message)

    valid = verify_signature(device["public_key"], message, signature_hex)

    # Replay protection: even a technically-valid signature is rejected
    # if this exact nonce was already used successfully before.
    replay = database.nonce_already_used(nonce)

    if valid and not replay:
        database.insert_auth_log(device_id, nonce, "SUCCESS")
        return {"status": "SUCCESS", "nonce": nonce, "timestamp": timestamp}
    else:
        reason = "REPLAYED_NONCE" if replay else "INVALID_SIGNATURE"
        database.insert_auth_log(device_id, nonce, "FAILED")
        database.insert_security_event(
            device_id=device_id,
            event_type=reason,
            severity="HIGH" if reason == "REPLAYED_NONCE" else "MEDIUM",
            description=f"Authentication failed for {device_id}: {reason}.",
        )
        return {"status": "FAILED", "reason": reason}


# ---------------- manual test ----------------

if __name__ == "__main__":
    # Standalone test that does NOT touch the database - proves the
    # crypto primitives work before wiring anything else up.
    priv, pub = generate_keypair()
    nonce = generate_nonce()
    ts = int(time.time())
    msg = build_message("IOT_TEST", nonce, ts)

    sig = sign_message(priv, msg)
    print("valid signature check:", verify_signature(pub, msg, sig))          # expect True

    tampered_msg = build_message("IOT_TEST", generate_nonce(), ts)
    print("tampered message check:", verify_signature(pub, tampered_msg, sig))  # expect False

    _, wrong_pub = generate_keypair()
    print("wrong public key check:", verify_signature(wrong_pub, msg, sig))   # expect False
