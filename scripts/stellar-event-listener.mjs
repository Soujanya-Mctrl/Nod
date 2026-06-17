import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";

// Configuration
const RPC_URL = process.env.STELLAR_TESTNET_RPC || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "CCAM5XI53OMFPKIMRHKZJMSJXYXJAYMPPX7TG3TKJ5NKOPDSQEU4QIMV";
const STATE_FILE = path.join(process.cwd(), ".stellar-event-listener-state.json");
const POLL_INTERVAL_MS = 5000;

const server = new rpc.Server(RPC_URL);

/**
 * Helper to convert bytes/Buffer to hex string
 */
function bytesToHex(val) {
    if (!val) return "";
    return Buffer.from(val).toString("hex");
}

/**
 * Decodes base64 XDR string to native JS values
 */
function decodeXDR(base64Str) {
    try {
        const val = xdr.ScVal.fromXDR(base64Str, "base64");
        return scValToNative(val);
    } catch (err) {
        console.error("Failed to decode XDR value:", err.message);
        return null;
    }
}

/**
 * Loads the last processed ledger from local state file
 */
async function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
            return {
                lastLedger: data.lastLedger,
                seenEvents: new Set(data.seenEvents || [])
            };
        }
    } catch (err) {
        console.error("Warning: Failed to load state file, starting fresh.", err.message);
    }
    
    // Fallback: get latest ledger from network
    try {
        console.log("Fetching latest ledger from network...");
        const latest = await server.getLatestLedger();
        return {
            lastLedger: latest.sequence - 10, // Go back 10 blocks to not miss anything on boot
            seenEvents: new Set()
        };
    } catch (err) {
        console.error("Failed to get latest ledger from network, falling back to 1:", err.message);
        return {
            lastLedger: 1,
            seenEvents: new Set()
        };
    }
}

/**
 * Saves the current state to local file
 */
function saveState(lastLedger, seenEvents) {
    try {
        const data = {
            lastLedger,
            seenEvents: Array.from(seenEvents).slice(-500) // Keep last 500 seen events for duplicate filter
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
        console.error("Failed to save state file:", err.message);
    }
}

/**
 * Resolves status numbers to human-readable labels
 */
const STATUS_MAP = {
    0: "AWAITING_SIGNATURE",
    1: "NODDED_ACTIVE",
    2: "COMPLETED",
    3: "DECLINED",
    4: "EXPIRED",
    5: "DELIVERED",
    6: "DISPUTED"
};

async function main() {
    console.log("==========================================================");
    console.log("             NOD Soroban Contract Event Listener         ");
    console.log("==========================================================");
    console.log(`RPC Node:     ${RPC_URL}`);
    console.log(`Contract ID:  ${CONTRACT_ID}`);
    console.log(`Poll Speed:   Every ${POLL_INTERVAL_MS / 1000} seconds`);
    console.log("==========================================================\n");

    let { lastLedger, seenEvents } = await loadState();
    console.log(`Monitoring contract events starting from ledger block: ${lastLedger}\n`);

    const poll = async () => {
        try {
            // Get current latest ledger to prevent query overflows
            const latestInfo = await server.getLatestLedger();
            const currentLatestLedger = latestInfo.sequence;

            if (lastLedger > currentLatestLedger) {
                // Network block height has not progressed yet
                setTimeout(poll, POLL_INTERVAL_MS);
                return;
            }

            // Fetch contract events
            const eventsResponse = await server.getEvents({
                startLedger: lastLedger,
                filters: [
                    {
                        type: "contract",
                        contractIds: [CONTRACT_ID]
                    }
                ],
                limit: 100
            });

            const events = eventsResponse.events || [];

            for (const event of events) {
                if (seenEvents.has(event.id)) {
                    continue; // Skip duplicate
                }
                seenEvents.add(event.id);

                // Decode event topics and value
                const decodedTopics = (event.topic || []).map(decodeXDR);
                const eventName = decodedTopics[0];
                const agreementIdBytes = decodedTopics[1];
                const agreementIdHex = bytesToHex(agreementIdBytes);

                const data = decodeXDR(event.value);

                console.log(`\x1b[35m[Ledger #${event.ledger}]\x1b[0m Event ID: ${event.id}`);
                console.log(`\x1b[36mTransaction Hash:\x1b[0m ${event.txHash}`);
                
                if (eventName === "sealed") {
                    // Value tuple: (cid, initiator, counterparties, ledger_timestamp, caution_amount)
                    const [cid, initiator, counterparties, timestamp, cautionAmount] = data;
                    const dateStr = new Date(Number(timestamp) * 1000).toLocaleString();

                    console.log(`\x1b[32m[AGREEMENT SEALED]\x1b[0m ID: 0x${agreementIdHex}`);
                    console.log(`  - Initiator:      ${initiator}`);
                    console.log(`  - Counterparties: ${counterparties.join(", ")}`);
                    console.log(`  - IPFS CID:       ${cid}`);
                    console.log(`  - Sealed At:      ${dateStr}`);
                    console.log(`  - Caution Amount: ${cautionAmount ? cautionAmount.toString() : "0"} units`);
                } 
                else if (eventName === "accepted") {
                    // Value tuple: (ledger_timestamp, status)
                    const [timestamp, statusVal] = data;
                    const dateStr = new Date(Number(timestamp) * 1000).toLocaleString();
                    const statusName = STATUS_MAP[Number(statusVal)] || `UNKNOWN (${statusVal})`;

                    console.log(`\x1b[34m[AGREEMENT ACCEPTED]\x1b[0m ID: 0x${agreementIdHex}`);
                    console.log(`  - New Status:  ${statusName}`);
                    console.log(`  - Accepted At: ${dateStr}`);
                } 
                else if (eventName === "resolved") {
                    // Value tuple: (ledger_timestamp, status)
                    const [timestamp, statusVal] = data;
                    const dateStr = new Date(Number(timestamp) * 1000).toLocaleString();
                    const statusName = STATUS_MAP[Number(statusVal)] || `UNKNOWN (${statusVal})`;

                    console.log(`\x1b[32m[AGREEMENT RESOLVED/COMPLETED]\x1b[0m ID: 0x${agreementIdHex}`);
                    console.log(`  - Status:      ${statusName}`);
                    console.log(`  - Resolved At: ${dateStr}`);
                } 
                else if (eventName === "expired") {
                    // Value tuple: (ledger_timestamp, claimant)
                    const [timestamp, claimant] = data;
                    const dateStr = new Date(Number(timestamp) * 1000).toLocaleString();

                    console.log(`\x1b[31m[AGREEMENT EXPIRED/CLAIMED]\x1b[0m ID: 0x${agreementIdHex}`);
                    console.log(`  - Claimant:    ${claimant}`);
                    console.log(`  - Claimed At:  ${dateStr}`);
                } 
                else {
                    console.log(`\x1b[33m[UNKNOWN EVENT: ${eventName}]\x1b[0m ID: 0x${agreementIdHex}`);
                    console.log("  - Topics:", decodedTopics);
                    console.log("  - Data:", data);
                }

                console.log("------------------------------------------------------------------");
            }

            // Update ledger tracking index
            lastLedger = Math.max(lastLedger, currentLatestLedger + 1);
            saveState(lastLedger, seenEvents);

        } catch (err) {
            console.error("\x1b[31mError polling contract events:\x1b[0m", err.message);
        }

        setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
}

// Global error handling
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

main().catch(err => {
    console.error("Fatal error:", err);
});
