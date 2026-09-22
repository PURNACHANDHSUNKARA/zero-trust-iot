# Zero-Trust IoT Security Framework with Blockchain & DID

A production-ready Zero-Trust IoT security solution featuring decentralized identity (W3C DID), Ed25519 cryptographic authentication, machine learning anomaly detection, Ethereum Solidity smart contracts, and interactive React analytics dashboard.

---

## Repository Architecture

```
zero-trust-iot/
│
├── frontend/                     # React + Vite Analytics Dashboard (Deploys to Vercel)
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   ├── public/
│   └── .env.example
│
├── backend/                      # Python + Node Security Engine & REST Server (Deploys to Render via Docker)
│   ├── package.json
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── python-security/          # Risk Engine, ML models, DB handlers, DID manager
│   ├── database/                 # PostgreSQL schema.sql
│   └── blockchain/               # Hardhat smart contracts (DeviceIdentity, AccessControl, AuditLog)
│
├── .gitignore
└── README.md
```

---

## Local Development

### 1. Backend Setup

```bash
cd backend
# Option A: Run directly with Python
python python-security/server.py

# Option B: Run via npm script
npm install
npm start
```
The backend API server will start on `http://localhost:8000`. You can test the health check at `http://localhost:8000/health`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
The React development server will launch on `http://localhost:5173`.

---

## Production Deployment

### Backend Deployment (Render)

Deploy the backend to **Render** using Docker:

* **Repository**: `https://github.com/PURNACHANDHSUNKARA/zero-trust-iot.git`
* **Runtime**: `Docker`
* **Root Directory**: `backend`
* **Dockerfile Location**: `Dockerfile` (relative to `backend/`)
* **Start Command**: `npm start`
* **Health Check Path**: `/health`

#### Required Backend Environment Variables (Render Dashboard):

| Variable Key | Description | Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Render Managed PostgreSQL Connection String | `postgres://user:password@ep-xyz.render.com/dbname` |
| `PG_SSLMODE` | SSL Mode for PostgreSQL connection | `require` |
| `FRONTEND_URL` | Allowed origin for CORS requests | `https://your-frontend.vercel.app` |
| `PORT` | Dynamic port injected by Render | `10000` |
| `PYTHONUNBUFFERED` | Unbuffered Python stdout logging | `1` |

---

### Frontend Deployment (Vercel)

Deploy the frontend to **Vercel**:

* **Repository**: `https://github.com/PURNACHANDHSUNKARA/zero-trust-iot.git`
* **Root Directory**: `frontend`
* **Framework Preset**: `Vite`
* **Build Command**: `npm run build`
* **Output Directory**: `dist`

#### Required Frontend Environment Variables (Vercel Dashboard):

| Variable Key | Description | Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Deployed Render Backend Base URL | `https://your-backend.onrender.com` |

---

## Key Features

1. **Zero-Trust Access Control**: Continuous risk score calculation combining device role, resource sensitivity, location anomalies, and machine learning threat scores.
2. **Ed25519 Cryptographic Authentication**: Challenge-response nonce verification with timestamp validation and replay attack prevention.
3. **Decentralized Identity (DID)**: W3C compliant `did:key` identifiers generated for every IoT device.
4. **Machine Learning Anomaly Detection**: Supervised ML models (Random Forest, XGBoost, Stacking Classifier) detecting network packet volume anomalies.
5. **Ethereum Smart Contract Integration**: On-chain device registration, access revocation, and immutable audit logs via Solidity smart contracts.
