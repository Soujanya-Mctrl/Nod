import { rpc, xdr, nativeToScVal, scValToNative, Address, TransactionBuilder, Account, Networks, BASE_FEE, Operation } from "@stellar/stellar-sdk";
import { CONTRACT_ID, STELLAR_TESTNET_RPC } from "./stellar";

/**
 * Parsed on-chain agreement data returned from the Soroban contract
 */
export interface OnChainAgreement {
    cid: string;
    initiator: string;
    counterparties: string[];
    status: number;
    statusLabel: string;
    createdAt: number;
    expiresAt: number;
    tokenAddress: string | null;
    cautionAmount: bigint;
    completedParties: string[];
    arbitrator: string | null;
    deliveredAt: number;
    commitment: string | null;
}

const STATUS_LABELS: Record<number, string> = {
    0: "Awaiting",
    1: "Nodded",
    2: "Completed",
    3: "Declined",
    4: "Expired",
    5: "Delivered",
    6: "Disputed",
};

/**
 * Convert a hex string to a Uint8Array (for agreement ID)
 */
function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16) || 0;
    }
    return bytes;
}

/**
 * Parse an ScVal address to a Stellar G-address string
 */
function parseScAddress(val: xdr.ScVal): string {
    try {
        return Address.fromScVal(val).toString();
    } catch {
        return val?.toString() || "";
    }
}

/**
 * Parse an ScVal string
 */
function parseScString(val: xdr.ScVal): string {
    try {
        if (val.switch().name === "scvString") {
            return val.str().toString();
        }
        return val?.toString() || "";
    } catch {
        return "";
    }
}

/**
 * Parse an ScVal u64 timestamp
 */
function parseScU64(val: xdr.ScVal): number {
    try {
        if (val.switch().name === "scvU64") {
            const raw = val.u64();
            return Number(raw.toString());
        }
        return 0;
    } catch {
        return 0;
    }
}

/**
 * Parse an ScVal i128
 */
function parseScI128(val: xdr.ScVal): bigint {
    try {
        if (val.switch().name === "scvI128") {
            const parts = val.i128();
            const hi = BigInt(parts.hi().toString());
            const lo = BigInt(parts.lo().toString());
            return (hi << BigInt(64)) | lo;
        }
        return BigInt(0);
    } catch {
        return BigInt(0);
    }
}

/**
 * Parse an ScVal Vec of addresses
 */
function parseScVecAddresses(val: xdr.ScVal): string[] {
    try {
        if (val.switch().name === "scvVec") {
            return (val.vec() || []).map((v: xdr.ScVal) => parseScAddress(v));
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * Parse a status enum value
 */
function parseScStatus(val: xdr.ScVal): number {
    try {
        if (val.switch().name === "scvU32") {
            return val.u32();
        }
        return 0;
    } catch {
        return 0;
    }
}

/**
 * Queries the Soroban contract's get_agreement function and returns parsed data.
 * Uses simulateTransaction to perform a read-only call without submitting a real tx.
 */
export async function queryAgreementOnChain(agreementIdHex: string): Promise<OnChainAgreement | null> {
    try {
        const server = new rpc.Server(STELLAR_TESTNET_RPC);
        const agreementBytes = hexToBytes(agreementIdHex);
        const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));

        // Dummy source account for simulation (never actually used on-chain)
        const sourceAccount = new Account(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            "0"
        );

        const op = Operation.invokeContractFunction({
            contract: CONTRACT_ID,
            function: "get_agreement",
            args: [scValAgreementId],
        });

        const tx = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
        })
            .addOperation(op)
            .setTimeout(30)
            .build();

        const simulateResponse = await server.simulateTransaction(tx);

        if ("error" in simulateResponse) {
            console.error("Simulation error:", (simulateResponse as any).error);
            return null;
        }

        const successResponse = simulateResponse as rpc.Api.SimulateTransactionSuccessResponse;
        if (!successResponse.result) {
            return null;
        }

        const resultXdr = successResponse.result.retval;
        
        if (!resultXdr || resultXdr.switch().name === "scvVoid") {
            return null;
        }

        return parseAgreementStruct(resultXdr);
    } catch (error) {
        console.error("Failed to query agreement on-chain:", error);
        return null;
    }
}

/**
 * Parse the Agreement struct from an ScVal (Soroban struct is returned as scvMap)
 */
function parseAgreementStruct(val: xdr.ScVal): OnChainAgreement | null {
    try {
        if (val.switch().name !== "scvMap") {
            return null;
        }

        const entries = val.map() || [];
        const fields: Record<string, xdr.ScVal> = {};
        
        for (const entry of entries) {
            const key = entry.key();
            let keyName = "";
            if (key.switch().name === "scvSymbol") {
                keyName = key.sym().toString();
            }
            fields[keyName] = entry.val();
        }

        const statusNum = parseScStatus(fields["status"]);

        let commitment: string | null = null;
        if (fields["commitment"]) {
            const nativeCommitment = scValToNative(fields["commitment"]);
            if (Buffer.isBuffer(nativeCommitment) || nativeCommitment instanceof Uint8Array) {
                commitment = Buffer.from(nativeCommitment).toString("hex");
            }
        }

        return {
            cid: parseScString(fields["cid"]),
            initiator: parseScAddress(fields["initiator"]),
            counterparties: parseScVecAddresses(fields["counterparties"]),
            status: statusNum,
            statusLabel: STATUS_LABELS[statusNum] || `Unknown (${statusNum})`,
            createdAt: parseScU64(fields["created_at"]),
            expiresAt: parseScU64(fields["expires_at"]),
            tokenAddress: fields["token_address"] ? parseScAddress(fields["token_address"]) : null,
            cautionAmount: fields["caution_amount"] ? parseScI128(fields["caution_amount"]) : BigInt(0),
            completedParties: fields["completed_parties"] ? parseScVecAddresses(fields["completed_parties"]) : [],
            arbitrator: fields["arbitrator"] ? parseScAddress(fields["arbitrator"]) : null,
            deliveredAt: fields["delivered_at"] ? parseScU64(fields["delivered_at"]) : 0,
            commitment,
        };
    } catch (error) {
        console.error("Failed to parse agreement struct:", error);
        return null;
    }
}

/**
 * Fetches IPFS content by CID from a public gateway
 */
export async function fetchIPFSContent(cid: string): Promise<Record<string, unknown> | null> {
    if (!cid || cid.startsWith("MOCK_CID_")) {
        return null;
    }

    const gateways = [
        `https://gateway.pinata.cloud/ipfs/${cid}`,
        `https://ipfs.io/ipfs/${cid}`,
        `https://cloudflare-ipfs.com/ipfs/${cid}`,
    ];

    for (const url of gateways) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            
            if (response.ok) {
                return await response.json();
            }
        } catch {
            continue;
        }
    }

    return null;
}

/**
 * Queries the Soroban contract for a stored proof hash.
 */
export async function queryProofHashOnChain(agreementIdHex: string): Promise<string | null> {
    try {
        const server = new rpc.Server(STELLAR_TESTNET_RPC);
        const agreementBytes = hexToBytes(agreementIdHex);
        const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));

        // Dummy source account for simulation
        const sourceAccount = new Account(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            "0"
        );

        const op = Operation.invokeContractFunction({
            contract: CONTRACT_ID,
            function: "get_proof_hash",
            args: [scValAgreementId],
        });

        const tx = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
        })
            .addOperation(op)
            .setTimeout(30)
            .build();

        const simulateResponse = await server.simulateTransaction(tx);

        if ("error" in simulateResponse) {
            console.error("Simulation error querying proof hash:", (simulateResponse as any).error);
            return null;
        }

        const successResponse = simulateResponse as rpc.Api.SimulateTransactionSuccessResponse;
        if (!successResponse.result) {
            return null;
        }

        const resultXdr = successResponse.result.retval;
        
        if (!resultXdr || resultXdr.switch().name === "scvVoid") {
            return null;
        }

        const nativeVal = scValToNative(resultXdr);
        if (Buffer.isBuffer(nativeVal) || nativeVal instanceof Uint8Array) {
            return Buffer.from(nativeVal).toString("hex");
        }

        return null;
    } catch (error) {
        console.error("Failed to query proof hash on-chain:", error);
        return null;
    }
}

/**
 * Queries the Soroban contract for all agreement IDs associated with a user address.
 */
export async function queryUserAgreementsOnChain(userAddress: string): Promise<string[]> {
    try {
        const server = new rpc.Server(STELLAR_TESTNET_RPC);
        const scValUser = new Address(userAddress).toScVal();

        const sourceAccount = new Account(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            "0"
        );

        const op = Operation.invokeContractFunction({
            contract: CONTRACT_ID,
            function: "get_user_agreements",
            args: [scValUser],
        });

        const tx = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
        })
            .addOperation(op)
            .setTimeout(30)
            .build();

        const simulateResponse = await server.simulateTransaction(tx);

        if ("error" in simulateResponse) {
            console.error("Simulation error querying user agreements:", (simulateResponse as any).error);
            return [];
        }

        const successResponse = simulateResponse as rpc.Api.SimulateTransactionSuccessResponse;
        if (!successResponse.result) {
            return [];
        }

        const resultXdr = successResponse.result.retval;
        
        if (!resultXdr || resultXdr.switch().name === "scvVoid") {
            return [];
        }

        const nativeVal = scValToNative(resultXdr);
        if (Array.isArray(nativeVal)) {
            return nativeVal.map((buf: any) => {
                if (Buffer.isBuffer(buf) || buf instanceof Uint8Array) {
                    return Buffer.from(buf).toString("hex");
                }
                return "";
            }).filter(Boolean);
        }

        return [];
    } catch (error) {
        console.error("Failed to query user agreements on-chain:", error);
        return [];
    }
}


