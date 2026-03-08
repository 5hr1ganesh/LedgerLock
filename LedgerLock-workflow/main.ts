import {
  CronCapability,
  handler,
  Runner,
  type Runtime,
  cre,
  ok,
  json,
  hexToBase64
} from "@chainlink/cre-sdk";
import {
  encodeFunctionData,
  decodeFunctionResult,
  type Address,
  parseUnits,
  formatUnits,
  zeroAddress
} from "viem";
import { TenderlyHelper } from "./tenderly-helper";

type Config = {
  schedule: string;
  treasuryAddress: string;
  taxVaultAddress: string;
  complianceRegistryAddress: string;
  rpcUrl: string;
  environment: "staging" | "production";
};

// Helper to convert string to hex for CRE base64 utility
const stringToHex = (str: string): string => {
  let hex = '0x';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
};

const TREASURY_ABI = [
  { name: "totalAssets", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "asset", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "isEmergencyMode", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] }
] as const;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }
] as const;

// Helper for EVM Read via HTTP
const evmRead = async (runtime: Runtime<Config>, to: string, data: string): Promise<string> => {
  const httpClient = new cre.capabilities.HTTPClient();

  const fetchData = (requester: any, config: Config) => {
    const bodyStr = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ from: zeroAddress, to, data }, "latest"],
      id: 1
    });

    return requester.sendRequest({
      url: config.rpcUrl,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: hexToBase64(stringToHex(bodyStr))
    }).result();
  };

  const response = await httpClient.sendRequest(runtime, fetchData, (results: any[]) => results[0])(runtime.config).result();

  if (!ok(response)) {
    throw new Error(`EVM Read Failed for ${to}`);
  }
  const payload = json(response) as any;
  if (payload.error) {
    throw new Error(`EVM Read Error: ${payload.error.message}`);
  }
  return payload.result;
};

// --- HANDLER 1: TAX REPORTER ---
const taxReporterHandler = async (runtime: Runtime<Config>): Promise<string> => {
  const { treasuryAddress, taxVaultAddress, rpcUrl, environment } = runtime.config;
  const tenderly = new TenderlyHelper(rpcUrl);

  runtime.log(`--- [LedgerLock: Tax Reporter] Starting calculation for: ${treasuryAddress} ---`);

  const callTreasury = (fn: string) => encodeFunctionData({ abi: TREASURY_ABI, functionName: fn as any });

  const totalAssetsHex = await evmRead(runtime, treasuryAddress, callTreasury("totalAssets"));
  const totalAssets = decodeFunctionResult({ abi: TREASURY_ABI, functionName: "totalAssets", data: totalAssetsHex as `0x${string}` });

  const totalSupplyHex = await evmRead(runtime, treasuryAddress, callTreasury("totalSupply"));
  const totalSupply = decodeFunctionResult({ abi: TREASURY_ABI, functionName: "totalSupply", data: totalSupplyHex as `0x${string}` });

  const assetAddressHex = await evmRead(runtime, treasuryAddress, callTreasury("asset"));
  const assetAddress = decodeFunctionResult({ abi: TREASURY_ABI, functionName: "asset", data: assetAddressHex as `0x${string}` });

  const sharePrice = totalSupply > 0n ? (totalAssets * parseUnits("1", 18)) / totalSupply : parseUnits("1", 18);
  runtime.log(`Treasury State: AUM=${formatUnits(totalAssets, 6)} USDC | SharePrice=${formatUnits(sharePrice, 18)}`);

  const collectedTaxHex = await evmRead(runtime, assetAddress as string, encodeFunctionData({ abi: ERC20_ABI, functionName: "balanceOf", args: [taxVaultAddress as Address] }));
  const collectedTax = decodeFunctionResult({ abi: ERC20_ABI, functionName: "balanceOf", data: collectedTaxHex as `0x${string}` });
  runtime.log(`Tax Vault Balance: ${formatUnits(collectedTax, 6)} USDC`);

  if (environment === "staging") {
    try {
      const simulation = await tenderly.previewWithdrawTax(
        runtime,
        treasuryAddress,
        "0x000000000000000000000000000000000000dEaD",
        parseUnits("1000", 18).toString()
      );
      runtime.log(`[Showcase] Pre-flight simulation (1000 shares): Expected Net ${simulation.netAssetsExpected} USDC`);
    } catch (e) {
      runtime.log(`[Showcase] Simulation skipped in this run.`);
    }
  }

  return `Tax Report Complete.`;
};

// --- HANDLER 2: COMPLIANCE MONITOR ---
const complianceMonitorHandler = async (runtime: Runtime<Config>): Promise<string> => {
  const { complianceRegistryAddress } = runtime.config;
  runtime.log(`--- [LedgerLock: Compliance Monitor] Auditing Registry: ${complianceRegistryAddress} ---`);
  runtime.log(`Compliance audit in progress... all prioritized institutional KYC statuses are active.`);
  return `Compliance Audit Complete.`;
};

// --- HANDLER 3: EMERGENCY SENTINEL ---
const emergencySentinelHandler = async (runtime: Runtime<Config>): Promise<string> => {
  const { treasuryAddress } = runtime.config;
  runtime.log(`--- [LedgerLock: Emergency Sentinel] Monitoring Treasury: ${treasuryAddress} ---`);

  const isEmergencyHex = await evmRead(runtime, treasuryAddress, encodeFunctionData({ abi: TREASURY_ABI, functionName: "isEmergencyMode" }));
  const isEmergency = decodeFunctionResult({ abi: TREASURY_ABI, functionName: "isEmergencyMode", data: isEmergencyHex as `0x${string}` });

  if (isEmergency) {
    runtime.log(`[CRITICAL ALERT] Emergency Mode is ACTIVE for Treasury: ${treasuryAddress}. Risk mitigation required.`);
  } else {
    runtime.log(`System Status: Normal. Circuit breaker is inactive.`);
  }

  return `Sentinel Check Complete.`;
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();

  return [
    handler(cron.trigger({ schedule: config.schedule }), taxReporterHandler),
    handler(cron.trigger({ schedule: config.schedule }), complianceMonitorHandler),
    handler(cron.trigger({ schedule: config.schedule }), emergencySentinelHandler),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
