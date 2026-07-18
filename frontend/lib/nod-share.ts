import { generateHash } from "@/lib/utils";

export interface NodSharePackage {
    version: "nod-share-v1";
    nodId: string;
    cid?: string;
    transactionHash?: string;
    sealedContentHash: string;
    plaintextHash: string;
    text: string;
    creator: string;
    counterparties: string[];
    status: string;
    createdAt: string;
    expiresAt?: number;
    ipfsEncrypted?: boolean;
    cautionAmount?: number;
    nonceHex?: string;
    commitmentHex?: string;
}

function encodeBase64Url(value: string): string {
    return btoa(unescape(encodeURIComponent(value)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return decodeURIComponent(escape(atob(padded)));
}

export async function buildNodSharePackage(nod: {
    id: string;
    cid?: string;
    transactionHash?: string;
    hash: string;
    text: string;
    creator: string;
    counterparties: string[];
    counterparty?: string;
    status: string;
    createdAt: string;
    expiresAt?: number;
    ipfsEncrypted?: boolean;
    cautionAmount?: number;
    nonceHex?: string;
    commitmentHex?: string;
}): Promise<NodSharePackage> {
    return {
        version: "nod-share-v1",
        nodId: nod.id,
        cid: nod.cid,
        transactionHash: nod.transactionHash,
        sealedContentHash: nod.hash,
        plaintextHash: await generateHash(nod.text),
        text: nod.text,
        creator: nod.creator,
        counterparties: nod.counterparties?.length ? nod.counterparties : nod.counterparty ? [nod.counterparty] : [],
        status: nod.status,
        createdAt: nod.createdAt,
        expiresAt: nod.expiresAt,
        ipfsEncrypted: nod.ipfsEncrypted,
        cautionAmount: nod.cautionAmount,
        nonceHex: nod.nonceHex,
        commitmentHex: nod.commitmentHex,
    };
}

export function encodeNodSharePackage(pkg: NodSharePackage): string {
    return `nodshare:${encodeBase64Url(JSON.stringify(pkg))}`;
}

export function parseNodSharePackage(input: string): NodSharePackage | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith("nodshare:")) return null;

    try {
        const parsed = JSON.parse(decodeBase64Url(trimmed.slice("nodshare:".length)));
        if (parsed?.version !== "nod-share-v1" || typeof parsed.text !== "string") {
            return null;
        }
        return parsed as NodSharePackage;
    } catch {
        return null;
    }
}

// ==========================================
// ZK & Gated Share API Client Helpers
// ==========================================

import { bytesToHex, hexToBytes } from "./ipfs-encryption";

/**
 * Encrypts a string payload with a randomly generated 256-bit AES-GCM key.
 */
export async function encryptPayloadWithRandomKey(plaintextStr: string): Promise<{ ciphertextHex: string; ivHex: string; keyHex: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey(
        "raw",
        keyBytes.buffer as ArrayBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
    const plaintext = new TextEncoder().encode(plaintextStr);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, plaintext.buffer as ArrayBuffer);
    return {
        ciphertextHex: bytesToHex(new Uint8Array(ciphertext)),
        ivHex: bytesToHex(iv),
        keyHex: bytesToHex(keyBytes)
    };
}

/**
 * Decrypts an AES-GCM encrypted payload using the provided key and IV.
 */
export async function decryptPayloadWithKey(ciphertextHex: string, ivHex: string, keyHex: string): Promise<string> {
    const iv = hexToBytes(ivHex);
    const keyBytes = hexToBytes(keyHex);
    const key = await crypto.subtle.importKey(
        "raw",
        keyBytes.buffer as ArrayBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
    const ciphertext = hexToBytes(ciphertextHex);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, ciphertext.buffer as ArrayBuffer);
    return new TextDecoder().decode(decrypted);
}

/**
 * Registers a ZK-based share package with the backend.
 */
export async function registerZkShare(params: {
    nodId: string;
    zkProof: any;
    publicInputs: any;
}): Promise<string> {
    const res = await fetch("/api/nods/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nodId: params.nodId,
            type: "zk",
            zkProof: params.zkProof,
            publicInputs: params.publicInputs
        })
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to register ZK share");
    }
    
    const data = await res.json();
    return data.shareId;
}

/**
 * Registers a Gated-decryption share package with the backend.
 */
export async function registerGatedShare(params: {
    nodId: string;
    allowedAddress: string;
    encryptedPayload: string;
    iv: string;
    key: string;
    sharerAddress?: string;
}): Promise<string> {
    const res = await fetch("/api/nods/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nodId: params.nodId,
            type: "gated",
            allowedAddress: params.allowedAddress,
            encryptedPayload: params.encryptedPayload,
            iv: params.iv,
            key: params.key,
            sharerAddress: params.sharerAddress
        })
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to register Gated share");
    }
    
    const data = await res.json();
    return data.shareId;
}

