import {
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
    formatUnits
} from "viem";

/**
 * @title TenderlyHelper
 * @notice A utility class to expose Tenderly's "Remarkable" features
 * to off-chain workflows using CRE-native capabilities.
 */
export class TenderlyHelper {
    private rpcUrl: string;

    constructor(rpcUrl: string) {
        this.rpcUrl = rpcUrl;
    }

    // Helper to convert string to hex for CRE base64 utility
    private stringToHex(str: string): string {
        let hex = '0x';
        for (let i = 0; i < str.length; i++) {
            hex += str.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hex;
    }

    /**
     * YIELD TIME TRAVEL: Increases the EVM time on the Tenderly Virtual Testnet.
     */
    async warpTime(runtime: Runtime<any>, seconds: number) {
        const httpClient = new cre.capabilities.HTTPClient();

        const fetchData = (requester: any) => {
            const bodyStr = JSON.stringify({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [`0x${seconds.toString(16)}`],
                id: 1
            });

            return requester.sendRequest({
                url: this.rpcUrl,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: hexToBase64(this.stringToHex(bodyStr))
            }).result();
        };

        const response = await httpClient.sendRequest(runtime, fetchData, (results: any[]) => results[0])({}).result();

        if (!ok(response)) {
            runtime.log("Warp Time Failed");
        } else {
            runtime.log(`Warped forward by ${seconds} seconds.`);
        }
    }

    /**
     * PRE-FLIGHT TAX SIMULATOR: Simulates a withdrawal to see the tax impact.
     */
    async previewWithdrawTax(runtime: Runtime<any>, treasuryAddress: string, userAddress: string, shares: string) {
        const httpClient = new cre.capabilities.HTTPClient();

        const abi = [
            { name: "redeem", type: "function", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "shares" }, { type: "address", name: "receiver" }, { type: "address", name: "owner" }], outputs: [{ type: "uint256", name: "assets" }] }
        ] as const;

        const fetchData = (requester: any) => {
            const data = encodeFunctionData({
                abi,
                functionName: "redeem",
                args: [BigInt(shares), userAddress as Address, userAddress as Address]
            });

            const bodyStr = JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                    from: userAddress,
                    to: treasuryAddress,
                    data: data
                }, "latest"],
                id: 1
            });

            return requester.sendRequest({
                url: this.rpcUrl,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: hexToBase64(this.stringToHex(bodyStr))
            }).result();
        };

        const response = await httpClient.sendRequest(runtime, fetchData, (results: any[]) => results[0])({}).result();

        if (!ok(response)) {
            throw new Error("Simulation HTTP Request Failed");
        }

        const payload = json(response) as any;
        if (payload.error) {
            throw new Error(`Simulation Error: ${payload.error.message}`);
        }

        const assetsAfterTax = decodeFunctionResult({
            abi,
            functionName: "redeem",
            data: payload.result
        });

        return {
            netAssetsExpected: formatUnits(assetsAfterTax, 6),
            note: "Pre-flight simulation successful."
        };
    }
}
