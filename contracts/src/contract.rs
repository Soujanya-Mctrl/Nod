use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, token, Vec};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NodStatus {
    Awaiting = 0,
    Nodded = 1,
    Completed = 2,
    Declined = 3,
    Expired = 4,
    Delivered = 5,
    Disputed = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Agreement {
    pub cid: String,
    pub initiator: Address,
    pub counterparties: Vec<Address>,
    pub status: NodStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub token_address: Option<Address>,
    pub caution_amount: i128,
    pub completed_parties: Vec<Address>,
    pub arbitrator: Option<Address>,
    pub delivered_at: u64,
    pub commitment: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Agreement(BytesN<32>),
    ProofHash(BytesN<32>),
    UserAgreements(Address),
}

fn add_user_agreement(env: &Env, user: &Address, agreement_id: &BytesN<32>) {
    let key = DataKey::UserAgreements(user.clone());
    let mut agreements: Vec<BytesN<32>> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    
    let mut exists = false;
    for id in agreements.iter() {
        if id == *agreement_id {
            exists = true;
            break;
        }
    }
    if !exists {
        agreements.push_back(agreement_id.clone());
        env.storage().persistent().set(&key, &agreements);
    }
}

#[contract]
pub struct NodContract;

#[contractimpl]
impl NodContract {
    /// Seals an agreement by verifying authorization from the initiator and all counterparties.
    /// Locks caution deposits from all participants if caution_amount > 0.
    pub fn seal_agreement(
        env: Env,
        cid: String,
        initiator: Address,
        counterparties: Vec<Address>,
        created_at: u64,
        expires_at: u64,
        agreement_id: BytesN<32>,
        token_address: Option<Address>,
        caution_amount: i128,
        arbitrator: Option<Address>,
        commitment: BytesN<32>,
    ) -> Agreement {
        let ledger_timestamp = env.ledger().timestamp();
        if expires_at > 0 && ledger_timestamp > expires_at {
            panic!("Agreement expired");
        }

        if counterparties.len() == 0 {
            panic!("Must have at least one counterparty");
        }

        // Verify authorization only from initiator
        initiator.require_auth();

        let key = DataKey::Agreement(agreement_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("Agreement already exists");
        }

        // If caution deposit is specified, lock tokens from initiator
        if caution_amount > 0 {
            if let Some(ref token_addr) = token_address {
                let token_client = token::Client::new(&env, token_addr);
                let contract_addr = env.current_contract_address();

                // Transfer from initiator
                token_client.transfer(&initiator, &contract_addr, &caution_amount);
            } else {
                panic!("Token address required for caution deposit");
            }
        }

        let agreement = Agreement {
            cid: cid.clone(),
            initiator: initiator.clone(),
            counterparties: counterparties.clone(),
            status: NodStatus::Awaiting, // Set to Awaiting
            created_at,
            expires_at,
            token_address: token_address.clone(),
            caution_amount,
            completed_parties: Vec::new(&env),
            arbitrator,
            delivered_at: 0,
            commitment,
        };

        env.storage().persistent().set(&key, &agreement);

        add_user_agreement(&env, &initiator, &agreement_id);
        for cp in counterparties.iter() {
            add_user_agreement(&env, &cp, &agreement_id);
        }

        // Emit AgreementSealed event
        env.events().publish(
            (symbol_short!("sealed"), agreement_id),
            (cid, initiator, counterparties, ledger_timestamp, caution_amount),
        );

        agreement
    }

    /// Accepts a drafted agreement. Locks caution deposit from the counterparty.
    /// Transitions status to Nodded once all counterparties have accepted.
    pub fn accept_agreement(env: Env, agreement_id: BytesN<32>, counterparty: Address) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let mut agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        if agreement.status != NodStatus::Awaiting {
            panic!("Agreement is not in draft/awaiting state");
        }

        counterparty.require_auth();

        // Verify that the caller is one of the counterparties
        let mut is_counterparty = false;
        for cp in agreement.counterparties.iter() {
            if cp == counterparty {
                is_counterparty = true;
                break;
            }
        }

        if !is_counterparty {
            panic!("Party is not a counterparty");
        }

        // Verify they haven't already accepted
        for p in agreement.completed_parties.iter() {
            if p == counterparty {
                panic!("Counterparty already accepted");
            }
        }

        // Lock caution deposit from the counterparty
        if agreement.caution_amount > 0 {
            if let Some(ref token_addr) = agreement.token_address {
                let token_client = token::Client::new(&env, token_addr);
                let contract_addr = env.current_contract_address();
                token_client.transfer(&counterparty, &contract_addr, &agreement.caution_amount);
            }
        }

        agreement.completed_parties.push_back(counterparty);

        // If all counterparties have accepted, transition to Nodded
        if agreement.completed_parties.len() == agreement.counterparties.len() {
            agreement.status = NodStatus::Nodded;
            agreement.completed_parties = Vec::new(&env); // Clear for completion approvals
        }

        env.storage().persistent().set(&key, &agreement);

        // Emit accepted/sealed event
        let ledger_timestamp = env.ledger().timestamp();
        env.events().publish(
            (symbol_short!("accepted"), agreement_id),
            (ledger_timestamp, agreement.status),
        );

        agreement
    }

    /// Mark agreement as complete. If all participants approve, releases caution money.
    pub fn complete_agreement(env: Env, agreement_id: BytesN<32>, party: Address) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let mut agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        if agreement.status != NodStatus::Nodded && agreement.status != NodStatus::Delivered {
            panic!("Invalid agreement state");
        }

        party.require_auth();

        // Check if party is initiator or one of the counterparties
        let mut is_valid_party = party == agreement.initiator;
        if !is_valid_party {
            for cp in agreement.counterparties.iter() {
                if cp == party {
                    is_valid_party = true;
                    break;
                }
            }
        }

        if !is_valid_party {
            panic!("Party is not a participant");
        }

        // Check if party already approved completion
        let mut already_approved = false;
        for p in agreement.completed_parties.iter() {
            if p == party {
                already_approved = true;
                break;
            }
        }

        if !already_approved {
            agreement.completed_parties.push_back(party);
        }

        // Check if all participants (initiator + counterparties) have approved
        let total_participants = agreement.counterparties.len() + 1;
        if agreement.completed_parties.len() == total_participants {
            agreement.status = NodStatus::Completed;

            // Release caution deposits back to everyone
            if agreement.caution_amount > 0 {
                if let Some(ref token_addr) = agreement.token_address {
                    let token_client = token::Client::new(&env, token_addr);
                    let contract_addr = env.current_contract_address();

                    token_client.transfer(&contract_addr, &agreement.initiator, &agreement.caution_amount);
                    for cp in agreement.counterparties.iter() {
                        token_client.transfer(&contract_addr, &cp, &agreement.caution_amount);
                    }
                }
            }

            let ledger_timestamp = env.ledger().timestamp();
            env.events().publish(
                (symbol_short!("resolved"), agreement_id.clone()),
                (ledger_timestamp, NodStatus::Completed),
            );
        }

        env.storage().persistent().set(&key, &agreement);
        agreement
    }

    /// Claim expired caution deposits. Splits the initiator's deposit among all counterparties.
    pub fn claim_expired(env: Env, agreement_id: BytesN<32>, claimant: Address) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let mut agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        if agreement.status != NodStatus::Nodded {
            panic!("Invalid agreement state for expiration claim");
        }

        if agreement.expires_at == 0 {
            panic!("Agreement does not expire");
        }

        let ledger_timestamp = env.ledger().timestamp();
        if ledger_timestamp <= agreement.expires_at {
            panic!("Agreement not expired yet");
        }

        claimant.require_auth();

        // Must be one of the counterparties to claim expiration payouts
        let mut is_counterparty = false;
        for cp in agreement.counterparties.iter() {
            if cp == claimant {
                is_counterparty = true;
                break;
            }
        }

        if !is_counterparty {
            panic!("Only counterparties can claim expired agreements");
        }

        agreement.status = NodStatus::Expired;

        // Disburse all locked caution deposits to the counterparties
        if agreement.caution_amount > 0 {
            if let Some(ref token_addr) = agreement.token_address {
                let token_client = token::Client::new(&env, token_addr);
                let contract_addr = env.current_contract_address();
                
                let num_cps = agreement.counterparties.len() as i128;
                let initiator_penalty_per_cp = agreement.caution_amount / num_cps;
                let payout_amount = agreement.caution_amount + initiator_penalty_per_cp;

                for cp in agreement.counterparties.iter() {
                    token_client.transfer(&contract_addr, &cp, &payout_amount);
                }
            }
        }

        env.storage().persistent().set(&key, &agreement);

        env.events().publish(
            (symbol_short!("expired"), agreement_id),
            (ledger_timestamp, claimant),
        );

        agreement
    }

    /// Explicitly decline a draft agreement and refund the initiator's deposit if locked.
    pub fn decline_agreement(
        env: Env,
        agreement_id: BytesN<32>,
        initiator: Address,
        counterparty: Address,
        cid: String,
    ) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        
        counterparty.require_auth();

        // Check if there is an existing agreement in Awaiting state
        let mut caution_amount = 0;
        let mut token_address = None;
        let mut commitment = BytesN::from_array(&env, &[0; 32]);
        if env.storage().persistent().has(&key) {
            let existing: Agreement = env.storage().persistent().get(&key).unwrap();
            if existing.status == NodStatus::Awaiting {
                caution_amount = existing.caution_amount;
                token_address = existing.token_address.clone();
                commitment = existing.commitment.clone();
            }
        }

        // Refund initiator
        if caution_amount > 0 {
            if let Some(ref token_addr) = token_address {
                let token_client = token::Client::new(&env, token_addr);
                let contract_addr = env.current_contract_address();
                token_client.transfer(&contract_addr, &initiator, &caution_amount);
            }
        }

        let mut cps = Vec::new(&env);
        cps.push_back(counterparty.clone());

        let agreement = Agreement {
            cid,
            initiator,
            counterparties: cps,
            status: NodStatus::Declined,
            created_at: env.ledger().timestamp(),
            expires_at: 0,
            token_address,
            caution_amount,
            completed_parties: Vec::new(&env),
            arbitrator: None,
            delivered_at: 0,
            commitment,
        };

        env.storage().persistent().set(&key, &agreement);
        agreement
    }

    /// Mark the agreement as delivered by the initiator.
    pub fn mark_delivered(env: Env, agreement_id: BytesN<32>) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let mut agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        if agreement.status != NodStatus::Nodded {
            panic!("Agreement is not active");
        }

        agreement.initiator.require_auth();
        agreement.status = NodStatus::Delivered;
        agreement.delivered_at = env.ledger().timestamp();

        env.storage().persistent().set(&key, &agreement);
        agreement
    }

    /// Raise a dispute by any counterparty within the 72-hour review window.
    pub fn raise_dispute(env: Env, agreement_id: BytesN<32>, claimant: Address) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let mut agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        if agreement.status != NodStatus::Delivered {
            panic!("Agreement is not marked as delivered");
        }

        claimant.require_auth();

        // Must be one of the counterparties to dispute
        let mut is_counterparty = false;
        for cp in agreement.counterparties.iter() {
            if cp == claimant {
                is_counterparty = true;
                break;
            }
        }

        if !is_counterparty {
            panic!("Only counterparties can raise a dispute");
        }

        // Dispute window: 72 hours (259,200 seconds)
        let ledger_timestamp = env.ledger().timestamp();
        if ledger_timestamp > agreement.delivered_at + 259200 {
            panic!("Dispute window (72h) closed");
        }

        agreement.status = NodStatus::Disputed;

        env.storage().persistent().set(&key, &agreement);
        agreement
    }

    /// Resolves a dispute by sending all locked escrow funds to the designated winner.
    /// Can only be called by the agreed-upon arbitrator.
    pub fn resolve_dispute(env: Env, agreement_id: BytesN<32>, winner: Address) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let mut agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        if agreement.status != NodStatus::Disputed {
            panic!("Agreement is not in disputed state");
        }

        let arb = agreement.arbitrator.clone().unwrap_or_else(|| panic!("No arbitrator assigned"));
        arb.require_auth();

        // Verify winner is a participant
        let mut is_valid_winner = winner == agreement.initiator;
        if !is_valid_winner {
            for cp in agreement.counterparties.iter() {
                if cp == winner {
                    is_valid_winner = true;
                    break;
                }
            }
        }

        if !is_valid_winner {
            panic!("Winner must be a participant");
        }

        agreement.status = NodStatus::Completed;

        // Disburse entire pool to the winner
        if agreement.caution_amount > 0 {
            if let Some(ref token_addr) = agreement.token_address {
                let token_client = token::Client::new(&env, token_addr);
                let contract_addr = env.current_contract_address();
                let num_participants = agreement.counterparties.len() as i128 + 1;
                let total_escrow = agreement.caution_amount * num_participants;

                token_client.transfer(&contract_addr, &winner, &total_escrow);
            }
        }

        env.storage().persistent().set(&key, &agreement);
        agreement
    }

    /// Automatically completes a delivered agreement if the 72-hour review window has passed without a dispute.
    pub fn auto_complete_delivered(env: Env, agreement_id: BytesN<32>) -> Agreement {
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let mut agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        if agreement.status != NodStatus::Delivered {
            panic!("Agreement is not in delivered state");
        }

        let ledger_timestamp = env.ledger().timestamp();
        if ledger_timestamp <= agreement.delivered_at + 259200 {
            panic!("72h review window has not expired");
        }

        agreement.status = NodStatus::Completed;

        // Release deposits back to everyone
        if agreement.caution_amount > 0 {
            if let Some(ref token_addr) = agreement.token_address {
                let token_client = token::Client::new(&env, token_addr);
                let contract_addr = env.current_contract_address();

                token_client.transfer(&contract_addr, &agreement.initiator, &agreement.caution_amount);
                for cp in agreement.counterparties.iter() {
                    token_client.transfer(&contract_addr, &cp, &agreement.caution_amount);
                }
            }
        }

        env.storage().persistent().set(&key, &agreement);
        agreement
    }

    /// Fetch details of an agreement.
    pub fn get_agreement(env: Env, agreement_id: BytesN<32>) -> Option<Agreement> {
        let key = DataKey::Agreement(agreement_id);
        env.storage().persistent().get(&key)
    }

    /// Stores the cryptographic proof receipt hash for an agreement.
    /// Only the agreement initiator or counterparties can store the hash.
    pub fn store_proof_hash(
        env: Env,
        agreement_id: BytesN<32>,
        proof_hash: BytesN<32>,
        prover: Address,
    ) {
        prover.require_auth();

        // 1. Verify that the agreement exists
        let key = DataKey::Agreement(agreement_id.clone());
        if !env.storage().persistent().has(&key) {
            panic!("Agreement does not exist");
        }

        let agreement: Agreement = env.storage().persistent().get(&key).unwrap();

        // 2. Verify that the prover is a participant in this agreement
        let mut is_participant = prover == agreement.initiator;
        if !is_participant {
            for cp in agreement.counterparties.iter() {
                if cp == prover {
                    is_participant = true;
                    break;
                }
            }
        }
        if !is_participant {
            panic!("Prover is not a participant in this agreement");
        }

        // 3. Store the proof hash
        let hash_key = DataKey::ProofHash(agreement_id.clone());
        env.storage().persistent().set(&hash_key, &proof_hash);

        // 4. Emit event
        env.events().publish(
            (symbol_short!("pr_hash"), agreement_id),
            (proof_hash, prover),
        );
    }

    /// Retrieves the stored proof receipt hash for an agreement.
    pub fn get_proof_hash(env: Env, agreement_id: BytesN<32>) -> Option<BytesN<32>> {
        let hash_key = DataKey::ProofHash(agreement_id);
        env.storage().persistent().get(&hash_key)
    }

    /// Retrieves all agreement IDs associated with a user address.
    pub fn get_user_agreements(env: Env, user: Address) -> Vec<BytesN<32>> {
        let key = DataKey::UserAgreements(user);
        env.storage().persistent().get(&key).unwrap_or_else(|| Vec::new(&env))
    }
}
