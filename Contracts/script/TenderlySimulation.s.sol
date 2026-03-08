// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {TreasuryManager} from "../src/TreasuryManager.sol";
import {ComplianceRegistry} from "../src/ComplianceRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDC is IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title TenderlySimulation
 * @notice Performs institutional yield and tax simulations on existing contracts.
 * Run this AFTER funding contracts via the Tenderly UI.
 */
contract TenderlySimulation is Script, Test {
    address constant USDC_ADDR = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function run() external {
        // --- INPUTS: Replace with your deployed addresses ---
        address treasuryAddr = vm.envAddress("TREASURY_ADDRESS");
        address user = 0x90FbDd2951A4f1b7759f75Eb885b370ed8D14072;

        TreasuryManager treasury = TreasuryManager(payable(treasuryAddr));
        ComplianceRegistry registry = ComplianceRegistry(
            address(treasury.complianceRegistry())
        );

        console.log("--- STARTING INSTITUTIONAL SIMULATION ---");

        vm.startBroadcast();

        // 1. Ensure User is KYC'd (if forking or redeploying)
        if (!registry.isVerified(user)) {
            console.log("Updating KYC status for user...");
            registry.updateStatus(user, true, block.timestamp + 365 days);
        }

        // 2. Initial Deposit (Assumes user already has USDC from Tenderly UI)
        IUSDC(USDC_ADDR).approve(address(treasury), 10000 * 1e6);
        treasury.deposit(10000 * 1e6, user);
        vm.stopBroadcast();
        console.log("Step 2: 10,000 USDC Deposit Successful at $1.00 index.");

        // 3. Yield Acceleration (Time Travel)
        console.log("Advancing time by 180 days...");
        vm.warp(block.timestamp + 180 days);
        // Note: Yield should be simulated by adding USDC to the Treasury via Tenderly UI

        uint256 totalAssets = treasury.totalAssets();
        console.log("Current Treasury AUM:", totalAssets / 1e6, "USDC");

        // 3. Blended Cost Basis (Second Deposit)
        // Give user more USDC via prank if needed, but UI is better
        vm.startBroadcast();
        IUSDC(USDC_ADDR).approve(address(treasury), 5000 * 1e6);
        treasury.deposit(5000 * 1e6, user);
        vm.stopBroadcast();

        (uint256 avgPrice, ) = treasury.positions(user);
        console.log("Step 3: Blended Cost Basis updated to:", avgPrice);

        // 4. Preview Redemption (Pre-flight Tax Check)
        uint256 shares = treasury.balanceOf(user);
        uint256 assetsWorth = treasury.previewRedeem(shares);
        console.log(
            "Step 4: Real-time Position Value:",
            assetsWorth / 1e6,
            "USDC"
        );

        console.log("--- SIMULATION COMPLETE ---");
    }
}
