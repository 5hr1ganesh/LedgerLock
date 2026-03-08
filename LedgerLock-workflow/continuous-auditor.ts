import { spawn } from 'child_process';

const WORKFLOW_DIR = "/Users/sgg/Documents/Web3/LedgerLock/LedgerLock-workflow";
const CRE_BIN = "/Users/sgg/.cre/bin/cre";

async function runSimulation(index: number) {
    return new Promise((resolve) => {
        console.log(`\n--- [CRE Auditor] Running Trigger Index ${index} ---`);
        const proc = spawn(CRE_BIN, [
            'workflow', 'simulate', './',
            '--target', 'staging-settings',
            '--non-interactive',
            '--trigger-index', index.toString(),
            '-R', './'
        ], { cwd: WORKFLOW_DIR });

        proc.stdout.on('data', (data) => process.stdout.write(data));
        proc.stderr.on('data', (data) => process.stderr.write(data));
        proc.on('close', resolve);
    });
}

async function start() {
    console.log("🚀 Starting Continuous LedgerLock Auditor...");
    console.log("This script will simulate a Decentralized Oracle Network (DON) running your auditing handlers every 15 seconds.");

    while (true) {
        // Run Sentinel first for safety
        await runSimulation(2); // Sentinel
        await runSimulation(0); // Tax Reporter
        await runSimulation(1); // Compliance Monitor

        console.log("\n[Auditor] Cycle complete. Sleeping for 15s...");
        await new Promise(r => setTimeout(r, 15000));
    }
}

start();
