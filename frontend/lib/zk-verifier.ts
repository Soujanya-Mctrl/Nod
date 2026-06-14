/**
 * ZK Proof Generation & Verification (Client-Side Demo)
 * 
 * This module demonstrates the concept of Zero-Knowledge proof verification
 * for Nod agreements. In production, this would use the Noir circuit (circuits/src/main.nr)
 * compiled to WASM for in-browser proving.
 * 
 * Current implementation uses SHA-256-based commitments to simulate the ZK flow:
 * 1. Prover constructs witness from private inputs
 * 2. Prover generates a commitment (proof) from the witness
 * 3. Verifier checks that the commitment matches the public inputs
 * 
 * The Noir circuit verifies:
 * - sig1 (initiator Ed25519 signature) over the commitment
 * - sig2 (counterparty Ed25519 signature) over the commitment
 * - status_nodded == true
 * - timestamp < expires_at
 */

export interface ZKPublicInputs {
    commitment: string;        // 32-byte hex — hash of (text, timestamp, nonce)
    initiatorPubKey: string;   // Stellar public key of initiator
    counterpartyPubKey: string; // Stellar public key of counterparty
    statusNodded: boolean;
    expiresAt: number;
}

export interface ZKProof {
    proofHex: string;          // The generated proof bytes (hex)
    publicInputs: ZKPublicInputs;
    generatedAt: number;
    circuitName: string;
    isSimulated: boolean;
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
 * SHA-256 hash helper (browser-native)
 */
async function sha256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a deterministic nonce from agreement parameters
 */
async function generateNonce(text: string, initiator: string, timestamp: number): Promise<string> {
    return sha256(`nonce:${text}:${initiator}:${timestamp}:${Math.floor(timestamp / 1000)}`);
}

/**
 * Generate a ZK proof for a Nod agreement.
 * 
 * This demonstrates the proving flow:
 * 1. Private inputs: agreement text, timestamp, nonce, signatures
 * 2. Public inputs: commitment hash, public keys, status, expiry
 * 3. The proof attests: "I know the private inputs that produce this commitment,
 *    and both parties have signed it, and the agreement is active and not expired."
 * 
 * In production this would invoke the Noir WASM prover.
 */
export async function generateZKProof(params: {
    text: string;
    initiator: string;
    counterparty: string;
    timestamp: number;
    expiresAt: number;
    status: string;
    contentHash: string;
}): Promise<ZKProof> {
    const { text, initiator, counterparty, timestamp, expiresAt, status, contentHash } = params;

    // Step 1: Generate the nonce (private)
    const nonce = await generateNonce(text, initiator, timestamp);

    // Step 2: Compute the commitment = SHA-256(text | timestamp | nonce)
    // This is the public binding between private data and public proof
    const commitment = await sha256(`${text}|${timestamp}|${nonce}`);

    // Step 3: Simulate signature proofs
    // In production, these would be actual Ed25519 signatures verified inside the Noir circuit
    const sig1Proof = await sha256(`sig1:${initiator}:${commitment}`);
    const sig2Proof = await sha256(`sig2:${counterparty}:${commitment}`);

    // Step 4: Build the proof — hash of all witness elements
    // This simulates what the Noir prover would output: a compact proof
    // that attests to knowledge of all private inputs
    const proofPreimage = [
        commitment,
        sig1Proof,
        sig2Proof,
        nonce,
        status === "nodded" || status === "completed" || status === "delivered" ? "1" : "0",
        String(timestamp),
        String(expiresAt),
    ].join("|");

    const proofHex = await sha256(proofPreimage);

    // Step 5: Construct the public inputs (what the verifier sees)
    const publicInputs: ZKPublicInputs = {
        commitment,
        initiatorPubKey: initiator,
        counterpartyPubKey: counterparty,
        statusNodded: status === "nodded" || status === "completed" || status === "delivered",
        expiresAt,
    };

    return {
        proofHex,
        publicInputs,
        generatedAt: Date.now(),
        circuitName: "nod_circuits (Noir v0.30+)",
        isSimulated: true,
    };
}

/**
 * Verify a ZK proof against public inputs.
 * 
 * Checks:
 * 1. Commitment is a valid 32-byte hash
 * 2. Public keys are valid Stellar addresses
 * 3. Status is Nodded (agreement is active)
 * 4. Agreement is not expired
 * 5. Proof hash is structurally valid
 * 
 * In production, this would call the Noir verifier compiled to WASM.
 */
export async function verifyZKProof(proof: ZKProof): Promise<ZKVerificationResult> {
    const checks: ZKVerificationResult["checks"] = [];
    const { publicInputs, proofHex } = proof;

    // Check 1: Commitment format
    const commitmentValid = /^[0-9a-f]{64}$/.test(publicInputs.commitment);
    checks.push({
        name: "Commitment Hash",
        passed: commitmentValid,
        detail: commitmentValid
            ? `Valid SHA-256 commitment: 0x${publicInputs.commitment.slice(0, 16)}...`
            : "Invalid commitment format — expected 32-byte hex",
    });

    // Check 2: Initiator public key
    const initiatorValid = publicInputs.initiatorPubKey.length === 56 && publicInputs.initiatorPubKey.startsWith("G");
    checks.push({
        name: "Initiator Public Key",
        passed: initiatorValid,
        detail: initiatorValid
            ? `Valid Stellar Ed25519 key: ${publicInputs.initiatorPubKey.slice(0, 8)}...${publicInputs.initiatorPubKey.slice(-4)}`
            : "Invalid Stellar public key format",
    });

    // Check 3: Counterparty public key
    const counterpartyValid = publicInputs.counterpartyPubKey.length === 56 && publicInputs.counterpartyPubKey.startsWith("G");
    checks.push({
        name: "Counterparty Public Key",
        passed: counterpartyValid,
        detail: counterpartyValid
            ? `Valid Stellar Ed25519 key: ${publicInputs.counterpartyPubKey.slice(0, 8)}...${publicInputs.counterpartyPubKey.slice(-4)}`
            : "Invalid Stellar public key format",
    });

    // Check 4: Status is Nodded
    checks.push({
        name: "Agreement Status",
        passed: publicInputs.statusNodded,
        detail: publicInputs.statusNodded
            ? "Agreement is active (Nodded/Delivered/Completed)"
            : "Agreement is not in an active state",
    });

    // Check 5: Expiry check
    const now = Math.floor(Date.now() / 1000);
    const notExpired = publicInputs.expiresAt === 0 || publicInputs.expiresAt > now;
    checks.push({
        name: "Expiry Validation",
        passed: notExpired,
        detail: notExpired
            ? publicInputs.expiresAt === 0
                ? "No expiry set (ongoing agreement)"
                : `Expires at ${new Date(publicInputs.expiresAt * 1000).toLocaleString()}`
            : `Agreement expired at ${new Date(publicInputs.expiresAt * 1000).toLocaleString()}`,
    });

    // Check 6: Proof structure
    const proofValid = /^[0-9a-f]{64}$/.test(proofHex);
    checks.push({
        name: "Proof Integrity",
        passed: proofValid,
        detail: proofValid
            ? `Valid proof: 0x${proofHex.slice(0, 16)}...`
            : "Invalid proof format — expected 32-byte hex",
    });

    const allPassed = checks.every((c) => c.passed);

    return {
        valid: allPassed,
        checks,
        verifiedAt: Date.now(),
    };
}
