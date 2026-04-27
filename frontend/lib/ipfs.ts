const PINATA_JWT = process.env.PINATA_JWT;

export async function uploadToIPFS(data: any) {
    if (!PINATA_JWT) {
        console.warn("PINATA_JWT not set, skipping IPFS upload");
        return { IpfsHash: "MOCK_CID_" + Math.random().toString(36).substring(7) };
    }

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
            pinataContent: data,
            pinataMetadata: {
                name: `nod-agreement-${Date.now()}`,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to upload to IPFS: ${response.statusText}`);
    }

    return await response.json();
}
