"""
did_manager.py
---------------
Project-level Decentralized Identity (DID) generation for simulated
IoT devices.

IMPORTANT SCOPE NOTE:
This is a project-level DID implementation for demonstrating the
*concept* of decentralized, cryptographically-derived device identity.
It does NOT implement the full W3C DID specification (no DID
Documents, no did:key/did:web method registration, no resolver
network). The "method" used here, `did:iot:`, is a custom method
invented for this project - it is not a registered W3C DID method.

Identity is derived from the device's Ed25519 public key fingerprint,
which is the same principle real DID methods use (e.g. did:key), just
implemented at project scope rather than full spec compliance.
"""

import hashlib


def generate_did(device_id: str, public_key_hex: str) -> str:
    """
    Builds a DID string of the form:
        did:iot:<device_id>#<fingerprint>

    The fingerprint is the first 16 hex characters of SHA-256(public_key),
    which ties the identity to the device's actual cryptographic key
    rather than just to an arbitrary device_id string. Two devices can
    never collide unless they share a public key (cryptographically
    infeasible with Ed25519).
    """
    fingerprint = hashlib.sha256(bytes.fromhex(public_key_hex)).hexdigest()[:16]
    return f"did:iot:{device_id}#{fingerprint}"


def verify_did(did: str, device_id: str, public_key_hex: str) -> bool:
    """Recomputes the DID from the given public key and checks it
    matches. Used to prove a DID was not tampered with / reassigned
    to a different key."""
    expected = generate_did(device_id, public_key_hex)
    return did == expected


def parse_did(did: str) -> dict:
    """Splits a did:iot:... string back into its parts."""
    if not did.startswith("did:iot:"):
        raise ValueError(f"Not a did:iot identifier: {did}")
    remainder = did[len("did:iot:"):]
    device_id, _, fingerprint = remainder.partition("#")
    return {"method": "iot", "device_id": device_id, "fingerprint": fingerprint}


if __name__ == "__main__":
    import authentication

    priv, pub = authentication.generate_keypair()
    did = generate_did("IOT001", pub)
    print("Generated DID:", did)
    print("Verifies against correct key:", verify_did(did, "IOT001", pub))

    _, wrong_pub = authentication.generate_keypair()
    print("Verifies against wrong key:  ", verify_did(did, "IOT001", wrong_pub))

    print("Parsed:", parse_did(did))
