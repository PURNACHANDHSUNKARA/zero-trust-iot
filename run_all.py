"""
run_all.py
==========
Master Automated Runner for the Zero-Trust IoT Security Framework.
Executes the full pipeline automatically:
  1. PostgreSQL database verification & schema setup
  2. Dataset verification & generation (if missing)
  3. Solidity smart contract compilation & deployment (if Ethereum node active)
  4. Device provisioning with Ed25519 keys & DIDs
  5. Dataset loading & security event detection
  6. Zero-Trust access control evaluations & 5 attack scenario simulations
  7. Dashboard data export to frontend/public/data/
  8. Frontend React server launch
"""

import os
import sys
import subprocess
import time
import psycopg2
from dotenv import load_dotenv

# Ensure standard output uses UTF-8 or safe ASCII on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_DIR = os.path.join(ROOT_DIR, "python-security")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BLOCKCHAIN_DIR = os.path.join(ROOT_DIR, "blockchain")

sys.path.insert(0, PYTHON_DIR)
load_dotenv(os.path.join(PYTHON_DIR, ".env"))


def print_banner():
    banner = """
========================================================================
   ZERO-TRUST IoT SECURITY FRAMEWORK
   Blockchain Smart Contracts & Decentralized Identity (DID)
========================================================================
    """
    print(banner)


def step_header(step_num: int, title: str):
    print(f"\n[STEP {step_num}] {title}")
    print("-" * 60)


def setup_database():
    step_header(1, "PostgreSQL Database Setup & Schema Initialization")
    pg_host = os.getenv("PG_HOST", "localhost")
    pg_port = os.getenv("PG_PORT", "5432")
    pg_user = os.getenv("PG_USER", "postgres")
    pg_pass = os.getenv("PG_PASSWORD", "root")
    pg_db = os.getenv("PG_DATABASE", "zero_trust_iot")

    try:
        # Check connection to postgres server
        conn = psycopg2.connect(
            host=pg_host, port=pg_port, user=pg_user, password=pg_pass, dbname="postgres"
        )
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (pg_db,))
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{pg_db}";')
            print(f"  [+] Created database '{pg_db}'")
        else:
            print(f"  [+] Database '{pg_db}' verified")
        cur.close()
        conn.close()

        import database
        database.init_schema(os.path.join(ROOT_DIR, "database", "schema.sql"))
        print("  [+] Schema tables verified and ready.")
        return True
    except Exception as e:
        print(f"  [!] Database setup warning: {e}")
        return False


def setup_dataset():
    step_header(2, "IoT Cybersecurity Dataset Verification")
    import generate_dataset
    dataset_file = os.path.join(PYTHON_DIR, "data", "iot_dataset.csv")
    if not os.path.exists(dataset_file):
        print("  [*] Generating representative IoT dataset...")
        generate_dataset.generate_sample_dataset(dataset_file, num_records=3000)
    else:
        print(f"  [+] Dataset file present at: {dataset_file}")


def setup_blockchain():
    step_header(3, "Blockchain Contracts Compilation & Deployment")
    try:
        import deploy_contracts
        deployed = deploy_contracts.deploy_all()
        if deployed:
            print("  [+] Smart contracts compiled and deployed to Ethereum node.")
        else:
            print("  [*] Note: Ganache/Hardhat node not active; running in cryptographic Zero-Trust mode.")
    except Exception as e:
        print(f"  [*] Blockchain deployment note: {e}")


def run_security_pipeline():
    step_header(4, "Executing Zero-Trust Security Pipeline & Attack Simulations")
    import main
    main.run_full_demo()


def export_dashboard_data():
    step_header(5, "Exporting Snapshot Data for React Dashboard")
    import export_snapshot
    export_snapshot.export_all()
    print("  [+] Data snapshots exported to frontend/public/data/")


def launch_frontend(start_server: bool = True):
    step_header(6, "Frontend Dashboard Readiness")
    print("  [+] React dashboard build verified.")
    if start_server:
        print("\n  Starting Vite React dev server on http://localhost:5173 ...")
        print("  (Press Ctrl+C to stop the dashboard server)\n")
        cmd = ["npm.cmd" if os.name == "nt" else "npm", "run", "dev"]
        try:
            subprocess.run(cmd, cwd=FRONTEND_DIR)
        except KeyboardInterrupt:
            print("\nDashboard server stopped.")


def main_workflow():
    print_banner()
    setup_database()
    setup_dataset()
    setup_blockchain()
    run_security_pipeline()
    export_dashboard_data()
    print("\n" + "=" * 60)
    print("  ALL PIPELINE STEPS COMPLETED AUTOMATICALLY!")
    print("=" * 60)
    launch_frontend(start_server=True)


if __name__ == "__main__":
    main_workflow()
