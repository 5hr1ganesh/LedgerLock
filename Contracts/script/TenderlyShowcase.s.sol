// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {TreasuryManager} from "../src/TreasuryManager.sol";
import {ComplianceRegistry} from "../src/ComplianceRegistry.sol";
import {TaxVault} from "../src/TaxVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TenderlyShowcase
 * @notice Simplified deployment script for LedgerLock.
 * Deploys the core suite and sets up basic institutional roles.
 */
contract TenderlyShowcase is Script, Test {
    // Mainnet USDC Address
    address constant USDC_ADDR = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function run() external {
        address user = 0x90FbDd2951A4f1b7759f75Eb885b370ed8D14072;

        vm.startBroadcast();

        console.log("--- DEPLOYING LEDGERLOCK CORE ---");

        ComplianceRegistry registry = new ComplianceRegistry();
        TaxVault vault = new TaxVault(user);

        TreasuryManager treasury = new TreasuryManager(
            IERC20(USDC_ADDR),
            "LedgerLock Institutional V2",
            "LL-V2",
            address(vault),
            address(registry)
        );

        vm.stopBroadcast();

        console.log("----------------------------------");
        console.log("DEPLOYMENT COMPLETE:");
        console.log("ComplianceRegistry:", address(registry));
        console.log("TaxVault:          ", address(vault));
        console.log("TreasuryManager:     ", address(treasury));
        console.log("----------------------------------");
        console.log("NEXT STEP: Fund the Treasury and User via Tenderly UI!");
    }
}
