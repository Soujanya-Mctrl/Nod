#![cfg(test)]

use super::contract::{NodContract, NodContractClient, NodStatus};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env, String, Vec,
};

#[test]
fn test_seal_and_complete_no_caution() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NodContract, ());
    let client = NodContractClient::new(&env, &contract_id);

    let initiator = Address::generate(&env);
    let counterparty = Address::generate(&env);
    
    let mut counterparties = Vec::new(&env);
    counterparties.push_back(counterparty.clone());

    let cid = String::from_str(&env, "QmXoypizjW3WknFixtNs4TxsjG6beUueCWK3wQyVbB2t2T");
    let agreement_id = BytesN::from_array(&env, &[1; 32]);
    
    let created_at = 1000;
    let expires_at = 2000;

    env.ledger().set_timestamp(1500);

    let mut agreement = client.seal_agreement(
        &cid,
        &initiator,
        &counterparties,
        &created_at,
        &expires_at,
        &agreement_id,
        &None,
        &0,
        &None,
    );

    assert_eq!(agreement.status, NodStatus::Awaiting);
    agreement = client.accept_agreement(&agreement_id, &counterparty);
    assert_eq!(agreement.status, NodStatus::Nodded);
    assert_eq!(agreement.caution_amount, 0);

    // Complete by initiator
    let mut res = client.complete_agreement(&agreement_id, &initiator);
    assert_eq!(res.status, NodStatus::Nodded); // Needs both approvals

    // Complete by counterparty
    res = client.complete_agreement(&agreement_id, &counterparty);
    assert_eq!(res.status, NodStatus::Completed); // Fully completed
}

#[test]
fn test_seal_and_complete_with_caution() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NodContract, ());
    let client = NodContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let initiator = Address::generate(&env);
    let counterparty = Address::generate(&env);

    // Register test token (Stellar Asset Contract)
    let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Mint balances
    token_admin_client.mint(&initiator, &1000);
    token_admin_client.mint(&counterparty, &1000);

    assert_eq!(token_client.balance(&initiator), 1000);
    assert_eq!(token_client.balance(&counterparty), 1000);

    let mut counterparties = Vec::new(&env);
    counterparties.push_back(counterparty.clone());

    let cid = String::from_str(&env, "QmXoypizjW3WknFixtNs4TxsjG6beUueCWK3wQyVbB2t2T");
    let agreement_id = BytesN::from_array(&env, &[2; 32]);
    
    let created_at = 1000;
    let expires_at = 2000;

    env.ledger().set_timestamp(1500);

    // Seal locks 100 tokens from initiator
    let mut agreement = client.seal_agreement(
        &cid,
        &initiator,
        &counterparties,
        &created_at,
        &expires_at,
        &agreement_id,
        &Some(token_address.clone()),
        &100,
        &None,
    );

    assert_eq!(agreement.status, NodStatus::Awaiting);
    assert_eq!(token_client.balance(&initiator), 900);
    assert_eq!(token_client.balance(&counterparty), 1000);

    agreement = client.accept_agreement(&agreement_id, &counterparty);
    assert_eq!(agreement.status, NodStatus::Nodded);
    assert_eq!(token_client.balance(&initiator), 900);
    assert_eq!(token_client.balance(&counterparty), 900);
    assert_eq!(token_client.balance(&contract_id), 200);

    // Resolve and unlock deposits back to participants
    client.complete_agreement(&agreement_id, &initiator);
    let final_agreement = client.complete_agreement(&agreement_id, &counterparty);

    assert_eq!(final_agreement.status, NodStatus::Completed);
    assert_eq!(token_client.balance(&initiator), 1000);
    assert_eq!(token_client.balance(&counterparty), 1000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_claim_expired_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NodContract, ());
    let client = NodContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let initiator = Address::generate(&env);
    let counterparty = Address::generate(&env);

    let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    token_admin_client.mint(&initiator, &1000);
    token_admin_client.mint(&counterparty, &1000);

    let mut counterparties = Vec::new(&env);
    counterparties.push_back(counterparty.clone());

    let cid = String::from_str(&env, "QmXoypizjW3WknFixtNs4TxsjG6beUueCWK3wQyVbB2t2T");
    let agreement_id = BytesN::from_array(&env, &[3; 32]);
    
    let created_at = 1000;
    let expires_at = 2000;

    env.ledger().set_timestamp(1500);

    client.seal_agreement(
        &cid,
        &initiator,
        &counterparties,
        &created_at,
        &expires_at,
        &agreement_id,
        &Some(token_address.clone()),
        &100,
        &None,
    );
    client.accept_agreement(&agreement_id, &counterparty);

    // Fast-forward past expiry
    env.ledger().set_timestamp(2500);

    // Counterparty claims expired deposits
    let agreement = client.claim_expired(&agreement_id, &counterparty);

    assert_eq!(agreement.status, NodStatus::Expired);
    assert_eq!(token_client.balance(&initiator), 900); // Lost deposit
    assert_eq!(token_client.balance(&counterparty), 1100); // Got refund + penalty
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_roommates_scenario_multi_party() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NodContract, ());
    let client = NodContractClient::new(&env, &contract_id);

    let initiator = Address::generate(&env);
    let cp1 = Address::generate(&env);
    let cp2 = Address::generate(&env);

    let mut counterparties = Vec::new(&env);
    counterparties.push_back(cp1.clone());
    counterparties.push_back(cp2.clone());

    let cid = String::from_str(&env, "QmXoypizjW3WknFixtNs4TxsjG6beUueCWK3wQyVbB2t2T");
    let agreement_id = BytesN::from_array(&env, &[4; 32]);

    // Roommate rule doesn't expire (expires_at = 0)
    let mut agreement = client.seal_agreement(
        &cid,
        &initiator,
        &counterparties,
        &1000,
        &0,
        &agreement_id,
        &None,
        &0,
        &None,
    );

    assert_eq!(agreement.status, NodStatus::Awaiting);
    client.accept_agreement(&agreement_id, &cp1);
    agreement = client.accept_agreement(&agreement_id, &cp2);
    assert_eq!(agreement.status, NodStatus::Nodded);

    // Complete approval needs all 3 participants (1 initiator + 2 counterparties)
    client.complete_agreement(&agreement_id, &initiator);
    client.complete_agreement(&agreement_id, &cp1);
    let res = client.complete_agreement(&agreement_id, &cp2);

    assert_eq!(res.status, NodStatus::Completed);
}

#[test]
fn test_arbitration_dispute_resolution() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NodContract, ());
    let client = NodContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let initiator = Address::generate(&env);
    let counterparty = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    token_admin_client.mint(&initiator, &1000);
    token_admin_client.mint(&counterparty, &1000);

    let mut counterparties = Vec::new(&env);
    counterparties.push_back(counterparty.clone());

    let cid = String::from_str(&env, "QmXoypizjW3WknFixtNs4TxsjG6beUueCWK3wQyVbB2t2T");
    let agreement_id = BytesN::from_array(&env, &[5; 32]);

    // Seal locks 100 tokens from each party, and nominates arbitrator
    let mut agreement = client.seal_agreement(
        &cid,
        &initiator,
        &counterparties,
        &1000,
        &3000,
        &agreement_id,
        &Some(token_address.clone()),
        &100,
        &Some(arbitrator.clone()),
    );

    assert_eq!(agreement.status, NodStatus::Awaiting);
    agreement = client.accept_agreement(&agreement_id, &counterparty);
    assert_eq!(agreement.status, NodStatus::Nodded);
    assert_eq!(agreement.arbitrator, Some(arbitrator.clone()));

    // 1. Mark Delivered by initiator
    env.ledger().set_timestamp(1500);
    let agreement = client.mark_delivered(&agreement_id);
    assert_eq!(agreement.status, NodStatus::Delivered);
    assert_eq!(agreement.delivered_at, 1500);

    // 2. Raise Dispute by counterparty (within 72 hours window: 1500 + 259200)
    env.ledger().set_timestamp(1600);
    let agreement = client.raise_dispute(&agreement_id, &counterparty);
    assert_eq!(agreement.status, NodStatus::Disputed);

    // 3. Resolve Dispute by arbitrator, awarding initiator
    let agreement = client.resolve_dispute(&agreement_id, &initiator);
    assert_eq!(agreement.status, NodStatus::Completed);
    assert_eq!(token_client.balance(&initiator), 1100); // 900 + 200 pool
    assert_eq!(token_client.balance(&counterparty), 900);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_auto_complete_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(NodContract, ());
    let client = NodContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let initiator = Address::generate(&env);
    let counterparty = Address::generate(&env);

    let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    token_admin_client.mint(&initiator, &1000);
    token_admin_client.mint(&counterparty, &1000);

    let mut counterparties = Vec::new(&env);
    counterparties.push_back(counterparty.clone());

    let cid = String::from_str(&env, "QmXoypizjW3WknFixtNs4TxsjG6beUueCWK3wQyVbB2t2T");
    let agreement_id = BytesN::from_array(&env, &[6; 32]);

    client.seal_agreement(
        &cid,
        &initiator,
        &counterparties,
        &1000,
        &3000,
        &agreement_id,
        &Some(token_address.clone()),
        &100,
        &None,
    );
    client.accept_agreement(&agreement_id, &counterparty);

    // Mark Delivered by initiator
    env.ledger().set_timestamp(1500);
    client.mark_delivered(&agreement_id);

    // Try auto-complete before 72 hours window passes (should panic/fail)
    env.ledger().set_timestamp(1500 + 200000);
    let result = client.try_auto_complete_delivered(&agreement_id);
    assert!(result.is_err());

    // Auto-complete after 72 hours window passes
    env.ledger().set_timestamp(1500 + 260000); // > 259200
    let agreement = client.auto_complete_delivered(&agreement_id);
    assert_eq!(agreement.status, NodStatus::Completed);
    assert_eq!(token_client.balance(&initiator), 1000);
    assert_eq!(token_client.balance(&counterparty), 1000);
    assert_eq!(token_client.balance(&contract_id), 0);
}
