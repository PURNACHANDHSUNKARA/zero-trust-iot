// deploy.js
// ---------
// Deploys DeviceIdentity, AccessControl, and AuditLog to Ganache.
// After deploying, writes each contract's ABI + deployed address to:
//   1. frontend/src/contracts/<Name>.json
//   2. python-security/contracts_abi/<Name>.json
// And updates python-security/.env and frontend/.env.

import { ethers, ContractFactory } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_OUT = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
const PYTHON_OUT = path.join(__dirname, "..", "..", "python-security", "contracts_abi");
const PYTHON_ENV = path.join(__dirname, "..", "..", "python-security", ".env");
const FRONTEND_ENV = path.join(__dirname, "..", "..", "frontend", ".env");

function getArtifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeArtifact(name, address) {
  const artifact = getArtifact(name);
  const out = { contractName: name, address, abi: artifact.abi };

  for (const dir of [FRONTEND_OUT, PYTHON_OUT]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(out, null, 2));
  }
}

function updateEnvFile(filePath, updates) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(filePath, content.trim() + "\n", "utf8");
}

async function main() {
  const rpcUrl = process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";
  console.log("Deploying to network: ganache\n");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  let signer;
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  } else {
    signer = await provider.getSigner(0);
  }
  console.log(`Deploying from account: ${await signer.getAddress()}`);

  async function deployOne(name) {
    const artifact = getArtifact(name);
    const Factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`${name} deployed at: ${address}`);
    return { name, address, contract };
  }

  const deviceIdentity = await deployOne("DeviceIdentity");
  const accessControl = await deployOne("AccessControl");
  const auditLog = await deployOne("AuditLog");

  writeArtifact("DeviceIdentity", deviceIdentity.address);
  writeArtifact("AccessControl", accessControl.address);
  writeArtifact("AuditLog", auditLog.address);

  // Initialize standard permissions in AccessControl
  const permissions = [
    ["SENSOR", "Temperature", "READ"],
    ["SENSOR", "Humidity", "READ"],
    ["SENSOR", "Motion", "READ"],
    ["SENSOR", "DoorStatus", "READ"],
    ["CAMERA", "CameraFeed", "READ"],
    ["ACTUATOR", "GarageDoor", "WRITE"],
    ["ACTUATOR", "MotorControl", "WRITE"],
  ];
  for (const [role, resource, action] of permissions) {
    const tx = await accessControl.contract.grantPermission(role, resource, action);
    await tx.wait();
  }

  // Update .env files automatically
  updateEnvFile(PYTHON_ENV, {
    DEVICE_IDENTITY_CONTRACT_ADDRESS: deviceIdentity.address,
    ACCESS_CONTROL_CONTRACT_ADDRESS: accessControl.address,
    AUDIT_LOG_CONTRACT_ADDRESS: auditLog.address,
    ADMIN_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || "0x528079f4f3716156e63a893880c2ad99a531a642cbce117ad152466d2b2aca11",
  });

  updateEnvFile(FRONTEND_ENV, {
    VITE_GANACHE_RPC_URL: rpcUrl,
    VITE_CHAIN_ID: 1337,
  });

  console.log("\nAdd these to python-security/.env and frontend/.env:");
  console.log(`DEVICE_IDENTITY_CONTRACT_ADDRESS=${deviceIdentity.address}`);
  console.log(`ACCESS_CONTROL_CONTRACT_ADDRESS=${accessControl.address}`);
  console.log(`AUDIT_LOG_CONTRACT_ADDRESS=${auditLog.address}`);

  console.log("\nContract ABIs written to:");
  console.log(" -", FRONTEND_OUT);
  console.log(" -", PYTHON_OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
