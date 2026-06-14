import circuit from "../../circuits/target/nod_circuits.json";

let initialized = false;
let noir: any;
let backend: any;

/**
 * Helper to convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Helper to convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * Initializes the WASM modules for ACVM and noirc_abi,
 * along with the Barretenberg backend.
 */
async function initZk() {
    if (initialized) return;

    if (typeof window === "undefined") {
        throw new Error("ZK proof generation and verification can only be executed in the browser context.");
    }

    try {
        // Dynamic imports of WASM wrappers to bypass SSR
        // @ts-ignore
        const initACVM = (await import("@noir-lang/acvm_js")).default;
        // @ts-ignore
        const initNoirC = (await import("@noir-lang/noirc_abi")).default;

        const acvmUrl = "/acvm_js_bg.wasm";
        const noircUrl = "/noirc_abi_wasm_bg.wasm";

        // Initialize ACVM and ABI compiler WASM modules
        await Promise.all([
            initACVM(fetch(acvmUrl)),
            initNoirC(fetch(noircUrl))
        ]);

        // Load Aztec Barretenberg backend
        const { UltraHonkBackend } = await import("@aztec/bb.js");
        const { Noir } = await import("@noir-lang/noir_js");

        // Instantiate Noir compiler compiler outputs
        noir = new Noir(circuit as any);
        backend = new UltraHonkBackend(circuit.bytecode);

        initialized = true;
    } catch (error) {
        console.error("Failed to initialize ZK proof engine:", error);
        throw error;
    }
}

export interface ZkProofInputs {
    agreementTextHash: Uint8Array; // 32 bytes
    initiatorAddress: string;       // Stellar G... address
    createdAt: number;              // unix timestamp in seconds
    nonce: Uint8Array;              // 32 bytes
    commitment: Uint8Array;         // 32 bytes
    statusNodded: boolean;
    expiresAt: number;
    timestamp: number;
}

/**
 * Generates a zero-knowledge SNARK proof (UltraHonk) using Noir in-browser
 */
export async function generateProof(inputs: ZkProofInputs): Promise<any> {
    await initZk();

    // Decode Stellar initiator address to raw 32-byte public key
    const { StrKey } = await import("@stellar/stellar-sdk");
    const initiatorBytes = Array.from(StrKey.decodeEd25519PublicKey(inputs.initiatorAddress));

    // Convert createdAt (unix timestamp) to 8-byte big-endian byte array
    const createdAtBytes = new Uint8Array(8);
    const view = new DataView(createdAtBytes.buffer);
    view.setBigUint64(0, BigInt(inputs.createdAt), false); // Big endian

    const noirInputs = {
        agreement_text_hash: Array.from(inputs.agreementTextHash),
        initiator_bytes: initiatorBytes,
        created_at_bytes: Array.from(createdAtBytes),
        nonce: Array.from(inputs.nonce),
        commitment: Array.from(inputs.commitment),
        status_nodded: inputs.statusNodded,
        expires_at: inputs.expiresAt,
        timestamp: inputs.timestamp,
    };

    console.log("[ZK-Prover] Executing circuit with inputs:", {
        ...noirInputs,
        agreement_text_hash: bytesToHex(inputs.agreementTextHash),
        initiator_bytes: bytesToHex(new Uint8Array(initiatorBytes)),
        nonce: bytesToHex(inputs.nonce),
        commitment: bytesToHex(inputs.commitment),
    });

    const { witness } = await noir.execute(noirInputs);
    
    console.log("[ZK-Prover] Generating UltraHonk proof...");
    const proof = await backend.generateProof(witness);
    
    console.log("[ZK-Prover] Proof generated successfully!");
    return proof;
}

/**
 * Verifies an UltraHonk proof using the Barretenberg WASM verifier in-browser
 */
export async function verifyProof(proof: any): Promise<boolean> {
    await initZk();
    console.log("[ZK-Verifier] Verifying UltraHonk proof...");
    const isValid = await backend.verifyProof(proof);
    console.log(`[ZK-Verifier] Proof verification result: ${isValid ? "VALID" : "INVALID"}`);
    return isValid;
}
