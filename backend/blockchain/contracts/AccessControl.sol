// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AccessControl
/// @notice Role/resource/action permission registry and User Wallet Authorization.
/// Super Admin (contract owner) can grant or reject wallet access requests.
/// Authorized users get full read/dashboard access to telemetry and analytics.
contract AccessControl {
    address public admin;

    // permissions[role][resource][action] = allowed
    mapping(string => mapping(string => mapping(string => bool))) private permissions;

    // User Access Management
    mapping(address => bool) public approvedUsers;
    mapping(address => bool) public pendingRequests;

    event PermissionGranted(string role, string resource, string action);
    event PermissionRevoked(string role, string resource, string action);
    event AccessRequested(address indexed user, uint256 timestamp);
    event AccessGranted(address indexed user, address indexed grantedBy);
    event AccessRejected(address indexed user, address indexed rejectedBy);

    modifier onlyAdmin() {
        require(msg.sender == admin, "AccessControl: caller is not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        approvedUsers[msg.sender] = true;
    }

    function requestAccess() public {
        require(!approvedUsers[msg.sender], "AccessControl: already approved");
        pendingRequests[msg.sender] = true;
        emit AccessRequested(msg.sender, block.timestamp);
    }

    function grantAccess(address user) public onlyAdmin {
        approvedUsers[user] = true;
        pendingRequests[user] = false;
        emit AccessGranted(user, msg.sender);
    }

    function rejectAccess(address user) public onlyAdmin {
        approvedUsers[user] = false;
        pendingRequests[user] = false;
        emit AccessRejected(user, msg.sender);
    }

    function isAuthorizedUser(address user) public view returns (bool) {
        if (user == admin) return true;
        return approvedUsers[user];
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

