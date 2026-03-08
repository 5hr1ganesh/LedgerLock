// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TreasuryManager} from "../src/TreasuryManager.sol";
import {ComplianceRegistry} from "../src/ComplianceRegistry.sol";
import {TaxVault} from "../src/TaxVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract TreasuryManagerTest is Test {
    TreasuryManager public treasury;
    ComplianceRegistry public registry;
    TaxVault public vault;
    MockUSDC public asset;

    address public admin = address(1);
    address public user = address(2);
    address public taxAuthority = address(3);

    function setUp() public {
        vm.startPrank(admin);

        asset = new MockUSDC();
        registry = new ComplianceRegistry();
        vault = new TaxVault(taxAuthority);

        treasury = new TreasuryManager(
            IERC20(address(asset)),
            "LedgerLock Vault",
            "LLV",
            address(vault),
            address(registry)
        );

        // Setup roles
        registry.grantRole(registry.COMPLIANCE_OFFICER_ROLE(), admin);
        treasury.grantRole(treasury.COMPLIANCE_OFFICER_ROLE(), admin);

        // KYC user with no expiration (long in future)
        registry.updateStatus(user, true, block.timestamp + 365 days);

        vm.stopPrank();
    }

    function testInitialDeposit() public {
        uint256 depositAmount = 1000 * 1e18;
        asset.mint(user, depositAmount);

        vm.startPrank(user);
        asset.approve(address(treasury), depositAmount);
        treasury.deposit(depositAmount, user);
        vm.stopPrank();

        assertEq(treasury.balanceOf(user), depositAmount);
        (uint256 avgPrice, ) = treasury.positions(user);
        assertEq(avgPrice, 1 ether);
    }

    function testWeightedAveragePrice() public {
        // 1. Initial Deposit at 1:1 ratio
        uint256 amount1 = 1000 * 1e18;
        asset.mint(user, amount1);
        vm.startPrank(user);
        asset.approve(address(treasury), amount1 * 2);
        treasury.deposit(amount1, user);
        vm.stopPrank();

        // 2. Simulate price growth (Vault gets more assets without minting shares)
        asset.mint(address(treasury), 500 * 1e18); // Vault now has 1500 assets for 1000 shares (1.5 price)

        // 3. Second Deposit at higher price
        uint256 amount2 = 750 * 1e18; // At 1.5 price, this should give 500 shares
        asset.mint(user, amount2);
        vm.startPrank(user);
        asset.approve(address(treasury), amount2);
        treasury.deposit(amount2, user);
        vm.stopPrank();

        // 4. Check Weighted Average
        // Old: 1000 shares @ 1.0
        // New: 500 shares @ 1.5
        // Avg: ((1000 * 1.0) + (500 * 1.5)) / 1500 = 1750 / 1500 = 1.166...
        uint256 expectedAvg = uint256(1750 * 1e18) / 1500;
        (uint256 avgPrice, uint256 totalShares) = treasury.positions(user);
        assertEq(avgPrice, expectedAvg);
        assertEq(totalShares, 1500 * 1e18);
    }

    function testTaxWithholdingOnProfit() public {
        uint256 depositAmount = 1000 * 1e18;
        asset.mint(user, depositAmount);

        vm.startPrank(user);
        asset.approve(address(treasury), depositAmount);
        treasury.deposit(depositAmount, user);
        vm.stopPrank();

        // Growth: 1000 -> 2000 (100% profit)
        asset.mint(address(treasury), 1000 * 1e18);

        // Withdraw all
        vm.startPrank(user);
        uint256 shares = treasury.balanceOf(user);
        treasury.redeem(shares, user, user);
        vm.stopPrank();

        assertApproxEqAbs(asset.balanceOf(user), 1800 * 1e18, 1);
        assertApproxEqAbs(asset.balanceOf(address(vault)), 200 * 1e18, 1);
    }

    function testEmergencyMode() public {
        vm.startPrank(admin);
        treasury.grantRole(treasury.RISK_MANAGER_ROLE(), admin);
        treasury.toggleEmergencyMode(true);
        vm.stopPrank();

        uint256 depositAmount = 1000 * 1e18;
        asset.mint(user, depositAmount);

        vm.startPrank(user);
        asset.approve(address(treasury), depositAmount);
        vm.expectRevert("LGL: Emergency Mode Active");
        treasury.deposit(depositAmount, user);
        vm.stopPrank();
    }
}
