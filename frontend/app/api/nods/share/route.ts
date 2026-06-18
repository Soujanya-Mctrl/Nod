import { NextResponse } from "next/server";
import crypto from "crypto";

// Use global store so it survives hot reloading during local development
const globalShares = global as typeof globalThis & {
    sharesStore?: Map<string, any>;
};

if (!globalShares.sharesStore) {
    globalShares.sharesStore = new Map<string, any>();
}

const sharesStore = globalShares.sharesStore;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { nodId, type, zkProof, publicInputs, allowedAddress, encryptedPayload, iv, key } = body;

        if (!nodId || !type) {
            return NextResponse.json({ error: "Missing required fields: nodId, type" }, { status: 400 });
        }

        if (type !== "zk" && type !== "gated") {
            return NextResponse.json({ error: "Invalid share type. Must be 'zk' or 'gated'" }, { status: 400 });
        }

        const shareId = crypto.randomUUID();
        const timestamp = Math.floor(Date.now() / 1000);

        if (type === "zk") {
            if (!zkProof || !publicInputs) {
                return NextResponse.json({ error: "Missing zkProof or publicInputs for ZK share" }, { status: 400 });
            }
            sharesStore.set(shareId, {
                shareId,
                type,
                nodId,
                zkProof,
                publicInputs,
                createdAt: timestamp
            });
        } else {
            if (!allowedAddress || !encryptedPayload || !iv || !key) {
                return NextResponse.json({ error: "Missing fields for Gated share: allowedAddress, encryptedPayload, iv, key" }, { status: 400 });
            }
            sharesStore.set(shareId, {
                shareId,
                type,
                nodId,
                allowedAddress,
                encryptedPayload,
                iv,
                key, // Decryption key (kept private, returned only on signature challenge)
                createdAt: timestamp
            });
        }

        console.log(`[Share API] Registered ${type} share with ID: ${shareId}`);
        return NextResponse.json({ success: true, shareId });
    } catch (err: any) {
        console.error("Failed to register share package:", err);
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const shareId = searchParams.get("shareId");

    if (!shareId) {
        return NextResponse.json({ error: "Missing shareId parameter" }, { status: 400 });
    }

    const record = sharesStore.get(shareId);
    if (!record) {
        return NextResponse.json({ error: "Share package not found" }, { status: 404 });
    }

    // Return the appropriate payload (hide the decryption key for Gated shares)
    if (record.type === "zk") {
        return NextResponse.json({
            shareId: record.shareId,
            type: record.type,
            nodId: record.nodId,
            zkProof: record.zkProof,
            publicInputs: record.publicInputs,
            createdAt: record.createdAt
        });
    } else {
        return NextResponse.json({
            shareId: record.shareId,
            type: record.type,
            nodId: record.nodId,
            allowedAddress: record.allowedAddress,
            encryptedPayload: record.encryptedPayload,
            iv: record.iv,
            createdAt: record.createdAt
        });
    }
}
