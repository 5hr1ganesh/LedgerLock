# LedgerLock: Decentralized Audit Workflow ⛓️🔍

This workflow implements the **Chainlink Runtime Environment (CRE)** logic for the LedgerLock Institutional Treasury.

## 🛠️ Features
- **Tax Reporter**: Monitors AUM and calculates expected tax liabilities using Tenderly pre-flight simulations.
- **Compliance Monitor**: Audits the `ComplianceRegistry` to ensure all institutional participants are KYC-verified.
- **Emergency Sentinel**: Monitors the `isEmergencyMode` state and logs critical risk alerts.

## 🚀 Deployment (Railway)
1. **Set Root Directory**: `LedgerLock-workflow`
2. **Environment Variables**:
   - `CRE_ETH_PRIVATE_KEY`: Your institutional auditor key.
   - `CRE_TARGET`: `staging-settings`
3. **Execution**: The workflow is auto-started via the included `Dockerfile` using the `cre workflow run` command.

## 🧪 Local Simulation
Run the following from the project root:
```bash
bun install
cre workflow simulate ./LedgerLock-workflow --target=staging-settings
```

---
*Powered by Chainlink Runtime Environment.*
