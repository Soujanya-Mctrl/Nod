export interface EncryptedIPFSPayload {
    encrypted: true;
    version: "nod-ipfs-aes-gcm-v1";
    algorithm: "AES-GCM";
    kdf: "SHA-256(wallet-signatures)";
    iv: string;
    ciphertext: string;
    participants: string[];
    signatureMessage: string;
}

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

export function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

export function buildAgreementEncryptionMessage(params: {
    agreementIdHex: string;
    creator: string;
    counterparties: string[];
    expiresAt: number;
}): string {
    const participants = [params.creator, ...params.counterparties].sort();
    return [
        "NOD encrypted IPFS agreement",
        `agreement:${params.agreementIdHex}`,
        `participants:${participants.join(",")}`,
        `expiresAt:${params.expiresAt}`,
    ].join("\n");
}

function normalizeSignature(signature: string | Uint8Array): Uint8Array {
    if (signature instanceof Uint8Array) return signature;

    const clean = signature.startsWith("0x") ? signature.slice(2) : signature;
    if (/^[0-9a-f]+$/i.test(clean) && clean.length % 2 === 0) {
        return hexToBytes(clean);
    }

    return new TextEncoder().encode(signature);
}

export async function deriveSharedKey(signatures: Array<string | Uint8Array>): Promise<CryptoKey> {
    const normalized = signatures
        .map((signature) => bytesToHex(normalizeSignature(signature)))
        .sort()
        .join(":");
    const keyMaterial = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`nod-ipfs-aes-gcm-v1:${normalized}`).buffer as ArrayBuffer,
    );

    return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptAgreementForIPFS(params: {
    agreementData: Record<string, unknown>;
    signatures: Array<string | Uint8Array>;
    participants: string[];
    signatureMessage: string;
}): Promise<EncryptedIPFSPayload> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sharedSecret = await deriveSharedKey(params.signatures);
    const plaintext = new TextEncoder().encode(JSON.stringify(params.agreementData));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, sharedSecret, plaintext.buffer as ArrayBuffer);

    return {
        encrypted: true,
        version: "nod-ipfs-aes-gcm-v1",
        algorithm: "AES-GCM",
        kdf: "SHA-256(wallet-signatures)",
        iv: bytesToHex(iv),
        ciphertext: bytesToHex(new Uint8Array(encrypted)),
        participants: params.participants,
        signatureMessage: params.signatureMessage,
    };
}

export function isEncryptedIPFSPayload(content: unknown): content is EncryptedIPFSPayload {
    return (
        typeof content === "object" &&
        content !== null &&
        (content as { encrypted?: unknown }).encrypted === true &&
        (content as { ciphertext?: unknown }).ciphertext !== undefined &&
        (content as { iv?: unknown }).iv !== undefined
    );
}
