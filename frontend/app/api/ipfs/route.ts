import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const PINATA_JWT = process.env.PINATA_JWT;

        if (!PINATA_JWT) {
            return NextResponse.json({ 
                error: "PINATA_JWT is not configured in the server environment. Please define PINATA_JWT in your .env.local file to enable real IPFS uploads." 
            }, { status: 500 });
        }

        const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${PINATA_JWT}`,
            },
            body: JSON.stringify({
                pinataContent: body,
                pinataMetadata: {
                    name: `nod-agreement-${Date.now()}`,
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            return NextResponse.json({ error: `Pinata API error: ${errText}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Invalid request" }, { status: 400 });
    }
}
