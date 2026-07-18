import { generateProof, verifyProof, bytesToHex, hexToBytes } from "./noir-zk";
import { StrKey } from "@stellar/stellar-sdk";

export interface ZKPublicInputs {
    commitment: string;        // 32-byte hex
    initiatorPubKey: string;   // Stellar G-address
    counterpartyPubKey: string; // Stellar G-address
    statusNodded: boolean;
    expiresAt: number;
}

export interface ZKProof {
    proofHex: string;          // Hex encoded proof bytes
    receiptHash: string;       // SHA-256 hash of proof bytes and public inputs
    publicInputs: ZKPublicInputs;
    generatedAt: number;
    circuitName: string;
    isSimulated: boolean;
    realProof: any;            // The raw proof object returned by bb.js
}

export interface ZKVerificationResult {
    valid: boolean;
    checks: {
        name: string;
        passed: boolean;
        detail: string;
    }[];
    verifiedAt: number;
}

/**
 * SHA-256 helper for browser environments
 */
async function computeSha256(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data as any);
    return new Uint8Array(hashBuffer);
}

/**
 * Generates a real ZK Proof using Noir & Barretenberg (UltraHonk)
 */
export async function generateZKProof(params: {
    text: string;
    initiator: string;
    counterparty: string;
    timestamp: number;
    expiresAt: number;
    status: string;
    contentHash: string;
    nonceHex?: string;
}): Promise<ZKProof> {
    const { text, initiator, counterparty, timestamp, expiresAt, status } = params;

    console.log("[ZK-Wrapper] Initializing ZK proof generation for Nod...");

    // 1. Compute SHA-256 of the agreement text (private input)
    const textBytes = new TextEncoder().encode(text);
    const agreementTextHash = await computeSha256(textBytes);

    // 2. Decode initiator public G-address to 32 bytes (private input)
    const initiatorBytes = StrKey.decodeEd25519PublicKey(initiator);

    // 3. Convert timestamp to 8-byte big-endian (private input)
    const createdAtBytes = new Uint8Array(8);
    const view = new DataView(createdAtBytes.buffer);
    view.setBigUint64(0, BigInt(timestamp), false);

    // 4. Get or generate random 32-byte nonce (private input)
    let nonce: Uint8Array;
    if (params.nonceHex) {
        nonce = hexToBytes(params.nonceHex);
    } else {
        console.warn("[ZK-Wrapper] No nonceHex provided, generating a new random one.");
        nonce = crypto.getRandomValues(new Uint8Array(32));
    }

    // 5. Compute commitment = SHA-256(agreement_text_hash || initiator_bytes || created_at_bytes || nonce)
    const preimage = new Uint8Array(104);
    preimage.set(agreementTextHash, 0);
    preimage.set(initiatorBytes, 32);
    preimage.set(createdAtBytes, 64);
    preimage.set(nonce, 72);

    const commitmentBytes = await computeSha256(preimage);
    const commitmentHex = bytesToHex(commitmentBytes);

    const isNodded = status === "awaiting" || status === "nodded" || status === "completed" || status === "delivered" || status === "disputed";

    // 6. Generate the actual cryptographic proof
    const realProof = await generateProof({
        agreementTextHash,
        initiatorAddress: initiator,
        createdAt: timestamp,
        nonce,
        commitment: commitmentBytes,
        statusNodded: isNodded,
        expiresAt: expiresAt,
        timestamp: timestamp,
    });

    const proofHex = bytesToHex(realProof.proof);

    if (!(realProof.proof instanceof Uint8Array) || realProof.proof.length === 0) {
        throw new Error("ZK backend returned an empty proof.");
    }

    if (realProof.proof.every((byte: number) => byte === 0)) {
        throw new Error("ZK backend returned an invalid all-zero proof.");
    }

    const publicInputs: ZKPublicInputs = {
        commitment: commitmentHex,
        initiatorPubKey: initiator,
        counterpartyPubKey: counterparty,
        statusNodded: isNodded,
        expiresAt: expiresAt,
    };

    const publicInputBytes = new TextEncoder().encode(JSON.stringify(publicInputs));
    const receiptPreimage = new Uint8Array(realProof.proof.length + publicInputBytes.length);
    receiptPreimage.set(realProof.proof, 0);
    receiptPreimage.set(publicInputBytes, realProof.proof.length);
    const receiptHash = bytesToHex(await computeSha256(receiptPreimage));

    return {
        proofHex,
        receiptHash,
        publicInputs,
        generatedAt: Date.now(),
        circuitName: "nod_circuits (Noir v1.0.0-beta.20, bb.js 5.0.0-nightly.20260324)",
        isSimulated: false,
        realProof,
    };
}

/**
 * Verifies a ZK proof against the public inputs and constraints
 */
export async function verifyZKProof(proof: ZKProof): Promise<ZKVerificationResult> {
    const checks: ZKVerificationResult["checks"] = [];
    const { publicInputs, realProof } = proof;

    // Check 1: Commitment format
    const cleanCommitment = publicInputs.commitment.startsWith("0x")
        ? publicInputs.commitment.slice(2)
        : publicInputs.commitment;
    const commitmentValid = /^[0-9a-fA-F]{64}$/.test(cleanCommitment);
    checks.push({
        name: "Commitment Hash Format",
        passed: commitmentValid,
        detail: commitmentValid
            ? `Valid 32-byte hex commitment: 0x${cleanCommitment.slice(0, 12)}...`
            : "Invalid commitment format — expected 32-byte hex",
    });

    // Check 2: Initiator public key format
    const initiatorValid = publicInputs.initiatorPubKey.length === 56 && publicInputs.initiatorPubKey.startsWith("G");
    checks.push({
        name: "Initiator Address format",
        passed: initiatorValid,
        detail: initiatorValid
            ? `Valid G-address: ${publicInputs.initiatorPubKey.slice(0, 8)}...${publicInputs.initiatorPubKey.slice(-4)}`
            : "Invalid Stellar public key format",
    });

    // Check 3: Expiry validation
    const now = Math.floor(Date.now() / 1000);
    const notExpired = publicInputs.expiresAt === 0 || publicInputs.expiresAt > now;
    checks.push({
        name: "Agreement Expiry",
        passed: notExpired,
        detail: notExpired
            ? publicInputs.expiresAt === 0
                ? "No expiry date set (ongoing)"
                : `Expires at: ${new Date(publicInputs.expiresAt * 1000).toLocaleDateString()}`
            : `Expired at: ${new Date(publicInputs.expiresAt * 1000).toLocaleDateString()}`,
    });

    // Check 4: Status is Nodded
    checks.push({
        name: "Contract Status Constraint",
        passed: publicInputs.statusNodded,
        detail: publicInputs.statusNodded
            ? "Agreement status is active on-chain (Awaiting/Nodded/Completed/Delivered/Disputed)"
            : "Agreement is not in an active status (cannot verify)",
    });

    // Check 5: Cryptographic proof verification using Barretenberg WASM
    let cryptographicValid = false;
    let detailMsg = "";
    try {
        cryptographicValid = await verifyProof(realProof);
        detailMsg = cryptographicValid
            ? "UltraHonk SNARK proof verified successfully using Barretenberg WASM backend"
            : "Cryptographic proof invalid or constraints violated";
    } catch (err: any) {
        console.error("Proof verification crashed:", err);
        detailMsg = `Verification error: ${err.message || err}`;
    }

    checks.push({
        name: "Cryptographic Proof Integrity",
        passed: cryptographicValid,
        detail: detailMsg,
    });

    const allPassed = checks.every((c) => c.passed);

    return {
        valid: allPassed,
        checks,
        verifiedAt: Date.now(),
    };
}
