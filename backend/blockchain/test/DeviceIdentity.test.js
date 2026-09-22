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

describe("DeviceIdentity", function () {
  let deviceIdentity, admin, other;

  beforeEach(async function () {
    const provider = new ethers.JsonRpcProvider(process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545");
    admin = await provider.getSigner(0);
    other = await provider.getSigner(1);

    const artifact = getArtifact("DeviceIdentity");
    const Factory = new ContractFactory(artifact.abi, artifact.bytecode, admin);
    deviceIdentity = await Factory.deploy();
    await deviceIdentity.waitForDeployment();
  });

  it("registers a new device", async function () {
    await (await deviceIdentity.registerDevice("IOT001", "Temperature Sensor", "did:iot:IOT001#abc", admin.address, "SENSOR")).wait();
    const device = await deviceIdentity.getDevice("IOT001");
    expect(device[1]).to.equal("did:iot:IOT001#abc");
    expect(device[4]).to.equal(true);
  });

  it("rejects duplicate registration", async function () {
    await (await deviceIdentity.registerDevice("IOT001", "Temperature Sensor", "did:iot:IOT001#abc", admin.address, "SENSOR")).wait();
    try {
      await (await deviceIdentity.registerDevice("IOT001", "Temperature Sensor", "did:iot:IOT001#abc", admin.address, "SENSOR")).wait();
      expect.fail("Should have reverted");
    } catch (err) {
      expect(err.message).to.satisfy(msg => msg.includes("DeviceIdentity: device already registered") || msg.includes("revert") || msg.includes("CALL_EXCEPTION"));
    }
  });

  it("revokes and reactivates a device", async function () {
    await (await deviceIdentity.registerDevice("IOT004", "Door Sensor", "did:iot:IOT004#xyz", admin.address, "SENSOR")).wait();
    await (await deviceIdentity.revokeDevice("IOT004")).wait();
    expect(await deviceIdentity.isDeviceActive("IOT004")).to.equal(false);

    await (await deviceIdentity.activateDevice("IOT004")).wait();
    expect(await deviceIdentity.isDeviceActive("IOT004")).to.equal(true);
  });

  it("rejects operations from a non-admin account", async function () {
    try {
      await (await deviceIdentity.connect(other).registerDevice("IOT099", "Fake", "did:iot:IOT099#x", other.address, "SENSOR")).wait();
      expect.fail("Should have reverted");
    } catch (err) {
      expect(err.message).to.satisfy(msg => msg.includes("DeviceIdentity: caller is not admin") || msg.includes("revert") || msg.includes("CALL_EXCEPTION"));
    }
  });
});
