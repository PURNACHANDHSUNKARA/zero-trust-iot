-- ============================================================
-- Zero-Trust IoT Security Framework - Database Schema
-- Database: zero_trust_iot
-- ============================================================
-- Run this AFTER creating the database:
--   CREATE DATABASE zero_trust_iot;
-- Then connect to it and run this whole file:
--   \c zero_trust_iot
--   \i schema.sql
-- ============================================================

-- ---------- users ----------
-- Admin/dashboard users. Only password HASHES are stored, never
-- plaintext passwords. IoT devices do NOT use this table - they
-- authenticate with Ed25519 keys (see authentication_logs).
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,   -- bcrypt hash, never plaintext
    role            VARCHAR(32)  NOT NULL DEFAULT 'admin',
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ---------- devices ----------
-- One row per simulated IoT device. Mirrors (a subset of) what is
-- also recorded on-chain in DeviceIdentity.sol. PostgreSQL holds the
-- rich/detailed copy; the blockchain holds the trust-critical copy.
CREATE TABLE IF NOT EXISTS devices (
    id                  SERIAL PRIMARY KEY,
    device_id           VARCHAR(64)  NOT NULL UNIQUE,   -- e.g. IOT001
    device_name         VARCHAR(128) NOT NULL,
    device_type         VARCHAR(64)  NOT NULL,          -- e.g. Temperature Sensor
    did                 VARCHAR(128) NOT NULL UNIQUE,   -- e.g. did:iot:IOT001#<fingerprint>
    public_key          TEXT         NOT NULL,          -- Ed25519 public key, hex-encoded
    blockchain_address  VARCHAR(64),                     -- Ganache account address, once registered
    role                VARCHAR(32)  NOT NULL DEFAULT 'SENSOR',  -- SENSOR / ACTUATOR / CAMERA ...
    status              VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / REVOKED
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- ---------- iot_data ----------
-- Cleaned records imported from the chosen IoT cybersecurity dataset
-- (see python-security/dataset_loader.py). This is the "sensor traffic
-- history" the risk engine reads from. device_id is a soft FK (dataset
-- device IDs are mapped onto simulated devices, not all rows need a
-- matching row in `devices`, e.g. attack-only traffic).
CREATE TABLE IF NOT EXISTS iot_data (
    id                    SERIAL PRIMARY KEY,
    device_id             VARCHAR(64)  NOT NULL,
    timestamp             TIMESTAMP    NOT NULL,
    protocol              VARCHAR(32),
    packet_count           INTEGER,
    bytes                  BIGINT,
    connection_duration    NUMERIC(12,4),
    traffic_type           VARCHAR(32),   -- e.g. normal, dos, scan, mirai...
    label                   VARCHAR(32),   -- normal / attack (from the dataset)
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_iot_data_device ON iot_data(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_data_timestamp ON iot_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_iot_data_label ON iot_data(label);

-- ---------- authentication_logs ----------
-- Every Ed25519 challenge/response authentication attempt.
CREATE TABLE IF NOT EXISTS authentication_logs (
    id                       SERIAL PRIMARY KEY,
    device_id                VARCHAR(64)  NOT NULL,
    nonce                    VARCHAR(128) NOT NULL,     -- one-time random value (replay protection)
    authentication_status    VARCHAR(16)  NOT NULL,     -- SUCCESS / FAILED
    authentication_method    VARCHAR(32)  NOT NULL DEFAULT 'ED25519_SIGNATURE',
    timestamp                TIMESTAMP    NOT NULL DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_logs_device ON authentication_logs(device_id);
-- Prevents the *same* nonce ever being marked SUCCESS twice (replay protection at the DB level)
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_logs_nonce_success
    ON authentication_logs(nonce) WHERE authentication_status = 'SUCCESS';

-- ---------- access_requests ----------
-- One row per Zero-Trust decision (the "Never trust, always verify" log).
CREATE TABLE IF NOT EXISTS access_requests (
    id            SERIAL PRIMARY KEY,
    device_id     VARCHAR(64)  NOT NULL,
    resource      VARCHAR(64)  NOT NULL,   -- e.g. "Temperature", "CameraFeed"
    action        VARCHAR(32)  NOT NULL,   -- e.g. READ, WRITE, DELETE
    risk_score    INTEGER      NOT NULL,
    decision      VARCHAR(16)  NOT NULL,   -- ALLOW / DENY
    reason        VARCHAR(255),
    timestamp     TIMESTAMP    NOT NULL DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_access_requests_device ON access_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_decision ON access_requests(decision);

-- ---------- security_events ----------
-- Anomalies / suspicious behaviour flagged during dataset analysis or
-- Zero-Trust evaluation (separate from routine access_requests).
CREATE TABLE IF NOT EXISTS security_events (
    id            SERIAL PRIMARY KEY,
    device_id     VARCHAR(64),
    event_type    VARCHAR(64)  NOT NULL,   -- e.g. HIGH_RISK, REPLAY_ATTEMPT, UNKNOWN_DEVICE
    severity      VARCHAR(16)  NOT NULL,   -- LOW / MEDIUM / HIGH
    description   TEXT,
    timestamp     TIMESTAMP    NOT NULL DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- ============================================================
-- Relationship summary:
--   devices (1) ----< iot_data            (device_id)
--   devices (1) ----< authentication_logs (device_id)
--   devices (1) ----< access_requests     (device_id)
--   devices (1) ----< security_events     (device_id, nullable)
-- Primary keys: SERIAL `id` on every table (surrogate key).
-- Natural key: devices.device_id (also used as the FK everywhere else)
-- because it is the identifier that is meaningful across Python,
-- PostgreSQL AND the Solidity contracts (all three systems agree on
-- this string, e.g. "IOT001").
-- ============================================================
