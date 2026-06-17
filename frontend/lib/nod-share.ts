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
