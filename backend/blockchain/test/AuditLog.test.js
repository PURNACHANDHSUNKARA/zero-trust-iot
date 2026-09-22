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

describe("AuditLog", function () {
  let auditLog, admin, other;

  beforeEach(async function () {
    const provider = new ethers.JsonRpcProvider(process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545");
    admin = await provider.getSigner(0);
    other = await provider.getSigner(1);

    const artifact = getArtifact("AuditLog");
    const Factory = new ContractFactory(artifact.abi, artifact.bytecode, admin);
    auditLog = await Factory.deploy();
    await auditLog.waitForDeployment();
  });

  it("starts with zero events", async function () {
    expect(await auditLog.getEventCount()).to.equal(0n);
  });

  it("records an event", async function () {
    await (await auditLog.logEvent("IOT001", "Temperature", "READ", "ALLOW")).wait();
    expect(await auditLog.getEventCount()).to.equal(1n);

    const event = await auditLog.getFunction("getEvent")(0);
    expect(event[0]).to.equal("IOT001");
    expect(event[3]).to.equal("ALLOW");
  });

  it("records multiple events in order", async function () {
    await (await auditLog.logEvent("IOT001", "Temperature", "READ", "ALLOW")).wait();
    await (await auditLog.logEvent("IOT003", "Temperature", "READ", "DENY")).wait();
    expect(await auditLog.getEventCount()).to.equal(2n);

    const first = await auditLog.getFunction("getEvent")(0);
    const second = await auditLog.getFunction("getEvent")(1);
    expect(first[0]).to.equal("IOT001");
    expect(second[0]).to.equal("IOT003");
    expect(second[3]).to.equal("DENY");
  });

  it("reverts on out-of-range index", async function () {
    try {
      await auditLog.getFunction("getEvent")(0);
      expect.fail("Should have reverted");
    } catch (err) {
      expect(err.message).to.satisfy(msg => msg.includes("AuditLog: index out of range") || msg.includes("revert") || msg.includes("CALL_EXCEPTION"));
    }
  });

  it("rejects logging from a non-admin account", async function () {
    try {
      await (await auditLog.connect(other).logEvent("IOT001", "Temperature", "READ", "ALLOW")).wait();
      expect.fail("Should have reverted");
    } catch (err) {
      expect(err.message).to.satisfy(msg => msg.includes("AuditLog: caller is not admin") || msg.includes("revert") || msg.includes("CALL_EXCEPTION"));
    }
  });
});
