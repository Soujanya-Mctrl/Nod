// Noir circuit for verifying Stellar/Ed25519-based NOD agreements privately.
use dep::std;

fn main(
    // Private inputs — verifier never sees these
    sig1: [u8; 64],
    sig2: [u8; 64],
    text: [u8; 64], // Raw agreement text/hash chunk
    timestamp: u64,
    nonce: [u8; 32],

    // Public inputs — verifier sees these to validate the proof against on-chain state
    commitment: pub [u8; 32],
    initiator_pub_key: pub [u8; 32],
    counterparty_pub_key: pub [u8; 32],
    status_nodded: pub bool,
    expires_at: pub u64,
) {
    // 1. In production, verify that commitment matches the hash of (text, timestamp, nonce)
    
    // 2. Verify sig1 from initiator
    let valid1 = std::eddsa::verify_signature(initiator_pub_key, sig1, commitment);
    assert(valid1);

    // 3. Verify sig2 from counterparty
    let valid2 = std::eddsa::verify_signature(counterparty_pub_key, sig2, commitment);
    assert(valid2);

    // 4. Agreement must be Nodded
    assert(status_nodded == true);

    // 5. Not expired
    assert(timestamp < expires_at);
}
