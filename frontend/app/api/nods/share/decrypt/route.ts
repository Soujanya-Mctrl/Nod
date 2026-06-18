import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";

const globalShares = global as typeof globalThis & {
    sharesStore?: Map<string, any>;
};

const sharesStore = globalShares.sharesStore || new Map<string, any>();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { shareId, address, signature, challenge } = body;

        if (!shareId || !address || !signature || !challenge) {
            return NextResponse.json({ error: "Missing required fields: shareId, address, signature, challenge" }, { status: 400 });
        }

        const record = sharesStore.get(shareId);
        if (!record) {
            return NextResponse.json({ error: "Share package not found" }, { status: 404 });
        }

        if (record.type !== "gated") {
            return NextResponse.json({ error: "This share package does not require decryption gating" }, { status: 400 });
        }

        // Verify that the connected address matches the authorized address
        if (record.allowedAddress !== address) {
            return NextResponse.json({ error: "Access Denied: Connected address is not authorized for this share" }, { status: 403 });
        }

        // Verify the signature using Stellar SDK
        let isValid = false;
        try {
            const keypair = Keypair.fromPublicKey(address);
            const prefix = "Stellar Signed Message:\n";
            const messageBuffer = Buffer.from(prefix + challenge, "utf8");
            const signatureBuffer = Buffer.from(signature, "hex");
            isValid = keypair.verify(messageBuffer, signatureBuffer);
        } catch (err: any) {
            console.error("[Decrypt API] Signature verification threw error:", err.message);
            return NextResponse.json({ error: `Invalid signature format: ${err.message}` }, { status: 400 });
        }

        if (!isValid) {
            return NextResponse.json({ error: "Signature verification failed: Invalid challenge response" }, { status: 401 });
        }

        console.log(`[Decrypt API] Authenticated address ${address} successfully. Returning decryption key.`);
        return NextResponse.json({
            success: true,
            key: record.key,
            iv: record.iv
        });
    } catch (err: any) {
        console.error("Decrypt API error:", err);
        return NextResponse.json({ error: "Server processing error" }, { status: 500 });
    }
}
