import { ethers } from 'ethers';

export const RPC_URL = "https://virtual.rpc.tenderly.co/Virata/project/private/ConveRgencE-Hackathon--Project-Demo/da0e1c90-b4ad-4a50-8b07-050fcf2ce7e5";

export const ADDRESSES = {
    TREASURY: "0x7Ef2D5b0cA2CF1b912262A7f0e68d47Db5801b76",
    REGISTRY: "0x1FA278B7ADB3AF86d51Cbc42607898a6c1A2B742",
    VAULT: "0x7D29553b9d6E799c875b3a0AdEe6bA4c71833133",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    JUDGE: "0x90FbDd2951A4f1b7759f75Eb885b370ed8D14072"
};

// For Hackathon Simulation (Judge Access)
// Usually we'd use a Wallet like MetaMask, but for a one-click judge demo, 
// we use the TestBurner key from the simulation.
export const PRIVATE_KEY = "0x790fdfba02418733f1a6772d5fa7e76d98b2077291a4f466d6241c6d22b744f3";

export const ABIS = {
    TREASURY: [
        "function totalAssets() view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function previewRedeem(uint256) view returns (uint256)",
        "function deposit(uint256, address) returns (uint256)",
        "function redeem(uint256, address, address) returns (uint256)",
        "function positions(address) view returns (uint256 avgEntryPrice, uint256 totalShares)",
        "function balanceOf(address) view returns (uint256)",
        "function isEmergencyMode() view returns (bool)",
        "function toggleEmergencyMode(bool) returns ()",
        "event EntryPriceUpdated(address indexed user, uint256 newPrice)",
        "event EmergencyModeUpdated(bool status)"
    ],
    REGISTRY: [
        "function isVerified(address) view returns (bool)",
        "function kycExpiration(address) view returns (uint256)",
        "function updateStatus(address, bool, uint256) returns ()",
        "event StatusUpdated(address indexed user, bool status, uint256 expiration)"
    ],
    VAULT: [
        "event TaxWithdrawn(address indexed user, uint256 amount)"
    ],
    USDC: [
        "function allowance(address, address) view returns (uint256)",
        "function approve(address, uint256) returns (bool)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)"
    ]
};
