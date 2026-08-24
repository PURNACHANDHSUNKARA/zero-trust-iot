// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AccessControl
/// @notice Role/resource/action permission registry. The Zero-Trust
/// engine (Python) and the React dashboard both read hasPermission()
/// before allowing any device to act - this is enforcement, not the
/// full decision (risk scoring happens off-chain in risk_engine.py).
contract AccessControl {
    address public admin;

    // permissions[role][resource][action] = allowed
    mapping(string => mapping(string => mapping(string => bool))) private permissions;

    event PermissionGranted(string role, string resource, string action);
    event PermissionRevoked(string role, string resource, string action);

    modifier onlyAdmin() {
        require(msg.sender == admin, "AccessControl: caller is not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function grantPermission(string memory role, string memory resource, string memory action) public onlyAdmin {
        permissions[role][resource][action] = true;
        emit PermissionGranted(role, resource, action);
    }

    function revokePermission(string memory role, string memory resource, string memory action) public onlyAdmin {
        permissions[role][resource][action] = false;
        emit PermissionRevoked(role, resource, action);
    }

    function hasPermission(string memory role, string memory resource, string memory action) public view returns (bool) {
        return permissions[role][resource][action];
    }
}
