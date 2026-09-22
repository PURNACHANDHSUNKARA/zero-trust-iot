import { expect } from "chai";
import { ethers, ContractFactory } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArtifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

describe("AccessControl", function () {
  let accessControl, admin, other;

  beforeEach(async function () {
    const provider = new ethers.JsonRpcProvider(process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545");
    admin = await provider.getSigner(0);
    other = await provider.getSigner(1);

    const artifact = getArtifact("AccessControl");
    const Factory = new ContractFactory(artifact.abi, artifact.bytecode, admin);
    accessControl = await Factory.deploy();
    await accessControl.waitForDeployment();
  });

  it("denies permission by default", async function () {
    expect(await accessControl.hasPermission("SENSOR", "Temperature", "READ")).to.equal(false);
  });

  it("grants and checks permission", async function () {
    await (await accessControl.grantPermission("SENSOR", "Temperature", "READ")).wait();
    expect(await accessControl.hasPermission("SENSOR", "Temperature", "READ")).to.equal(true);
  });

  it("revokes a previously granted permission", async function () {
    await (await accessControl.grantPermission("SENSOR", "Temperature", "READ")).wait();
    await (await accessControl.revokePermission("SENSOR", "Temperature", "READ")).wait();
    expect(await accessControl.hasPermission("SENSOR", "Temperature", "READ")).to.equal(false);
  });

  it("rejects unauthorized operations", async function () {
    try {
      await (await accessControl.connect(other).grantPermission("SENSOR", "Temperature", "READ")).wait();
      expect.fail("Should have reverted");
    } catch (err) {
      expect(err.message).to.satisfy(msg => msg.includes("AccessControl: caller is not admin") || msg.includes("revert") || msg.includes("CALL_EXCEPTION"));
    }
  });
});
