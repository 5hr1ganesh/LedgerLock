// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {
    ERC4626
} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {IComplianceRegistry} from "./interfaces/IComplianceRegistry.sol";

/**
 * @title TreasuryManager
 * @notice An ERC-4626 vault that enforces compliance (KYC)
 * and automatically withholds taxes on profits.
 */
contract TreasuryManager is ERC4626, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant COMPLIANCE_OFFICER_ROLE =
        keccak256("COMPLIANCE_OFFICER_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public taxRateBps = 2000; // 20% default
    address public taxAuthority;

    struct Position {
        uint256 avgEntryPrice; // Weighted average cost basis per share
        uint256 totalShares; // Shares contributing to this average
    }

    // mapping(address => bool) public isKYCVerified;
    mapping(address => Position) public positions;
    mapping(address => uint256) public entryPrice; // Legacy field - to be replaced by positions

    bool public isEmergencyMode;
    IComplianceRegistry public complianceRegistry;

    event TaxWithheld(address indexed user, uint256 amount);
    event EntryPriceUpdated(address indexed user, uint256 newPrice);
    event ComplianceUpdated(address indexed user, bool status);
    event EmergencyModeUpdated(bool status);

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _taxAuthority,
        address _complianceRegistry
    ) ERC4626(_asset) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_OFFICER_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
        taxAuthority = _taxAuthority;
        complianceRegistry = IComplianceRegistry(_complianceRegistry);
    }

    // --- COMPLIANCE LOGIC ---

    function setComplianceRegistry(
        address _complianceRegistry
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        require(_complianceRegistry != address(0), "zero address");
        complianceRegistry = IComplianceRegistry(_complianceRegistry);
    }

    function updateCompliance(
        address _user,
        bool _status
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        complianceRegistry.isVerified(_user);
        emit ComplianceUpdated(_user, _status);
    }

    // --- DEPOSIT OVERRIDES ---

    function deposit(
        uint256 assets,
        address receiver
    ) public override returns (uint256) {
        require(complianceRegistry.isVerified(msg.sender), "LGL: KYC Required");
        require(!isEmergencyMode, "LGL: Emergency Mode Active");

        uint256 shares = super.deposit(assets, receiver);

        // Update Weighted Average Cost Basis
        // Formula: ((oldShares * oldPrice) + (newShares * currentPrice)) / totalShares
        Position storage pos = positions[receiver];
        uint256 currentPrice = previewRedeem(1 ether);

        if (pos.totalShares == 0) {
            pos.avgEntryPrice = currentPrice;
        } else {
            pos.avgEntryPrice =
                ((pos.totalShares * pos.avgEntryPrice) +
                    (shares * currentPrice)) /
                (pos.totalShares + shares);
        }
        pos.totalShares += shares;

        emit EntryPriceUpdated(receiver, pos.avgEntryPrice);

        return shares;
    }

    // --- WITHDRAW OVERRIDES (TAXATION) ---

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        // Update Position tracking
        positions[owner].totalShares -= shares;

        // Calculate Profit using Weighted Average Cost Basis
        // Current Value = assets
        // Cost Basis = (shares * positions[owner].avgEntryPrice) / baseUnit
        uint256 costBasis = (shares * positions[owner].avgEntryPrice) /
            (1 ether);

        if (assets > costBasis) {
            uint256 profit = assets - costBasis;
            uint256 taxAmount = (profit * taxRateBps) / BPS_DENOMINATOR;

            // Deduct tax from the assets being withdrawn
            uint256 netAssets = assets - taxAmount;

            // Transfer tax to authority
            IERC20(asset()).safeTransfer(taxAuthority, taxAmount);
            emit TaxWithheld(owner, taxAmount);

            super._withdraw(caller, receiver, owner, netAssets, shares);
        } else {
            super._withdraw(caller, receiver, owner, assets, shares);
        }
    }

    // --- RISK MANAGEMENT ---

    function toggleEmergencyMode(
        bool _status
    ) external onlyRole(RISK_MANAGER_ROLE) {
        isEmergencyMode = _status;
        emit EmergencyModeUpdated(_status);
    }

    function setTaxRate(
        uint256 _newRateBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newRateBps <= BPS_DENOMINATOR, "LGL: Invalid rate");
        taxRateBps = _newRateBps;
    }
}
