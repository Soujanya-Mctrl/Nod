import { NextResponse } from "next/server";

// Simple in-memory storage for the "thin relay"
// NOTE: This will reset when the server restarts. 
// In production, use Redis or a proper Database.
const pendingAgreements = new Map<string, any>();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, cid, initiator, counterparty, text, sig1, expiresAt } = body;

        if (!id || !initiator || !counterparty || !sig1) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        
        const draft = {
            id,
            cid,
            initiator,
            counterparty,
            text,
            sig1,
            createdAt: timestamp,
            expiresAt: expiresAt || (timestamp + 86400 * 7), // 7 days default
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

    return NextResponse.json(draft);
}
