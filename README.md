# Zero-Trust IoT Security Framework
### Using Blockchain Smart Contracts and Decentralized Identity

A B.Tech CSE project demonstrating Zero-Trust access control for simulated
IoT devices, backed by:

- **Python** — Ed25519 device authentication, DID generation, dataset
  processing, risk scoring, Zero-Trust decision engine
- **PostgreSQL** — detailed application data (devices, dataset records,
  logs, requests, events)
- **Solidity + Ganache** — device identity, permissions, revocation, and
  tamper-evident audit logs on a local Ethereum chain
- **React + Vite + ethers.js + MetaMask** — dashboard, direct
  wallet-signed contract interaction
- **No traditional backend** (no Express/Node API/REST/MongoDB/MySQL)

> **Note on Ganache:** Truffle/Consensys archived the Ganache project in
> February 2026 — it's unmaintained but still installable and works fine
> for local development. This project uses **Hardhat purely as a
> compiler/deployment tool** pointed at your Ganache RPC endpoint (not as
> a backend), matching the "Hardhat tooling if used" allowance. If you'd
> rather skip Ganache entirely, `npx hardhat node` is a drop-in
> replacement RPC endpoint — everything else in this README works
> unchanged, just point MetaMask at `http://127.0.0.1:8545` instead of
> `7545` and update `chainId` to `31337`.

---

## ⚡ Quick Automatic Run (One-Click)

To run the entire system end-to-end automatically with a single command:

```powershell
# Option A: Run via Python master script
python run_all.py

# Option B: Run via Windows batch launcher
run_all.bat
```

This single command automatically:
1. Verifies PostgreSQL connection & initializes all 6 schema tables.
2. Generates/verifies representative IoT cybersecurity dataset telemetry.
3. Compiles Solidity smart contracts (`DeviceIdentity`, `AccessControl`, `AuditLog`).
4. Provisions simulated devices (`IOT001` - `IOT006`) with Ed25519 cryptography & DIDs.
5. Runs dataset analysis, behavioral risk scoring (0–100), and flags anomalies.
6. Executes all 5 Zero-Trust attack cases and access control checks.
7. Exports fresh data snapshots to `frontend/public/data/*.json`.
8. Starts the React Vite dashboard at `http://localhost:5173`.

---

## 1. How the pieces talk to each other (no backend)

```
IoT dataset --> Python (auth, DID, risk, Zero-Trust) --> PostgreSQL (detailed data)
                                                      \-> Solidity/Ganache (trust-critical identity/audit)

React (ethers.js) <---- MetaMask ----> Ganache (same chain Python writes to)
React <---- fetch() ----> frontend/public/data/*.json  (static snapshot, written by
                                                          python-security/export_snapshot.py)
```

The browser **never** talks to PostgreSQL directly — that's not possible
without exposing a DB connection to client-side JS, which would be a
security hole. Instead, Python periodically exports read-only JSON
snapshots into `frontend/public/data/`, and Vite serves them as static
files. For live, trust-critical facts (device active/revoked, audit
trail), React talks straight to the Solidity contracts via
ethers.js + MetaMask, which is safe because the blockchain itself
enforces who can write.

---

## 2. Folder / file map

```
zero-trust-iot/                    FOLDER
├── blockchain/                    FOLDER
│   ├── contracts/                 FOLDER
│   │   ├── DeviceIdentity.sol     FILE
│   │   ├── AccessControl.sol      FILE
│   │   └── AuditLog.sol           FILE
│   ├── scripts/deploy.js          FILE
│   ├── test/                      FOLDER (DeviceIdentity/AccessControl/AuditLog .test.js)
│   ├── hardhat.config.js          FILE
│   ├── package.json               FILE
│   └── .env.example               FILE
├── python-security/                FOLDER
│   ├── authentication.py, did_manager.py, database.py, dataset_loader.py,
│   │   dataset_analysis.py, risk_engine.py, zero_trust.py,
│   │   device_simulator.py, blockchain.py, main.py, export_snapshot.py   FILES
│   ├── requirements.txt, .env.example                                    FILES
│   ├── data/ (put iot_dataset.csv here)                                  FOLDER
│   └── contracts_abi/ (auto-filled by deploy.js)                         FOLDER
├── frontend/                       FOLDER
│   ├── src/{components,pages,contracts,services,utils}/                  FOLDERS
│   ├── src/App.jsx, main.jsx, index.css                                  FILES
│   ├── package.json, vite.config.js, index.html, .env.example            FILES
│   └── public/data/ (auto-filled by export_snapshot.py)                  FOLDER
├── database/schema.sql             FILE
└── README.md                       FILE (this file)
```

---

## 3. Setup, in order

### 3.1 PostgreSQL
```
# In psql or pgAdmin:
CREATE DATABASE zero_trust_iot;
```
```
cd database
psql -U postgres -d zero_trust_iot -f schema.sql
```
Verify: `\dt` inside psql should list all 6 tables.

### 3.2 Python environment
```
cd python-security
python -m venv venv
venv\Scripts\activate        (Windows)
pip install -r requirements.txt --break-system-packages   (if needed on your system)
copy .env.example .env
```
Edit `.env` and set `PG_PASSWORD` to your real Postgres password.

Quick test:
```
python database.py
```
Expected: `[database] schema initialized.` then a stats dict of all zeros.

### 3.3 Dataset
Download CICIoT2023 or ToN_IoT (see `python-security/data/README.txt`),
place the CSV at `python-security/data/iot_dataset.csv`, then:
```
python -c "import dataset_loader; dataset_loader.inspect_columns()"
```
Fix `COLUMN_MAP` in `dataset_loader.py` if your column headers differ.

### 3.4 Ganache
1. Open Ganache → Quickstart (Ethereum).
2. Note the RPC URL (default `http://127.0.0.1:7545`) and the 10
   funded test accounts.
3. Click the key icon on Account 1 → copy its private key.

### 3.5 Blockchain (compile + deploy)
```
cd blockchain
npm install
copy .env.example .env      # paste the Ganache private key you copied
npm run compile
npm run deploy
```
This deploys all 3 contracts and **auto-writes** their ABI + address
into `frontend/src/contracts/*.json` and `python-security/contracts_abi/*.json`.
Copy the printed addresses into `python-security/.env` (the three
`*_CONTRACT_ADDRESS` variables).

Run the tests:
```
npm test
```
Expected: all `DeviceIdentity`, `AccessControl`, and `AuditLog` specs pass.

### 3.6 MetaMask ↔ Ganache
1. MetaMask → Networks → Add network manually:
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: `1337`
   - Currency symbol: `ETH`
2. Import one of the Ganache accounts into MetaMask using its private
   key (Account → Import Account).

### 3.7 Run the Python demo
```
cd python-security
python main.py
```
This provisions devices, loads the dataset, authenticates devices,
evaluates Zero-Trust access, revokes a device, and runs all 5 attack
cases — printing each decision and reason.

### 3.8 Export data for the dashboard
```
python export_snapshot.py
```

### 3.9 Frontend
```
cd frontend
npm install
copy .env.example .env
npm run dev
```
Open the printed local URL. Connect MetaMask when prompted on the
Devices / Blockchain Audit pages.

---

## 4. Re-running the demo with fresh data

Every time you want the dashboard to reflect new results:
```
cd python-security
python main.py
python export_snapshot.py
```
Then just refresh the browser tab (Vite serves the new static JSON).

---

## 5. Key demonstration: authentication ≠ trust

Run `python main.py` and look at the `IOT003` block in the output —
its Ed25519 authentication succeeds, but the Zero-Trust engine still
denies access because its dataset-derived risk score is HIGH. This is
the project's central thesis, made concrete in `zero_trust.py`'s
5-step check chain.

---

## 6. Security notes

- No plaintext passwords anywhere; devices never use passwords at all
  (Ed25519 keys only). If you add admin login, hash with bcrypt.
- All SQL is parameterized (`database.py`) — never string-concatenated.
- Only device identity/status/permissions/audit hashes live on-chain;
  the full dataset stays in PostgreSQL.
- `.env` files are gitignored everywhere — never commit real keys.
- Ganache private keys are fake test funds; still, don't reuse them
  on a real network.

---

## 7. What's next in this repo

The Phase-by-phase items from the original spec not yet built out here:
graph generation (`matplotlib`, from `access_requests`/`authentication_logs`
tables), the full written report (Sections 1–27), and the viva Q&A sheet.
Ask for either and they can be generated next, grounded in whatever
results your actual run of `main.py` produces (no invented numbers).
