const {
    xdr,
    Address,
    Account,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    Operation,
    nativeToScVal,
    rpc,
    Keypair
} = require('@stellar/stellar-sdk');
const http = require('https');

const CONTRACT_ID = "CAM54I42XTBF7OX3SM3OXR6J4AERRQ4T4EEVYKPST2IPHZYT6DYR5ETH";
const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";

function requestFriendbot(publicKey) {
    return new Promise((resolve, reject) => {
        console.log(`Funding account ${publicKey} via Friendbot...`);
        http.get(`https://friendbot.stellar.org?addr=${publicKey}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`Successfully funded ${publicKey}`);
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Friendbot failed with status ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function getAccount(address) {
    return new Promise((resolve, reject) => {
        http.get(`${HORIZON_URL}/accounts/${address}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const parsed = JSON.parse(data);
                    resolve(new Account(address, parsed.sequence));
                } else {
                    reject(new Error(`Fetch account failed: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log("Generating keypairs for initiator and counterparty...");
        const initiatorKeypair = Keypair.random();
        const counterpartyKeypair = Keypair.random();

        console.log(`Initiator:    ${initiatorKeypair.publicKey()}`);
        console.log(`Counterparty: ${counterpartyKeypair.publicKey()}`);

        await requestFriendbot(initiatorKeypair.publicKey());
        await requestFriendbot(counterpartyKeypair.publicKey());

        // Wait a few seconds for Horizon to index the accounts
        console.log("Waiting 5 seconds for ledger indexing...");
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const rpcServer = new rpc.Server(RPC_URL);

        // 1. Build and submit "seal_agreement"
        console.log("\nBuilding 'seal_agreement' transaction...");
        const initiatorSource = await getAccount(initiatorKeypair.publicKey());
        
        const cid = "QmXoypizjW3WknFixtNs4TxsjG6beUueCWK3wQyVbB2t2T";
        const agreementIdBytes = Buffer.alloc(32, 1); // 32-byte agreement ID
        const commitmentBytes = Buffer.alloc(32, 2); // 32-byte commitment hash

        const scValCid = nativeToScVal(cid);
        const scValInitiator = new Address(initiatorKeypair.publicKey()).toScVal();
        const scValCounterparties = nativeToScVal([new Address(counterpartyKeypair.publicKey())]);
        const scValCreatedAt = nativeToScVal(BigInt(Math.floor(Date.now() / 1000)));
        const scValExpiresAt = nativeToScVal(BigInt(Math.floor(Date.now() / 1000) + 86400));
        const scValAgreementId = nativeToScVal(agreementIdBytes);
        const scValTokenAddress = nativeToScVal(null);
        
        // caution_amount i128 = 0
        const scValCautionAmount = xdr.ScVal.scvI128(
            new xdr.Int128Parts({
                hi: xdr.Int64.fromString("0"),
                lo: xdr.Uint64.fromString("0"),
            })
        );
        const scValArbitrator = nativeToScVal(null);
        const scValCommitment = nativeToScVal(commitmentBytes);

        const opSeal = Operation.invokeContractFunction({
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
                scValArbitrator,
                scValCommitment
            ]
        });

        let txSeal = new TransactionBuilder(initiatorSource, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
        })
            .addOperation(opSeal)
            .setTimeout(300)
            .build();

        console.log("Preparing seal transaction via Soroban RPC...");
        txSeal = await rpcServer.prepareTransaction(txSeal);
        txSeal.sign(initiatorKeypair);

        console.log("Submitting seal transaction...");
        let sealResult = await rpcServer.sendTransaction(txSeal);
        if (sealResult.status !== "PENDING") {
            throw new Error(`Transaction submission failed: ${JSON.stringify(sealResult)}`);
        }

        console.log(`Transaction sent. Hash: ${sealResult.hash}`);
        console.log("Waiting for transaction confirmation...");

        let status = "PENDING";
        let txResult;
        while (status === "PENDING") {
            await new Promise(r => setTimeout(r, 2000));
            txResult = await rpcServer.getTransaction(sealResult.hash);
            status = txResult.status;
        }

        if (status !== "SUCCESS") {
            throw new Error(`Transaction failed: ${JSON.stringify(txResult)}`);
        }

        console.log(`\n🎉 SUCCESS! Agreement Sealed successfully.`);
        console.log(`Seal Transaction Hash: ${sealResult.hash}`);

        // 2. Build and submit "accept_agreement"
        console.log("\nBuilding 'accept_agreement' transaction...");
        const counterpartySource = await getAccount(counterpartyKeypair.publicKey());

        const opAccept = Operation.invokeContractFunction({
            contract: CONTRACT_ID,
            function: "accept_agreement",
            args: [
                scValAgreementId,
                new Address(counterpartyKeypair.publicKey()).toScVal()
            ]
        });

        let txAccept = new TransactionBuilder(counterpartySource, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
        })
            .addOperation(opAccept)
            .setTimeout(300)
            .build();

        console.log("Preparing accept transaction via Soroban RPC...");
        txAccept = await rpcServer.prepareTransaction(txAccept);
        txAccept.sign(counterpartyKeypair);

        console.log("Submitting accept transaction...");
        let acceptResult = await rpcServer.sendTransaction(txAccept);
        if (acceptResult.status !== "PENDING") {
            throw new Error(`Transaction submission failed: ${JSON.stringify(acceptResult)}`);
        }

        console.log(`Transaction sent. Hash: ${acceptResult.hash}`);
        console.log("Waiting for transaction confirmation...");

        status = "PENDING";
        while (status === "PENDING") {
            await new Promise(r => setTimeout(r, 2000));
            txResult = await rpcServer.getTransaction(acceptResult.hash);
            status = txResult.status;
        }

        if (status !== "SUCCESS") {
            throw new Error(`Transaction failed: ${JSON.stringify(txResult)}`);
        }

        console.log(`\n🎉 SUCCESS! Agreement Accepted/Nodded successfully.`);
        console.log(`Accept Transaction Hash: ${acceptResult.hash}`);

        console.log("\n==================================================");
        console.log("             On-Chain Interaction Summary         ");
        console.log("==================================================");
        console.log(`Seal Tx Hash:   ${sealResult.hash}`);
        console.log(`Accept Tx Hash: ${acceptResult.hash}`);
        console.log(`Initiator Address:    ${initiatorKeypair.publicKey()}`);
        console.log(`Counterparty Address: ${counterpartyKeypair.publicKey()}`);
        console.log("==================================================");

    } catch (e) {
        console.error("Interaction failed:", e);
    }
}

run();
