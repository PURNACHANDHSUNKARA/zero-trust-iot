// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AuditLog
/// @notice Append-only, tamper-evident record of every Zero-Trust
/// decision. Deliberately minimal: device/resource/action/decision +
/// timestamp only - NOT the full IoT dataset (that stays in
/// PostgreSQL, per the project's "don't put bulk data on-chain" rule).
contract AuditLog {
    struct Event {
        string deviceId;
        string resource;
        string action;
        string decision; // "ALLOW" or "DENY"
        uint256 timestamp;
    }

    address public admin;
    Event[] private events;

    event AuditRecorded(string deviceId, string resource, string action, string decision, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "AuditLog: caller is not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function logEvent(
        string memory deviceId,
        string memory resource,
        string memory action,
        string memory decision
    ) public onlyAdmin {
        events.push(Event(deviceId, resource, action, decision, block.timestamp));
        emit AuditRecorded(deviceId, resource, action, decision, block.timestamp);
    }

    function getEventCount() public view returns (uint256) {
        return events.length;
    }

    function getEvent(uint256 index) public view returns (
        string memory deviceId,
        string memory resource,
        string memory action,
        string memory decision,
        uint256 timestamp
    ) {
        require(index < events.length, "AuditLog: index out of range");
        Event memory e = events[index];
        return (e.deviceId, e.resource, e.action, e.decision, e.timestamp);
    }
}
