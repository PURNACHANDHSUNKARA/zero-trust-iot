/**
 * blockchain.js
 * ---------------
 * React <-> smart contract communication via ethers.js + MetaMask.
 * Reads data directly from Ganache (127.0.0.1:7545, chainId: 1337)
 * using MetaMask provider or direct local RPC fallback.
 */

import { BrowserProvider, JsonRpcProvider, Contract } from "ethers";

import DeviceIdentityArtifact from "../contracts/DeviceIdentity.json";
import AccessControlArtifact from "../contracts/AccessControl.json";
import AuditLogArtifact from "../contracts/AuditLog.json";

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
  const adminAddress = await contract.admin();
  if (signerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
    throw new Error(
      `Unauthorized Account! MetaMask is connected with ${signerAddress}, but the contract admin is ${adminAddress}. Please open MetaMask and switch to ${adminAddress}.`
    );
  }

  try {
    const tx = await contract.revokeDevice(deviceId);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    if (err.message?.includes("missing revert data") || err.code === "CALL_EXCEPTION") {
      throw new Error(
        `Transaction reverted: Account ${signerAddress} is not the admin of DeviceIdentity.sol (admin: ${adminAddress}). Please switch accounts in MetaMask.`
      );
    }
    throw err;
  }
}

export async function activateDeviceOnChain(deviceId) {
  const signer = await getProviderOrSigner(true);
  const contract = contractFor(DeviceIdentityArtifact, signer);
  
  const signerAddress = await signer.getAddress();
  const adminAddress = await contract.admin();
  if (signerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
    throw new Error(
      `Unauthorized Account! MetaMask is connected with ${signerAddress}, but the contract admin is ${adminAddress}. Please open MetaMask and switch to ${adminAddress}.`
    );
  }

  try {
    const tx = await contract.activateDevice(deviceId);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    if (err.message?.includes("missing revert data") || err.code === "CALL_EXCEPTION") {
      throw new Error(
        `Transaction reverted: Account ${signerAddress} is not the admin of DeviceIdentity.sol (admin: ${adminAddress}). Please switch accounts in MetaMask.`
      );
    }
    throw err;
  }
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
    // If MetaMask gave an error (e.g. on wrong network), retry via direct local RPC
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

