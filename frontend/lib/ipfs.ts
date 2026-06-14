export async function uploadToIPFS(data: any) {
    const response = await fetch("/api/ipfs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to upload to IPFS: ${response.statusText}`);
    }

    return await response.json();
}
