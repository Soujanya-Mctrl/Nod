use sha256::digest;

fn main(
    // Private inputs - prover knows these, verifier never sees them
    agreement_text_hash: [u8; 32],  // SHA-256 of agreement text (precomputed off-circuit)
    initiator_bytes: [u8; 32],      // Initiator identifier bytes
    created_at_bytes: [u8; 8],      // Creation timestamp as 8 bytes (big-endian u64)
    nonce: [u8; 32],                // Random nonce for uniqueness

    // Public inputs - verifier sees these to validate against on-chain state
    commitment: pub [u8; 32],       // The public commitment hash stored on-chain
    status_nodded: pub bool,        // Agreement must be in active state
    expires_at: pub u64,            // Expiry timestamp (0 = no expiry)
    timestamp: pub u64,             // Creation timestamp (public, for expiry check)
) {
    // 1. Recompute commitment = SHA-256(agreement_text_hash || initiator_bytes || created_at_bytes || nonce)
    let mut preimage: [u8; 104] = [0; 104];
    for i in 0..32 { preimage[i] = agreement_text_hash[i]; }
    for i in 0..32 { preimage[32 + i] = initiator_bytes[i]; }
    for i in 0..8  { preimage[64 + i] = created_at_bytes[i]; }
    for i in 0..32 { preimage[72 + i] = nonce[i]; }

    let computed = digest(preimage);
    assert(computed == commitment);

    // 2. Agreement must be sealed (Nodded)
    assert(status_nodded == true);

    // 3. Not expired (if expires_at > 0)
    if expires_at != 0 {
        assert(timestamp < expires_at);
    }
}
