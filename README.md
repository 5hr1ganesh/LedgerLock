# LedgerLock: Institutional Treasury OS 🛡️💼
**Institutional-grade safety and real-time auditing for on-chain treasuries.**

---

![LedgerLock Banner](https://raw.githubusercontent.com/5hr1ganesh/LedgerLock/main/LedgerLock-dashboard/src/logo.svg)

## 🚀 Overview
**LedgerLock** is a comprehensive institutional treasury operating system designed to bridge the gap between high-yield on-chain assets and the rigorous compliance/auditing requirements of traditional finance. 

By leveraging **Chainlink CRE (Runtime Environment)** for decentralized auditing and **Tenderly Virtual Mainnet** for high-fidelity execution, LedgerLock provides a "Source of Truth" that is both on-chain and independently verified off-chain.

> [!IMPORTANT]
> **Proof of Concept (PoC) Disclaimer**: This project is submitted as a technical proof of concept for the Convergence Hackathon. While it demonstrates core institutional logic and real-world integrations, it is not audited for production use.

---

## 🏗️ How it is Built
LedgerLock is built as a modular monorepo merging on-chain enforcement with decentralized auditing:
- **Smart Contracts**: Developed in **Solidity** using **Foundry**. Features a custom ERC4626-like Vault (`TreasuryManager`) gated by a `ComplianceRegistry`.
- **Decentralized Auditor**: Built using **Chainlink CRE SDK** in TypeScript. This workflow acts as an off-chain "Decentralized Oracle" monitoring treasury health.
- **Frontend Dashboard**: A premium **React** application built with **Vite** and **Tailwind CSS**.
- **Simulation Layer**: Powered by **Tenderly Virtual Mainnet** for high-fidelity state-warping simulations.

---

## ✨ "Remarkable" Features (Powered by Tenderly)
- **Yield Time Travel**: Simulate 180+ days of institutional yield growth in seconds using Tenderly's `evm_warp`.
- **Pre-Flight Tax Simulator**: Every withdrawal intent is first simulated against the Tenderly RPC to show net-assets-after-tax before signing.
- **Circuit Breaker**: Chainlink CRE monitors for risk discrepancies and can trigger an emergency mode to freeze assets.

---

## 📁 Project Structure
```bash
.
├── Contracts/              # Solidity Smart Contracts (Foundry)
├── LedgerLock-dashboard/    # React Frontend Dashboard (Vite)
└── LedgerLock-workflow/     # Chainlink CRE Workflow (TypeScript)
```

---

## ⛓️ Deployment Guide

### 1. Smart Contracts
```bash
cd Contracts
# See README.md in Contracts for full deployment scripts
forge script script/TenderlyShowcase.s.sol --rpc-url <YOUR_RPC> --broadcast
```

### 2. Frontend (Vercel)
- Set **Root Directory** to `LedgerLock-dashboard`.
- Vite will be auto-detected.

### 3. CRE Workflow (Railway)
- Set **Root Directory** to `LedgerLock-workflow`.
- Add Env Vars: `CRE_ETH_PRIVATE_KEY` and `CRE_TARGET=staging-settings`.
- Deployment is handled via the included `Dockerfile`.

---

## 🔗 Chainlink Integration
Our project uses **Chainlink Runtime Environment (CRE)** to implement a decentralized auditing layer.

**Key Logic**: [LedgerLock-workflow/main.ts](./LedgerLock-workflow/main.ts)
- **Tax Auditor**: Autonomous AUM monitoring.
- **Compliance Monitor**: Automated KYC verification.
- **Emergency Sentinel**: Reactive circuit-breaker monitoring.

---
**LedgerLock** - *Transforming Institutional Treasury Operations with Chainlink CRE & Tenderly.*
