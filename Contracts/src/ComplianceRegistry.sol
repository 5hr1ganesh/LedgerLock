// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ComplianceRegistry
 * @notice A registry for maintaining KYC/AML status of users.
 */
contract ComplianceRegistry is AccessControl {
    bytes32 public constant COMPLIANCE_OFFICER_ROLE =
        keccak256("COMPLIANCE_OFFICER_ROLE");

    mapping(address => bool) public isKycVerified;
    mapping(address => uint256) public kycExpiration;

    event StatusUpdated(address indexed user, bool status, uint256 expiration);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_OFFICER_ROLE, msg.sender);
    }

    function updateStatus(
        address user,
        bool status,
        uint256 expiration
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        isKycVerified[user] = status;
        kycExpiration[user] = expiration;
        emit StatusUpdated(user, status, expiration);
    }

    function batchUpdateStatus(
        address[] calldata users,
        bool status,
        uint256 expiration
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        for (uint256 i = 0; i < users.length; i++) {
            isKycVerified[users[i]] = status;
            kycExpiration[users[i]] = expiration;
            emit StatusUpdated(users[i], status, expiration);
        }
    }

    function isVerified(address user) external view returns (bool) {
        return isKycVerified[user] && (kycExpiration[user] > block.timestamp);
    }
}
