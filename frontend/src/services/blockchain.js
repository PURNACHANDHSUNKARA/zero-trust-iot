/**
 * blockchain.js
 * ---------------
 * React <-> smart contract communication via ethers.js + MetaMask.
 * Reads data directly from Ganache (127.0.0.1:7545, chainId: 1337)
 * using MetaMask provider or direct local RPC fallback.
 */

import { BrowserProvider, JsonRpcProvider, Contract, verifyMessage } from "ethers";

import DeviceIdentityArtifact from "../contracts/DeviceIdentity.json";
import AccessControlArtifact from "../contracts/AccessControl.json";
import AuditLogArtifact from "../contracts/AuditLog.json";

export const ADMIN_ADDRESS = "0x378679C438F68168Cf736B33948111FCE028BD17";

const GANACHE_RPC_URL = import.meta.env.VITE_GANACHE_RPC_URL || "http://127.0.0.1:7545";
const GANACHE_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 1337);
const GANACHE_CHAIN_HEX = `0x${GANACHE_CHAIN_ID.toString(16)}`;

function assertDeployed(artifact) {
  if (!artifact.address) {
    throw new Error(
      `${artifact.contractName} is not deployed yet. Run "npm run deploy" inside blockchain/ or "python run_all.py".`
    );
  }
}

export async function connectWallet() {
  if (!window.ethereum) {
    // If no MetaMask, fallback to direct RPC provider
    const fallbackProvider = new JsonRpcProvider(GANACHE_RPC_URL);
    return { provider: fallbackProvider, address: null, chainId: GANACHE_CHAIN_ID };
  }

  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  
  // Try ensuring MetaMask is on Ganache Local network
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GANACHE_CHAIN_HEX }],
    });
  } catch (switchError) {
    // Error 4902 means the chain has not been added to MetaMask
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: GANACHE_CHAIN_HEX,
              chainName: "Ganache Local",
              rpcUrls: [GANACHE_RPC_URL],
              nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
            },
          ],
        });
      } catch (addError) {
        console.warn("Could not auto-add Ganache network:", addError);
      }
    }
  }

  const network = await provider.getNetwork();
  return { provider, address: accounts[0], chainId: Number(network.chainId) };
}

async function getProviderOrSigner(requireSigner = false) {
  if (window.ethereum) {
    try {
      const provider = new BrowserProvider(window.ethereum);
      if (requireSigner) {
        return await provider.getSigner();
      }
      return provider;
    } catch {
      // Fallback
    }
  }
  return new JsonRpcProvider(GANACHE_RPC_URL);
}

function contractFor(artifact, signerOrProvider) {
  assertDeployed(artifact);
  return new Contract(artifact.address, artifact.abi, signerOrProvider);
}

/**
 * Local Storage helpers for User Access Requests
 */
const ACCESS_STORAGE_KEYS = {
  requests: "zti.metamask.access_requests.v1",
  approved: "zti.metamask.approved_users.v1",
  rejected: "zti.metamask.rejected_users.v1",
};

function readStorageJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("LocalStorage write error:", e);
  }
}

export function getPendingAccessRequests() {
  const reqs = readStorageJSON(ACCESS_STORAGE_KEYS.requests, []);
  const approved = readStorageJSON(ACCESS_STORAGE_KEYS.approved, []);
  const rejected = readStorageJSON(ACCESS_STORAGE_KEYS.rejected, []);
  
  return reqs.map((r) => {
    const isAppr = approved.some((a) => a.toLowerCase() === r.address.toLowerCase());
    const isRej = rejected.some((a) => a.toLowerCase() === r.address.toLowerCase());
    const status = isAppr ? "APPROVED" : isRej ? "REJECTED" : "PENDING";
    return { ...r, status };
  });
}

export async function requestAccessWallet(walletAddress) {
  const cleanAddr = walletAddress.trim().toLowerCase();
  const reqs = readStorageJSON(ACCESS_STORAGE_KEYS.requests, []);
  const existing = reqs.find((r) => r.address.toLowerCase() === cleanAddr);
  
  if (!existing) {
    const newReq = {
      address: walletAddress,
      requestedAt: new Date().toISOString(),
      timestampStr: new Date().toLocaleString(),
    };
    writeStorageJSON(ACCESS_STORAGE_KEYS.requests, [...reqs, newReq]);
  }

  // Remove from rejected if re-requesting
  const rejected = readStorageJSON(ACCESS_STORAGE_KEYS.rejected, []);
  writeStorageJSON(
    ACCESS_STORAGE_KEYS.rejected,
    rejected.filter((a) => a.toLowerCase() !== cleanAddr)
  );

  // Try smart contract request if deployed & window.ethereum available
  if (window.ethereum && isContractDeployed("AccessControl")) {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = contractFor(AccessControlArtifact, signer);
      const tx = await contract.requestAccess();
      await tx.wait();
    } catch (err) {
      console.warn("Smart contract requestAccess fallback:", err.message);
    }
  }

  return { ok: true, address: walletAddress };
}

export async function grantAccessWallet(walletAddress) {
  const cleanAddr = walletAddress.trim().toLowerCase();
  const approved = readStorageJSON(ACCESS_STORAGE_KEYS.approved, []);
  
  if (!approved.some((a) => a.toLowerCase() === cleanAddr)) {
    writeStorageJSON(ACCESS_STORAGE_KEYS.approved, [...approved, walletAddress]);
  }

  // Remove from rejected
  const rejected = readStorageJSON(ACCESS_STORAGE_KEYS.rejected, []);
  writeStorageJSON(
    ACCESS_STORAGE_KEYS.rejected,
    rejected.filter((a) => a.toLowerCase() !== cleanAddr)
  );

  // Try smart contract grantAccess if available
  let txHash = null;
  if (window.ethereum && isContractDeployed("AccessControl")) {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = contractFor(AccessControlArtifact, signer);
      const tx = await contract.grantAccess(walletAddress);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (err) {
      console.warn("Smart contract grantAccess notice:", err.message);
    }
  }

  return { ok: true, address: walletAddress, txHash };
}

export async function rejectAccessWallet(walletAddress) {
  const cleanAddr = walletAddress.trim().toLowerCase();
  const rejected = readStorageJSON(ACCESS_STORAGE_KEYS.rejected, []);
  
  if (!rejected.some((a) => a.toLowerCase() === cleanAddr)) {
    writeStorageJSON(ACCESS_STORAGE_KEYS.rejected, [...rejected, walletAddress]);
  }

  // Remove from approved
  const approved = readStorageJSON(ACCESS_STORAGE_KEYS.approved, []);
  writeStorageJSON(
    ACCESS_STORAGE_KEYS.approved,
    approved.filter((a) => a.toLowerCase() !== cleanAddr)
  );

  // Try smart contract rejectAccess if available
  let txHash = null;
  if (window.ethereum && isContractDeployed("AccessControl")) {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = contractFor(AccessControlArtifact, signer);
      const tx = await contract.rejectAccess(walletAddress);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (err) {
      console.warn("Smart contract rejectAccess notice:", err.message);
    }
  }

  return { ok: true, address: walletAddress, txHash };
}

/**
 * Full MetaMask Authentication Flow with Permission Tiers:
 * 1. Request wallet account address
 * 2. Generate authentication message / nonce
 * 3. Ask MetaMask to sign message (cryptographic signature)
 * 4. Verify signature on frontend using ethers verifyMessage
 * 5. Check role hierarchy: Super Admin vs Authorized User vs Pending vs Rejected
 */
export async function authenticateWithMetaMask() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install the MetaMask extension to sign in.");
  }

  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  if (!accounts || accounts.length === 0) {
    throw new Error("No MetaMask account selected.");
  }

  const connectedAddress = accounts[0];
  const cleanConnected = connectedAddress.toLowerCase();
  
  // Try ensuring MetaMask is on Ganache Local network
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GANACHE_CHAIN_HEX }],
    });
  } catch (switchError) {
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: GANACHE_CHAIN_HEX,
              chainName: "Ganache Local",
              rpcUrls: [GANACHE_RPC_URL],
              nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
            },
          ],
        });
      } catch (addError) {
        console.warn("Could not auto-add Ganache network:", addError);
      }
    }
  }

  const nonce = `zti-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const timeStr = new Date().toISOString();
  
  const authMessage = 
    `ZERO-TRUST IOT PORTAL AUTHENTICATION\n` +
    `----------------------------------------\n` +
    `Sign this message to authenticate your Web3 identity.\n\n` +
    `Connected Wallet:\n${connectedAddress}\n\n` +
    `Timestamp: ${timeStr}\n` +
    `Nonce: ${nonce}\n\n` +
    `Note: Signature verification proves ownership of your wallet private key without gas costs.`;

  const signer = await provider.getSigner();
  let signature;
  try {
    signature = await signer.signMessage(authMessage);
  } catch (signErr) {
    throw new Error("Signature request cancelled or rejected in MetaMask.");
  }

  // Verify signature cryptographically
  const recoveredAddress = verifyMessage(authMessage, signature);
  if (recoveredAddress.toLowerCase() !== cleanConnected) {
    throw new Error("Cryptographic signature verification failed. Address mismatch.");
  }

  // Check smart contract admin if deployed
  let contractAdmin = ADMIN_ADDRESS;
  try {
    contractAdmin = await getDeviceIdentityAdmin();
  } catch (e) {
    console.warn("Could not read contract admin, fallback to target ADMIN_ADDRESS:", e.message);
  }

  const isSuperAdmin = 
    cleanConnected === ADMIN_ADDRESS.toLowerCase() ||
    (contractAdmin && cleanConnected === contractAdmin.toLowerCase());

  if (isSuperAdmin) {
    return {
      ok: true,
      status: "SUPER_ADMIN",
      role: "super_admin",
      roleLabel: "Super Admin (Contract Owner)",
      address: connectedAddress,
      contractAdmin,
      targetAdmin: ADMIN_ADDRESS,
      signature,
      nonce,
      timestamp: timeStr,
      network: "Ganache Local (1337)",
    };
  }

  // Check on-chain & storage for Approved Users
  const approvedList = readStorageJSON(ACCESS_STORAGE_KEYS.approved, []);
  let isApprovedOnChain = approvedList.some((a) => a.toLowerCase() === cleanConnected);

  if (!isApprovedOnChain && isContractDeployed("AccessControl")) {
    try {
      const accessContract = contractFor(AccessControlArtifact, provider);
      isApprovedOnChain = await accessContract.isAuthorizedUser(connectedAddress);
    } catch (e) {
      console.warn("Could not query isAuthorizedUser on contract:", e.message);
    }
  }

  if (isApprovedOnChain) {
    return {
      ok: true,
      status: "APPROVED_USER",
      role: "authorized_user",
      roleLabel: "Authorized Administrator",
      address: connectedAddress,
      contractAdmin,
      targetAdmin: ADMIN_ADDRESS,
      signature,
      nonce,
      timestamp: timeStr,
      network: "Ganache Local (1337)",
    };
  }

  // Check if request is PENDING or REJECTED
  const reqList = readStorageJSON(ACCESS_STORAGE_KEYS.requests, []);
  const rejList = readStorageJSON(ACCESS_STORAGE_KEYS.rejected, []);

  const isPending = reqList.some((r) => r.address.toLowerCase() === cleanConnected);
  const isRejected = rejList.some((r) => r.toLowerCase() === cleanConnected);

  return {
    ok: false,
    status: isRejected ? "REJECTED" : isPending ? "PENDING" : "UNAUTHORIZED",
    address: connectedAddress,
    contractAdmin,
    targetAdmin: ADMIN_ADDRESS,
    signature,
    nonce,
    timestamp: timeStr,
    network: "Ganache Local (1337)",
  };
}


// ---------------- DeviceIdentity ----------------

export async function getDeviceOnChain(deviceId) {
  const provider = await getProviderOrSigner(false);
  const contract = contractFor(DeviceIdentityArtifact, provider);
  const [deviceType, did, deviceAddress, role, active] = await contract.getDevice(deviceId);
  return { deviceType, did, deviceAddress, role, active };
}

export async function revokeDeviceOnChain(deviceId) {
  const signer = await getProviderOrSigner(true);
  const contract = contractFor(DeviceIdentityArtifact, signer);
  const signerAddress = await signer.getAddress();

  // Auto-register device on-chain if missing in storage mapping
  try {
    const existing = await contract.getDevice(deviceId).catch(() => null);
    if (!existing || !existing.did) {
      const regTx = await contract.registerDevice(
        deviceId,
        "IoT Sensor",
        `did:iot:${deviceId}#${Math.random().toString(16).slice(2, 10)}`,
        signerAddress,
        "SENSOR",
        { gasLimit: 250000 }
      );
      await regTx.wait();
    }
  } catch (e) {
    console.warn("Notice: Device auto-registration check:", e.message);
  }

  const tx = await contract.revokeDevice(deviceId, { gasLimit: 200000 });
  const receipt = await tx.wait();
  return { ok: true, txHash: receipt.hash, blockNumber: receipt.blockNumber, status: "REVOKED", deviceId };
}

export async function activateDeviceOnChain(deviceId) {
  const signer = await getProviderOrSigner(true);
  const contract = contractFor(DeviceIdentityArtifact, signer);
  const signerAddress = await signer.getAddress();

  // Auto-register device on-chain if missing in storage mapping
  try {
    const existing = await contract.getDevice(deviceId).catch(() => null);
    if (!existing || !existing.did) {
      const regTx = await contract.registerDevice(
        deviceId,
        "IoT Sensor",
        `did:iot:${deviceId}#${Math.random().toString(16).slice(2, 10)}`,
        signerAddress,
        "SENSOR",
        { gasLimit: 250000 }
      );
      await regTx.wait();
    }
  } catch (e) {
    console.warn("Notice: Device auto-registration check:", e.message);
  }

  const tx = await contract.activateDevice(deviceId, { gasLimit: 200000 });
  const receipt = await tx.wait();
  return { ok: true, txHash: receipt.hash, blockNumber: receipt.blockNumber, status: "ACTIVE", deviceId };
}





// ---------------- AccessControl ----------------

export async function hasPermissionOnChain(role, resource, action) {
  const provider = await getProviderOrSigner(false);
  const contract = contractFor(AccessControlArtifact, provider);
  return contract.hasPermission(role, resource, action);
}

// ---------------- AuditLog ----------------

export async function getAuditTrailOnChain(limit = 50) {
  let provider = await getProviderOrSigner(false);
  let contract = contractFor(AuditLogArtifact, provider);

  try {
    const total = Number(await contract.getFunction("getEventCount")());
    const start = Math.max(0, total - limit);
    const events = [];
    for (let i = start; i < total; i++) {
      const [deviceId, resource, action, decision, timestamp] = await contract.getFunction("getEvent")(i);
      events.push({
        deviceId,
        resource,
        action,
        decision,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
      });
    }
    return events.reverse();
  } catch (err) {
    console.warn("Direct RPC query retry due to:", err.message);
    const directProvider = new JsonRpcProvider(GANACHE_RPC_URL);
    const directContract = contractFor(AuditLogArtifact, directProvider);
    const total = Number(await directContract.getFunction("getEventCount")());
    const start = Math.max(0, total - limit);
    const events = [];
    for (let i = start; i < total; i++) {
      const [deviceId, resource, action, decision, timestamp] = await directContract.getFunction("getEvent")(i);
      events.push({
        deviceId,
        resource,
        action,
        decision,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
      });
    }
    return events.reverse();
  }
}

export const isContractDeployed = (name) => {
  const artifacts = {
    DeviceIdentity: DeviceIdentityArtifact,
    AccessControl: AccessControlArtifact,
    AuditLog: AuditLogArtifact,
  };
  return Boolean(artifacts[name]?.address);
};

export async function getDeviceIdentityAdmin() {
  const provider = await getProviderOrSigner(false);
  const contract = contractFor(DeviceIdentityArtifact, provider);
  return contract.admin();
}


