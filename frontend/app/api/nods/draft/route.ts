import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import crypto from "crypto";

// Simple in-memory storage for the "thin relay"
// NOTE: This will reset when the server restarts. 
// In production, use Redis or a proper Database.
const pendingAgreements = new Map<string, any>();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, cid, initiator, counterparty, counterparties, signedCounterparties, text, ipfsEncrypted, encryptionMessage, sig1, expiresAt, agreementIdHex, tokenAddress, cautionAmount, arbitrator } = body;

        if (!id || !initiator || (!counterparty && (!counterparties || counterparties.length === 0)) || !sig1) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const resolvedCounterparties = counterparties || [counterparty];
        
        const draft = {
            id,
            cid,
            initiator,
            counterparties: resolvedCounterparties,
            signedCounterparties: signedCounterparties || [],
            counterparty: resolvedCounterparties[0], // backward compatibility
            text,
            ipfsEncrypted: !!ipfsEncrypted,
            encryptionMessage,
            sig1,
            createdAt: timestamp,
            expiresAt: expiresAt || (timestamp + 86400 * 7), // 7 days default
            agreementIdHex,
            tokenAddress: tokenAddress || null,
            cautionAmount: cautionAmount || 0,
            arbitrator: arbitrator || null
        };

        pendingAgreements.set(id, draft);

        console.log(`[Relay] Draft stored for ${id}`);

        return NextResponse.json({ success: true, draft });
    } catch (error) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const draft = pendingAgreements.get(id);

    if (!draft) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // Check if the request is authenticated by a participant
    const authAddress = req.headers.get("x-auth-address");
    const authSignature = req.headers.get("x-auth-signature");
    const authChallenge = req.headers.get("x-auth-challenge");

    let isParticipant = false;
    if (authAddress && authSignature && authChallenge) {
        try {
            const keypair = Keypair.fromPublicKey(authAddress);
            const prefix = "Stellar Signed Message:\n";
            const messageBuffer = Buffer.from(prefix + authChallenge, "utf8");
            const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();
            let signatureBuffer: Buffer;
            if (/^[0-9a-fA-F]{128}$/.test(authSignature)) {
                signatureBuffer = Buffer.from(authSignature, "hex");
            } else {
                signatureBuffer = Buffer.from(authSignature, "base64");
            }
            const isValid = keypair.verify(messageHash, signatureBuffer);

            if (isValid) {
                const isInitiator = draft.initiator?.toLowerCase() === authAddress.toLowerCase();
                const isCounterparty = draft.counterparties?.some(
                    (cp: string) => cp.toLowerCase() === authAddress.toLowerCase()
                );
                const isArbitrator = draft.arbitrator?.toLowerCase() === authAddress.toLowerCase();

                if (isInitiator || isCounterparty || isArbitrator) {
                    isParticipant = true;
                }
            }
        } catch (err: any) {
            console.error("[Draft API] Signature verification threw error:", err.message);
        }
    }

    if (isParticipant) {
        return NextResponse.json(draft);
    } else {
        // Redact the agreement text for non-participants
        const redactedDraft = {
            ...draft,
            text: ""
        };
        return NextResponse.json(redactedDraft);
    }
}

export async function DELETE() {
    pendingAgreements.clear();
    console.log("[Relay] All pending agreements cleared");
    return NextResponse.json({ success: true, message: "All pending agreements cleared" });
}

