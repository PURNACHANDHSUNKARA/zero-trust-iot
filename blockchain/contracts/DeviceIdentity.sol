// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DeviceIdentity
/// @notice Stores the trust-critical identity record for each simulated
/// IoT device: its DID, role, and active/revoked status. The FULL
/// dataset and detailed logs stay in PostgreSQL - only the identity
/// fact that must be tamper-proof lives here.
contract DeviceIdentity {
    struct Device {
        string deviceId;
        string deviceType;
        string did;
        address deviceAddress;
        string role;
        bool active;
        bool exists;
    }

    address public admin;
    mapping(string => Device) private devices;
    string[] private deviceIds;

    event DeviceRegistered(string deviceId, string did, address deviceAddress, string role);
    event DeviceActivated(string deviceId);
    event DeviceRevoked(string deviceId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "DeviceIdentity: caller is not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerDevice(
        string memory deviceId,
        string memory deviceType,
        string memory did,
        address deviceAddress,
        string memory role
    ) public onlyAdmin {
        require(!devices[deviceId].exists, "DeviceIdentity: device already registered");

        devices[deviceId] = Device({
            deviceId: deviceId,
            deviceType: deviceType,
            did: did,
            deviceAddress: deviceAddress,
            role: role,
            active: true,
            exists: true
        });
        deviceIds.push(deviceId);

        emit DeviceRegistered(deviceId, did, deviceAddress, role);
    }

    function verifyDevice(string memory deviceId, string memory did) public view returns (bool) {
        if (!devices[deviceId].exists) return false;
        return keccak256(bytes(devices[deviceId].did)) == keccak256(bytes(did));
    }

    function getDevice(string memory deviceId) public view returns (
        string memory deviceType,
        string memory did,
        address deviceAddress,
        string memory role,
        bool active
    ) {
        require(devices[deviceId].exists, "DeviceIdentity: device not found");
        Device memory d = devices[deviceId];
        return (d.deviceType, d.did, d.deviceAddress, d.role, d.active);
    }

    function revokeDevice(string memory deviceId) public onlyAdmin {
        require(devices[deviceId].exists, "DeviceIdentity: device not found");
        devices[deviceId].active = false;
        emit DeviceRevoked(deviceId);
    }

    function activateDevice(string memory deviceId) public onlyAdmin {
        require(devices[deviceId].exists, "DeviceIdentity: device not found");
        devices[deviceId].active = true;
        emit DeviceActivated(deviceId);
    }

    function isDeviceActive(string memory deviceId) public view returns (bool) {
        require(devices[deviceId].exists, "DeviceIdentity: device not found");
        return devices[deviceId].active;
    }

    function getAllDeviceIds() public view returns (string[] memory) {
        return deviceIds;
    }
}
