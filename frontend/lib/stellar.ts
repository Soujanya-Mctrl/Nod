import {
    xdr,
    Address,
    Account,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    Operation,
    Horizon,
    nativeToScVal,
    rpc
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

export const STELLAR_TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
export const STELLAR_TESTNET_RPC = "https://soroban-testnet.stellar.org";
export const STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;

// Replace with your actual deployed Soroban contract ID on Testnet
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "CCAM5XI53OMFPKIMRHKZJMSJXYXJAYMPPX7TG3TKJ5NKOPDSQEU4QIMV";

/**
 * Fetches sequence number for a Stellar account
 */
export async function getStellarAccount(address: string): Promise<Account> {
    const res = await fetch(`${STELLAR_TESTNET_HORIZON}/accounts/${address}`);
    if (!res.ok) {
        throw new Error("Stellar account not found on Testnet. Please fund it via Friendbot.");
    }
    const data = await res.json();
    return new Account(address, data.sequence);
}

/**
 * Helper to convert hex string to 32-byte Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(32);
    for (let c = 0; c < 32; c++) {
        bytes[c] = parseInt(hex.substr(c * 2, 2), 16) || 0;
    }
    return bytes;
}

/**
 * Builds a transaction to seal an agreement on Soroban
 */
export async function buildSealAgreementTx(params: {
    cid: string;
    initiator: string;
    counterparties: string[];
    createdAt: number;
    expiresAt: number;
    agreementIdHex: string;
    tokenAddress?: string;
    cautionAmount?: number;
    arbitrator?: string;
}): Promise<string> {
    const { cid, initiator, counterparties, createdAt, expiresAt, agreementIdHex, tokenAddress, cautionAmount, arbitrator } = params;

    const sourceAccount = await getStellarAccount(initiator);
    const agreementBytes = hexToBytes(agreementIdHex);

    const scValCid = nativeToScVal(cid);
    const scValInitiator = new Address(initiator).toScVal();
    const scValCounterparties = nativeToScVal(counterparties.map(cp => new Address(cp)));
    const scValCreatedAt = nativeToScVal(BigInt(createdAt));
    const scValExpiresAt = nativeToScVal(BigInt(expiresAt));
    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));
    const scValTokenAddress = tokenAddress ? nativeToScVal(new Address(tokenAddress)) : nativeToScVal(null);
    
    const valBI = BigInt(cautionAmount || 0);
    const hi = valBI >> BigInt(64);
    const lo = valBI & BigInt('0xffffffffffffffff');
    const scValCautionAmount = xdr.ScVal.scvI128(
        new xdr.Int128Parts({
            hi: xdr.Int64.fromString(hi.toString()),
            lo: xdr.Uint64.fromString(lo.toString()),
        })
    );

    const scValArbitrator = arbitrator ? nativeToScVal(new Address(arbitrator)) : nativeToScVal(null);

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "seal_agreement",
        args: [
            scValCid,
            scValInitiator,
            scValCounterparties,
            scValCreatedAt,
            scValExpiresAt,
            scValAgreementId,
            scValTokenAddress,
            scValCautionAmount,
            scValArbitrator
        ]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300) // 5 minutes
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Builds a transaction to accept an agreement on Soroban
 */
export async function buildAcceptAgreementTx(params: {
    counterparty: string;
    agreementIdHex: string;
}): Promise<string> {
    const { counterparty, agreementIdHex } = params;

    const sourceAccount = await getStellarAccount(counterparty);
    const agreementBytes = hexToBytes(agreementIdHex);

    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));
    const scValCounterparty = new Address(counterparty).toScVal();

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "accept_agreement",
        args: [
            scValAgreementId,
            scValCounterparty
        ]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Signs a transaction XDR using Freighter Wallet
 */
export async function signTxWithFreighter(xdrString: string): Promise<string> {
    const res = await signTransaction(xdrString, {
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE
    });
    if (res.error) {
        throw new Error(`Freighter signing failed: ${res.error}`);
    }
    return res.signedTxXdr;
}

/**
 * Submits a fully signed transaction to Stellar Testnet
 */
export async function submitStellarTx(xdrString: string): Promise<string> {
    const server = new Horizon.Server(STELLAR_TESTNET_HORIZON);
    const tx = TransactionBuilder.fromXDR(xdrString, STELLAR_NETWORK_PASSPHRASE);
    const result = await server.submitTransaction(tx);
    return result.hash;
}

/**
 * Builds a transaction to decline an agreement on Soroban
 */
export async function buildDeclineAgreementTx(params: {
    initiator: string;
    counterparty: string;
    cid: string;
    agreementIdHex: string;
}): Promise<string> {
    const { initiator, counterparty, cid, agreementIdHex } = params;

    const sourceAccount = await getStellarAccount(counterparty);
    const agreementBytes = hexToBytes(agreementIdHex);

    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));
    const scValInitiator = new Address(initiator).toScVal();
    const scValCounterparty = new Address(counterparty).toScVal();
    const scValCid = nativeToScVal(cid);

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "decline_agreement",
        args: [
            scValAgreementId,
            scValInitiator,
            scValCounterparty,
            scValCid
        ]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Builds a transaction to complete an agreement on Soroban
 */
export async function buildCompleteAgreementTx(params: {
    party: string;
    agreementIdHex: string;
}): Promise<string> {
    const { party, agreementIdHex } = params;

    const sourceAccount = await getStellarAccount(party);
    const agreementBytes = hexToBytes(agreementIdHex);

    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));
    const scValParty = new Address(party).toScVal();

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "complete_agreement",
        args: [
            scValAgreementId,
            scValParty
        ]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Builds a transaction to claim an expired agreement on Soroban
 */
export async function buildClaimExpiredTx(params: {
    claimant: string;
    agreementIdHex: string;
}): Promise<string> {
    const { claimant, agreementIdHex } = params;

    const sourceAccount = await getStellarAccount(claimant);
    const agreementBytes = hexToBytes(agreementIdHex);

    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));
    const scValClaimant = new Address(claimant).toScVal();

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "claim_expired",
        args: [
            scValAgreementId,
            scValClaimant
        ]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Builds a transaction to mark an agreement as delivered
 */
export async function buildMarkDeliveredTx(params: {
    initiator: string;
    agreementIdHex: string;
}): Promise<string> {
    const { initiator, agreementIdHex } = params;

    const sourceAccount = await getStellarAccount(initiator);
    const agreementBytes = hexToBytes(agreementIdHex);
    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "mark_delivered",
        args: [scValAgreementId]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Builds a transaction to raise a dispute
 */
export async function buildRaiseDisputeTx(params: {
    claimant: string;
    agreementIdHex: string;
}): Promise<string> {
    const { claimant, agreementIdHex } = params;

    const sourceAccount = await getStellarAccount(claimant);
    const agreementBytes = hexToBytes(agreementIdHex);
    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));
    const scValClaimant = new Address(claimant).toScVal();

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "raise_dispute",
        args: [
            scValAgreementId,
            scValClaimant
        ]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Builds a transaction to resolve a dispute (arbitrator only)
 */
export async function buildResolveDisputeTx(params: {
    arbitrator: string;
    agreementIdHex: string;
    winner: string;
}): Promise<string> {
    const { arbitrator, agreementIdHex, winner } = params;

    const sourceAccount = await getStellarAccount(arbitrator);
    const agreementBytes = hexToBytes(agreementIdHex);
    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));
    const scValWinner = new Address(winner).toScVal();

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "resolve_dispute",
        args: [
            scValAgreementId,
            scValWinner
        ]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}

/**
 * Builds a transaction to auto-complete a delivered agreement after review period
 */
export async function buildAutoCompleteDeliveredTx(params: {
    caller: string;
    agreementIdHex: string;
}): Promise<string> {
    const { caller, agreementIdHex } = params;

    const sourceAccount = await getStellarAccount(caller);
    const agreementBytes = hexToBytes(agreementIdHex);
    const scValAgreementId = nativeToScVal(Buffer.from(agreementBytes));

    const op = Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "auto_complete_delivered",
        args: [scValAgreementId]
    });

    const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(op)
        .setTimeout(300)
        .build();

    const rpcServer = new rpc.Server(STELLAR_TESTNET_RPC);
    const preparedTx = await rpcServer.prepareTransaction(tx);
    return preparedTx.toXDR();
}
