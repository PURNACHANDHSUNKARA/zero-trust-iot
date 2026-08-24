import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

/**
 * Hardhat config for compiling, testing, and deploying Solidity contracts.
 * Target EVM: paris (avoids PUSH0 for 100% compatibility with Ganache).
 */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    ganache: {
      type: "http",
      url: process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545",
      chainId: 1337,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    localhost: {
      type: "http",
      url: process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};
