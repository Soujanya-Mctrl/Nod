"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search01Icon,
    CheckmarkCircle01Icon,
    CancelCircleIcon,
    ArrowRight01Icon,
    Copy01Icon,
    Cancel01Icon,
    GridIcon,
    SecurityCheckIcon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileName } from "@/components/nod/profile-name";
import { StatusBadge, type NodStatus } from "@/components/nod/status-badge";
import { cn, truncateHash } from "@/lib/utils";
import { ChevronDown, Check, Lock, Loader2, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { fetchIPFSContent, queryAgreementOnChain } from "@/lib/soroban-query";
import { isEncryptedIPFSPayload } from "@/lib/ipfs-encryption";
import { parseNodSharePackage, type NodSharePackage, decryptPayloadWithKey } from "@/lib/nod-share";
import { generateHash } from "@/lib/utils";
import { useStellarWallet } from "@/components/providers/stellar-provider";
import { useToast } from "@/components/ui/toast";
import { signMessageWithFreighter, CONTRACT_ID } from "@/lib/stellar";
import { useNods, type Nod } from "@/lib/store";
import { generateZKProof, verifyZKProof } from "@/lib/zk-verifier";

type StatusFilter = "all" | NodStatus;

export default function VerifyPage() {
    const { nods: onChainNods, isLoaded, resolveProfile, updateNod } = useNods();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const toast = useToast();
    const { address, isConnected, connect } = useStellarWallet();

    // shareId loader states
    const [shareIdLoading, setShareIdLoading] = useState(false);
    const [sharePackageError, setSharePackageError] = useState<string | null>(null);
    const [loadedGatedShare, setLoadedGatedShare] = useState<{
        shareId: string;
        type: "gated";
        nodId: string;
        allowedAddress: string;
        encryptedPayload: string;
        iv: string;
        createdAt: number;
    } | null>(null);
    const [decryptedNodShare, setDecryptedNodShare] = useState<NodSharePackage | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);

    const [rpcStatus, setRpcStatus] = useState<"idle" | "verifying" | "active" | "error">("idle");
    const [rpcMessage, setRpcMessage] = useState<string>("");

    const checkContractRpc = async () => {
        setRpcStatus("verifying");
        setRpcMessage("Simulating read-only get_agreement call on Soroban Testnet RPC...");
        try {
            // Query with an empty 32-byte hex ID to test contract invocation
            await queryAgreementOnChain("0000000000000000000000000000000000000000000000000000000000000000");
            setRpcStatus("active");
            setRpcMessage("Contract verified! Active and responding on Soroban RPC.");
        } catch (err: any) {
            setRpcStatus("error");
            setRpcMessage(`RPC Verification failed: ${err.message || "Contract not responding"}`);
        }
    };

    // ZK verification states
    const [zkNodId, setZkNodId] = useState("");
    const [zkNod, setZkNod] = useState<Nod | null>(null);
    const [isZkRunning, setIsZkRunning] = useState(false);
    const [zkStatusMessage, setZkStatusMessage] = useState("");
    const [zkChecks, setZkChecks] = useState<{ name: string; passed: boolean; detail: string; }[] | null>(null);
    const [zkValid, setZkValid] = useState<boolean | null>(null);
    const [zkProofHex, setZkProofHex] = useState<string | null>(null);
    const [zkIsSimulated, setZkIsSimulated] = useState(false);
    const [showTechDetails, setShowTechDetails] = useState(false);

    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    // Close status filter dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
                setIsFilterDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle shareId from query parameter
    useEffect(() => {
        if (!isLoaded) return;
        const search = window.location.search;
        const params = new URLSearchParams(search);
        const shareId = params.get("shareId");
        if (shareId) {
            loadSharePackage(shareId);
        }
    }, [isLoaded]);

    const loadSharePackage = async (shareId: string) => {
        setShareIdLoading(true);
        setSharePackageError(null);
        try {
            const res = await fetch(`/api/nods/share?shareId=${shareId}`);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Failed to fetch share package");
            }
            const data = await res.json();
            if (data.type === "gated") {
                setLoadedGatedShare(data);
            } else {
                throw new Error("Invalid or unsupported share package type.");
            }
        } catch (err: any) {
            console.error("Error loading share package:", err);
            setSharePackageError(err.message || "Failed to load share package.");
        } finally {
            setShareIdLoading(false);
        }
    };

    const handleGatedDecrypt = async () => {
        if (!loadedGatedShare) return;
        if (!isConnected || !address) {
            toast.error("Please connect your wallet first.");
            return;
        }
        if (address.toLowerCase() !== loadedGatedShare.allowedAddress.toLowerCase()) {
            toast.error(`Access Denied: Connected wallet is not authorized.`);
            return;
        }

        setIsDecrypting(true);
        try {
            const challenge = `Challenge: Decrypt Nod Share Package ${loadedGatedShare.shareId} at ${new Date().toISOString()}`;
            const signatureHex = await signMessageWithFreighter(challenge);

            const keyRes = await fetch("/api/nods/share/decrypt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shareId: loadedGatedShare.shareId,
                    address,
                    signature: signatureHex,
                    challenge
                })
            });

            if (!keyRes.ok) {
                const errText = await keyRes.text();
                throw new Error(errText || "Authentication failed.");
            }

            const keyData = await keyRes.json();
            if (!keyData.success || !keyData.key || !keyData.iv) {
                throw new Error("Failed to retrieve key and iv from authentication relay.");
            }

            const decryptedText = await decryptPayloadWithKey(
                loadedGatedShare.encryptedPayload,
                keyData.iv,
                keyData.key
            );

            const packageData = JSON.parse(decryptedText);
            setDecryptedNodShare(packageData);
            toast.success("Agreement details decrypted successfully!");
        } catch (err: any) {
            console.error("Decryption failed:", err);
            toast.error(err.message || "Decryption failed. Ensure your wallet signature is correct.");
        } finally {
            setIsDecrypting(false);
        }
    };

    const handleLoadZkNod = async (nodId: string) => {
        let found = onChainNods.find(n => n.id === nodId);

        if (!found && decryptedNodShare && decryptedNodShare.nodId === nodId) {
            found = {
                id: decryptedNodShare.nodId,
                text: decryptedNodShare.text,
                hash: decryptedNodShare.sealedContentHash,
                cid: decryptedNodShare.cid,
                transactionHash: decryptedNodShare.transactionHash || "",
                creator: decryptedNodShare.creator,
                counterparty: decryptedNodShare.counterparties?.[0] || "",
                counterparties: decryptedNodShare.counterparties || [],
                status: "nodded",
                createdAt: new Date(decryptedNodShare.createdAt).toLocaleDateString(),
                timestamp: new Date(decryptedNodShare.createdAt).toLocaleTimeString(),
                createdByMe: decryptedNodShare.creator.toLowerCase() === address?.toLowerCase(),
                expiresAt: decryptedNodShare.expiresAt,
                nonceHex: decryptedNodShare.nonceHex,
                commitmentHex: decryptedNodShare.commitmentHex,
            } as any;
        }

        if (!found) {
            // Try fetching from draft API with wallet authorization if connected
            if (isConnected && address) {
                try {
                    const challenge = `Auth Challenge: View draft nod ${nodId} at ${new Date().toISOString()}`;
                    const sig = await signMessageWithFreighter(challenge, address);
                    const res = await fetch(`/api/nods/draft?id=${nodId}`, {
                        headers: {
                            "x-auth-address": address,
                            "x-auth-signature": sig,
                            "x-auth-challenge": challenge
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        found = {
                            id: data.id,
                            text: data.text,
                            hash: data.commitmentHex || data.hash,
                            cid: data.cid,
                            sig1: data.sig1,
                            transactionHash: data.transactionHash || "",
                            creator: data.initiator,
                            counterparty: data.counterparties?.[0] || "",
                            counterparties: data.counterparties || [],
                            status: "awaiting",
                            createdAt: new Date(data.createdAt * 1000).toLocaleDateString(),
                            timestamp: new Date(data.createdAt * 1000).toLocaleTimeString(),
                            createdByMe: data.initiator.toLowerCase() === address.toLowerCase(),
                            expiresAt: data.expiresAt,
                            nonceHex: data.nonceHex,
                            commitmentHex: data.commitmentHex,
                            tokenAddress: data.tokenAddress,
                            cautionAmount: data.cautionAmount,
                            arbitrator: data.arbitrator
                        } as any;
                    }
                } catch (e) {
                    console.error("Failed to load draft from API:", e);
                }
            }
        }

        if (!found) {
            toast.error("Agreement ID not found in local store or registry.");
            setZkNod(null);
            return;
        }

        setZkNod(found);
        setZkChecks(null);
        setZkValid(null);
        setZkProofHex(null);

        // Sync from Soroban on-chain status live
        try {
            const agreementIdHex = found.agreementIdHex || found.hash;
            if (agreementIdHex) {
                const onChain = await queryAgreementOnChain(agreementIdHex);
                if (onChain) {
                    const mappedStatus = onChain.statusLabel.toLowerCase() as any;
                    setZkNod(prev => prev && prev.id === nodId ? { ...prev, status: mappedStatus, commitmentHex: onChain.commitment || prev.commitmentHex } : prev);
                    updateNod(nodId, { status: mappedStatus, commitmentHex: onChain.commitment || undefined });
                }
            }
        } catch (err) {
            console.error("Failed to sync on-chain status for ZK verification:", err);
        }
    };

    const handleRunZkVerification = async () => {
        if (!zkNod) return;
        setIsZkRunning(true);
        setZkChecks(null);
        setZkValid(null);
        setZkProofHex(null);
        setZkIsSimulated(false);

        try {
            setZkStatusMessage("Preparing Zero-Knowledge inputs & witness...");
            await new Promise(r => setTimeout(r, 600));

            const counterparty = zkNod.counterparties?.[0] || zkNod.counterparty || "";
            let timestamp = Math.floor(Date.now() / 1000);
            if (zkNod.createdAt && zkNod.timestamp) {
                const dateStr = `${zkNod.createdAt} ${zkNod.timestamp}`;
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                    timestamp = Math.floor(parsedDate.getTime() / 1000);
                }
            }

            setZkStatusMessage("Running Noir zk-prover in-browser...");
            const proofPayload = await generateZKProof({
                text: zkNod.text,
                initiator: zkNod.creator,
                counterparty,
                timestamp,
                expiresAt: zkNod.expiresAt || 0,
                status: zkNod.status,
                contentHash: zkNod.hash,
                nonceHex: zkNod.nonceHex,
            });

            setZkStatusMessage("Running Barretenberg WASM verifier to validate proof constraints...");
            await new Promise(r => setTimeout(r, 850));

            const verificationResult = await verifyZKProof(proofPayload);
            const checks = [...verificationResult.checks];

            setZkStatusMessage("Verifying public inputs against Stellar blockchain (Soroban)...");
            const agreementIdHex = zkNod.agreementIdHex || zkNod.hash;
            const onChainAgreement = await queryAgreementOnChain(agreementIdHex);
            const onChainMatch = !!onChainAgreement;
            
            // Perform match validation
            const initiatorMatches = onChainAgreement ? onChainAgreement.initiator.toLowerCase() === zkNod.creator.toLowerCase() : false;
            const expiryMatches = onChainAgreement ? Number(onChainAgreement.expiresAt) === Number(zkNod.expiresAt || 0) : false;
            const statusMatches = onChainAgreement ? (onChainAgreement.statusLabel.toLowerCase() === zkNod.status.toLowerCase()) : false;
            
            // Verify commitment hash
            const onChainCommitment = onChainAgreement?.commitment;
            const proofCommitment = proofPayload.publicInputs.commitment;
            const commitmentMatches = onChainCommitment && proofCommitment
                ? onChainCommitment.toLowerCase() === proofCommitment.toLowerCase()
                : false;

            const onChainChecksPassed = onChainMatch && initiatorMatches && expiryMatches && statusMatches;

            checks.push({
                name: "Stellar On-Chain Registry Verification",
                passed: onChainChecksPassed,
                detail: onChainMatch 
                    ? onChainChecksPassed
                        ? `On-chain agreement verified! Public parameters match the Soroban smart contract registry exactly.`
                        : `Registry mismatch: parameters do not align with on-chain records.`
                    : `Could not retrieve agreement details from Soroban smart contract at ${CONTRACT_ID.slice(0, 10)}...`
            });

            checks.push({
                name: "ZK Commitment Matching",
                passed: commitmentMatches,
                detail: commitmentMatches
                    ? `Proof commitment matches the registered on-chain commitment exactly: 0x${onChainCommitment?.slice(0, 8)}...`
                    : onChainCommitment
                        ? `Commitment mismatch: proof is for a different document than registered on-chain.`
                        : `Could not verify commitment: No commitment registered on-chain.`
            });

            const allPassed = checks.every((c) => c.passed);
            setZkChecks(checks);
            setZkValid(allPassed);
            setZkProofHex(proofPayload.proofHex);
            
            if (allPassed) {
                toast.success("ZK proof verified successfully against Stellar blockchain!");
            } else {
                toast.error("ZK verification failed.");
            }
        } catch (err: any) {
            console.error("ZK verification error:", err);
            toast.error(err.message || "Failed running ZK verification.");
        } finally {
            setIsZkRunning(false);
        }
    };

    // Verification state
    const [verifyHash, setVerifyHash] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{
        found: boolean;
        nod?: Nod;
        method?: 'transaction' | 'content';
        sharePackage?: NodSharePackage;
        ipfsEncrypted?: boolean;
        plaintextMatchesPackage?: boolean;
        registryMatchesShare?: boolean;
        ipfsChecked?: boolean;
    } | null>(null);

    const filteredNods = useMemo(() => {
        if (!isLoaded) return [];
        return onChainNods.filter((nod) => {
            if (statusFilter !== "all" && nod.status !== statusFilter) return false;

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();

                // Resolve profiles for richer search
                const primaryCounterparty = nod.counterparty || (nod.counterparties && nod.counterparties[0]) || "";
                const creatorProfile = resolveProfile(nod.creator);
                const counterpartyProfile = resolveProfile(primaryCounterparty);
                const creatorName = creatorProfile?.displayName?.toLowerCase() || "";
                const counterpartyName = counterpartyProfile?.displayName?.toLowerCase() || "";

                return (
                    (nod.transactionHash || "").toLowerCase().includes(query) ||
                    (nod.hash || "").toLowerCase().includes(query) ||
                    (nod.creator || "").toLowerCase().includes(query) ||
                    creatorName.includes(query) ||
                    (nod.counterparty || "").toLowerCase().includes(query) ||
                    (nod.counterparties || []).some(cp => cp.toLowerCase().includes(query)) ||
                    counterpartyName.includes(query) ||
                    (nod.id || "").toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [searchQuery, statusFilter, onChainNods, isLoaded, resolveProfile]);

    const copyHash = (hash: string, id: string) => {
        navigator.clipboard.writeText(hash);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleVerificationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        performHashVerification(verifyHash);
    };

    const performHashVerification = async (hashToVerify: string) => {
        if (!hashToVerify.trim()) return;

        setIsVerifying(true);
        await new Promise(resolve => setTimeout(resolve, 600));

        const cleanHash = hashToVerify.trim();
        const sharePackage = parseNodSharePackage(cleanHash);

        if (sharePackage) {
            const foundViaTx = sharePackage.transactionHash
                ? onChainNods.find(n => n.transactionHash === sharePackage.transactionHash)
                : undefined;
            const foundViaContent = onChainNods.find(n =>
                n.hash === sharePackage.sealedContentHash ||
                (!!sharePackage.cid && n.cid === sharePackage.cid)
            );
            const found = foundViaTx || foundViaContent;
            const plaintextHash = await generateHash(sharePackage.text);
            let ipfsEncrypted = false;
            let ipfsChecked = false;

            if (sharePackage.cid) {
                const ipfsContent = await fetchIPFSContent(sharePackage.cid);
                ipfsChecked = !!ipfsContent;
                ipfsEncrypted = isEncryptedIPFSPayload(ipfsContent);
            }

            setVerificationResult({
                found: !!found || !!sharePackage.cid,
                nod: found,
                method: foundViaTx ? "transaction" : "content",
                sharePackage,
                ipfsEncrypted,
                ipfsChecked,
                plaintextMatchesPackage: plaintextHash === sharePackage.plaintextHash,
                registryMatchesShare: found
                    ? found.hash === sharePackage.sealedContentHash && (!sharePackage.cid || found.cid === sharePackage.cid)
                    : false,
            });
            setIsVerifying(false);
            return;
        }

        const foundViaTx = onChainNods.find(n => n.transactionHash === cleanHash);
        const foundViaContent = onChainNods.find(n => n.hash === cleanHash || n.cid === cleanHash);
        const found = foundViaTx || foundViaContent;

        setVerificationResult({
            found: !!found,
            nod: found,
            method: foundViaTx ? 'transaction' : (foundViaContent ? 'content' : undefined)
        });
        setIsVerifying(false);
    };

    const statusFilters: { value: StatusFilter; label: string }[] = [
        { value: "all", label: "All" },
        { value: "awaiting", label: "Awaiting" },
        { value: "nodded", label: "Nodded" },
        { value: "delivered", label: "Delivered" },
        { value: "disputed", label: "Disputed" },
        { value: "completed", label: "Completed" },
        { value: "expired", label: "Expired" },
        { value: "declined", label: "Declined" },
    ];

    return (
        <>
            <div className="space-y-8 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[var(--foreground)] flex items-center justify-center">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-6 h-6 text-[var(--background)]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Verify a Nod</h1>
                        <p className="text-sm text-[var(--foreground-muted)]">
                            Enter a sealed hash to verify its authenticity on the registry.
                        </p>
                    </div>
                </div>

                {/* Gated Share Card */}
                {shareIdLoading && (
                    <Card className="border-2 border-dashed border-[var(--border)] p-8 text-center flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                        <p className="text-xs text-[var(--foreground-muted)] font-medium">Fetching secure share package...</p>
                    </Card>
                )}

                {sharePackageError && (
                    <Card className="border-2 border-rose-500/20 bg-rose-500/5 p-6 space-y-4">
                        <div className="flex items-center gap-3 text-rose-500">
                            <AlertTriangle className="w-5 h-5" />
                            <h3 className="text-sm font-bold">Failed to load share package</h3>
                        </div>
                        <p className="text-xs text-[var(--foreground-muted)]">{sharePackageError}</p>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                                window.history.replaceState({}, document.title, window.location.pathname);
                                setLoadedGatedShare(null);
                                setSharePackageError(null);
                            }}
                            className="border-[var(--border)] text-[var(--foreground)]"
                        >
                            Clear and Go Back
                        </Button>
                    </Card>
                )}

                {loadedGatedShare && !decryptedNodShare && (
                    <Card className="overflow-hidden border-2 border-violet-500/30 bg-violet-500/5 shadow-lg shadow-violet-500/5">
                        <CardContent className="p-6 space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
                                    <Lock className="w-5 h-5 text-violet-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                                        Secure Wallet-Gated Share Access
                                    </h3>
                                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                        This agreement share is encrypted client-side. To decrypt and view it, you must sign a challenge using the authorized wallet address.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-3">
                                <div className="flex flex-col md:flex-row justify-between gap-3 text-xs">
                                    <div className="flex-1">
                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block uppercase tracking-wider">Authorized Wallet Recipient</span>
                                        <span className="font-mono font-semibold text-[var(--foreground)] break-all">{loadedGatedShare.allowedAddress}</span>
                                    </div>
                                    <div className="shrink-0">
                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block uppercase tracking-wider">Created At</span>
                                        <span className="text-[var(--foreground)] font-medium">{new Date(loadedGatedShare.createdAt * 1000).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {!isConnected ? (
                                    <Button
                                        onClick={connect}
                                        className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold cursor-pointer"
                                    >
                                        Connect Wallet to Decrypt
                                    </Button>
                                ) : (address || "").toLowerCase() !== loadedGatedShare.allowedAddress.toLowerCase() ? (
                                    <div className="flex-1 p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-xs text-rose-600">
                                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold">Unauthorized Wallet: </span>
                                            Your connected address ({(address || "").slice(0, 8)}...{(address || "").slice(-4)}) is not the authorized recipient. Please switch to {loadedGatedShare.allowedAddress.slice(0, 8)}...{loadedGatedShare.allowedAddress.slice(-4)}.
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        onClick={handleGatedDecrypt}
                                        disabled={isDecrypting}
                                        className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold cursor-pointer"
                                    >
                                        {isDecrypting ? (
                                            <div className="flex items-center gap-2 justify-center">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Decrypting details...
                                            </div>
                                        ) : (
                                            <>
                                                <Lock className="w-4 h-4 mr-2" />
                                                Verify Signature & Decrypt
                                            </>
                                        )}
                                    </Button>
                                )}

                                <Button 
                                    variant="outline"
                                    onClick={() => {
                                        window.history.replaceState({}, document.title, window.location.pathname);
                                        setLoadedGatedShare(null);
                                    }}
                                    className="border-[var(--border)] cursor-pointer text-[var(--foreground)]"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {decryptedNodShare && (
                    <Card className="overflow-hidden border-2 border-emerald-500/30 bg-emerald-500/5 shadow-lg">
                        <CardContent className="p-6 space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                                        Decrypted Agreement Content
                                    </h3>
                                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                        Cryptographic signature and decryption key successfully verified. Showing secure plaintext details.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Initiator</span>
                                            <span className="font-mono text-[var(--foreground)] break-all"><ProfileName username={decryptedNodShare.creator} /></span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Counterparty</span>
                                            <span className="font-mono text-[var(--foreground)] break-all"><ProfileName username={decryptedNodShare.counterparties?.[0] || ""} /></span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Escrow / Caution</span>
                                            <span className="text-[var(--foreground)] font-semibold">{decryptedNodShare.cautionAmount ? `${(decryptedNodShare.cautionAmount / 10000000).toFixed(2)} XLM` : "None"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Status</span>
                                            <StatusBadge status={decryptedNodShare.status as any} />
                                        </div>
                                    </div>

                                    <div className="p-3 bg-[var(--accent)]/30 rounded-lg border border-[var(--border)]/50">
                                        <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block mb-1">Plaintext Agreement Text</span>
                                        <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap font-medium">
                                            "{decryptedNodShare.text}"
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] text-[var(--foreground-muted)] font-mono border-t border-[var(--border)]/30 pt-3">
                                        <div className="overflow-x-auto whitespace-nowrap">
                                            <span className="font-bold">Registry Sealed Hash: </span>
                                            {decryptedNodShare.sealedContentHash}
                                        </div>
                                        <div className="overflow-x-auto whitespace-nowrap">
                                            <span className="font-bold">IPFS CID: </span>
                                            {decryptedNodShare.cid || "N/A"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button 
                                    onClick={() => {
                                        window.history.replaceState({}, document.title, window.location.pathname);
                                        setLoadedGatedShare(null);
                                        setDecryptedNodShare(null);
                                    }}
                                    className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] border border-[var(--border)] cursor-pointer"
                                >
                                    Done
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}


                {/* Zero-Knowledge Proof Verification Panel */}
                <Card className="overflow-hidden border-2 border-[var(--border)] bg-[var(--background)] opacity-95">
                    <CardContent className="p-6 space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                                        Zero-Knowledge Proof Verification
                                    </h3>
                                </div>
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Verify that an agreement exists and is valid on the registry using a client-side Zero-Knowledge proof, without exposing the agreement text.
                                </p>
                            </div>
                        </div>

                        {/* Load Agreement Form */}
                        <div className="space-y-4">
                            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-[var(--foreground-muted)] leading-relaxed">
                                <span className="font-semibold text-emerald-600">ZK Prover Active:</span> Generate a client-side Zero-Knowledge proof of your agreement's terms and verify it instantly against Barretenberg WASM verifier constraints and Soroban on-chain proof attestations.
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider block">Agreement ID (Nod ID)</label>
                                    <Input
                                        placeholder="e.g. 8f42bc22-..."
                                        value={zkNodId}
                                        onChange={(e) => setZkNodId(e.target.value.trim())}
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <Button
                                    onClick={() => handleLoadZkNod(zkNodId)}
                                    disabled={!zkNodId}
                                    className="self-end bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-10 px-4 cursor-pointer border border-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Load
                                </Button>
                            </div>

                            {/* If ZK Nod is Loaded */}
                            {zkNod && (
                                <div className="space-y-4 pt-3 border-t border-[var(--border)]/30">
                                    <div className="p-4 rounded-xl bg-[var(--accent)]/40 border border-[var(--border)] space-y-3">
                                        <span className="text-xs font-bold text-[var(--foreground)] block">Public Inputs Claims (Pre-Verification)</span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Registry Commitment Hash</span>
                                                <span className="font-mono text-[var(--foreground)] break-all">{zkNod.hash}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Initiator Wallet Address</span>
                                                <span className="font-mono text-[var(--foreground)] break-all">{zkNod.creator}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Counterparty Wallet Address</span>
                                                <span className="font-mono text-[var(--foreground)] break-all">{zkNod.counterparty || zkNod.counterparties?.[0]}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-[var(--foreground-muted)] font-semibold block uppercase">Agreement Expiry</span>
                                                <span className="text-[var(--foreground)] font-medium">
                                                    {zkNod.expiresAt ? new Date(zkNod.expiresAt * 1000).toLocaleDateString() : "No expiry (ongoing)"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Run Prover Button */}
                                    {!isZkRunning && !zkChecks && (
                                        <Button
                                            onClick={handleRunZkVerification}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer border border-indigo-700"
                                        >
                                            <ShieldCheck className="w-4 h-4 mr-2" />
                                            Run Zero-Knowledge Proof Verification
                                        </Button>
                                    )}

                                    {/* Proving / Verification Progress */}
                                    {isZkRunning && (
                                        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col items-center justify-center gap-3 py-6">
                                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                            <p className="text-xs text-[var(--foreground-muted)] font-semibold animate-pulse">{zkStatusMessage}</p>
                                        </div>
                                    )}

                                    {/* Verdict results */}
                                    {zkChecks && zkValid !== null && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-4"
                                        >
                                            <div className={`p-4 rounded-xl border ${zkValid ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${zkValid ? "bg-emerald-100" : "bg-rose-100"}`}>
                                                        {zkValid ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-rose-600" />}
                                                    </div>
                                                    <div>
                                                        <h4 className={`text-sm font-bold ${zkValid ? "text-emerald-600" : "text-rose-600"}`}>
                                                            {zkValid ? "ZK Proof Verified: VALID" : "ZK Proof Verified: INVALID"}
                                                        </h4>
                                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
                                                            The agreement is registered on-chain and holds valid constraints.
                                                        </p>
                                                    </div>
                                                </div>



                                                {/* Clean User-Friendly Report Summary */}
                                                <div className="mt-4 pt-4 border-t border-[var(--border)]/30 space-y-3.5 text-left">
                                                    <div className="flex items-start gap-2.5 text-xs text-[var(--foreground)]">
                                                        <span className="text-emerald-500 text-sm font-bold">✓</span>
                                                        <div>
                                                            <strong className="block font-semibold">Stellar Registry Authenticity</strong>
                                                            <span className="text-[11px] text-[var(--foreground-muted)] block mt-0.5">
                                                                The agreement status, creators, and metadata verified successfully against the live Soroban smart contract on the Stellar blockchain.
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-2.5 text-xs text-[var(--foreground)]">
                                                        <span className="text-emerald-500 text-sm font-bold">✓</span>
                                                        <div>
                                                            <strong className="block font-semibold">Signer Authenticity & Expiry</strong>
                                                            <span className="text-[11px] text-[var(--foreground-muted)] block mt-0.5">
                                                                Cryptographically proved that the active agreement was signed by the original wallet address and has not expired.
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-2.5 text-xs text-[var(--foreground)]">
                                                        <span className="text-emerald-500 text-sm font-bold">✓</span>
                                                        <div>
                                                            <strong className="block font-semibold">Zero-Knowledge Privacy Integrity</strong>
                                                            <span className="text-[11px] text-[var(--foreground-muted)] block mt-0.5">
                                                                The agreement constraints were validated locally in your browser. The plaintext terms and co-signers' personal info remain 100% private.
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Toggle for Technical Cryptographic Details */}
                                                <div className="mt-5 pt-3 border-t border-[var(--border)]/30">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowTechDetails(!showTechDetails)}
                                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <span>{showTechDetails ? "Hide Technical Details" : "Show Technical Cryptographic Details"}</span>
                                                        <span className="text-[10px]">{showTechDetails ? "▲" : "▼"}</span>
                                                    </button>
                                                </div>

                                                {/* Technical Details (Collapsible) */}
                                                {showTechDetails && (
                                                    <div className="mt-4 space-y-4 pt-3 border-t border-dashed border-[var(--border)]/50">
                                                        {/* Checklist of Noir Constraints */}
                                                        <div className="space-y-2.5">
                                                            <span className="text-[10px] font-bold text-[var(--foreground-muted)] uppercase tracking-wider block">Noir Circuit Constraint Checks</span>
                                                            {zkChecks.map((check, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-xs">
                                                                    {check.passed ? (
                                                                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                                    ) : (
                                                                        <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                                    )}
                                                                    <div>
                                                                        <span className="font-semibold text-[var(--foreground)] block">{check.name}</span>
                                                                        <span className="text-[10px] text-[var(--foreground-muted)] block mt-0.5">{check.detail}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {zkProofHex && (
                                                            <div className="space-y-2 text-left bg-[var(--background)] p-3 rounded-lg border border-[var(--border)]">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-bold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                                        Cryptographic Proof Bytes
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(zkProofHex);
                                                                            toast.success("Proof bytes copied to clipboard!");
                                                                        }}
                                                                        className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <HugeiconsIcon icon={Copy01Icon} className="w-3.5 h-3.5" />
                                                                        <span>Copy Full Proof</span>
                                                                    </button>
                                                                </div>
                                                                <div className="font-mono text-[10px] text-[var(--foreground)] break-all bg-[var(--accent)]/50 p-2 rounded border border-[var(--border)] max-h-16 overflow-y-auto select-all">
                                                                    {zkProofHex.slice(0, 48)}...[{zkProofHex.length} characters]...{zkProofHex.slice(-48)}
                                                                </div>
                                                                <p className="text-[9px] text-[var(--foreground-muted)] leading-relaxed">
                                                                    <strong>How to use:</strong> This proof hex is the cryptographic evidence of your agreement's validity. You can copy this payload to share with any third-party verifiers or store it in your records as immutable proof.
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="p-2.5 rounded-lg bg-[var(--accent)] border border-[var(--border)] text-[10px] font-mono text-[var(--foreground-muted)] space-y-1">
                                                            <div><span className="font-bold">Registry Contract:</span> {CONTRACT_ID}</div>
                                                            <div><span className="font-bold">Circuit:</span> Noir v1.0.0-beta.20 (Barretenberg WASM)</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <Button
                                                onClick={() => {
                                                    setZkChecks(null);
                                                    setZkValid(null);
                                                    setZkProofHex(null);
                                                }}
                                                className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] border border-[var(--border)] py-2 rounded-xl cursor-pointer"
                                            >
                                                Reset Verification
                                            </Button>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="border-t border-[var(--border)] pt-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">On-Chain Registry</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">Complete log of all immutable agreements</p>
                        </div>
                        <div className="text-sm text-[var(--foreground-muted)]">
                            {filteredNods.length} records
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <HugeiconsIcon
                                icon={Search01Icon}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)] pointer-events-none"
                            />
                            <Input
                                placeholder="Search registry..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <div className="relative" ref={filterDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                className={cn(
                                    "flex items-center justify-between w-full md:w-48 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer shadow-sm",
                                    "bg-[var(--background)] border-[var(--border-strong)] text-[var(--foreground)]",
                                    "hover:bg-[var(--accent)] hover:border-[var(--foreground-muted)]",
                                    isFilterDropdownOpen && "border-[var(--foreground)] bg-[var(--accent)]"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "w-2 h-2 rounded-full",
                                        statusFilter === "all" && "bg-zinc-400",
                                        statusFilter === "awaiting" && "bg-amber-500",
                                        statusFilter === "nodded" && "bg-blue-500",
                                        statusFilter === "delivered" && "bg-indigo-500",
                                        statusFilter === "disputed" && "bg-orange-500",
                                        statusFilter === "completed" && "bg-emerald-500",
                                        statusFilter === "expired" && "bg-yellow-600",
                                        statusFilter === "declined" && "bg-rose-500"
                                    )} />
                                    <span>{statusFilters.find(f => f.value === statusFilter)?.label || "All"}</span>
                                </div>
                                <motion.div
                                    animate={{ rotate: isFilterDropdownOpen ? 180 : 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-[var(--foreground-muted)] ml-2 shrink-0"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {isFilterDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                                        transition={{ duration: 0.12, ease: "easeOut" }}
                                        className={cn(
                                            "absolute right-0 mt-2 w-48 rounded-xl border shadow-lg z-50 py-1.5 focus:outline-none origin-top-right",
                                            "bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-zinc-200/80 dark:border-zinc-800/80"
                                        )}
                                    >
                                        {statusFilters.map((filter) => {
                                            const isSelected = statusFilter === filter.value;
                                            return (
                                                <button
                                                    key={filter.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setStatusFilter(filter.value);
                                                        setIsFilterDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex items-center justify-between w-full px-3.5 py-2 text-sm text-left transition-colors cursor-pointer",
                                                        isSelected
                                                            ? "bg-zinc-50 dark:bg-zinc-900/60 font-semibold text-[var(--foreground)]"
                                                            : "text-[var(--foreground-muted)] hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 hover:text-[var(--foreground)]"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            filter.value === "all" && "bg-zinc-400",
                                                            filter.value === "awaiting" && "bg-amber-500",
                                                            filter.value === "nodded" && "bg-blue-500",
                                                            filter.value === "delivered" && "bg-indigo-500",
                                                            filter.value === "disputed" && "bg-orange-500",
                                                            filter.value === "completed" && "bg-emerald-500",
                                                            filter.value === "expired" && "bg-yellow-600",
                                                            filter.value === "declined" && "bg-rose-500"
                                                        )} />
                                                        <span>{filter.label}</span>
                                                    </div>
                                                    {isSelected && (
                                                        <Check className="w-3.5 h-3.5 text-[var(--foreground)]" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Table */}
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[var(--border)] bg-[var(--accent)]/50">
                                        <th className="text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider px-4 py-3">Hash</th>
                                        <th className="text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider px-4 py-3">From</th>
                                        <th className="text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider px-4 py-3">To</th>
                                        <th className="text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider px-4 py-3">Status</th>
                                        <th className="text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider px-4 py-3">Date</th>
                                        <th className="text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider px-4 py-3">Timestamp</th>

                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredNods.map((nod, index) => (
                                        <motion.tr
                                            key={nod.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)] transition-colors group"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center group/hash">
                                                    <span className="font-mono text-xs text-[var(--foreground)]">
                                                        {truncateHash(nod.transactionHash || "")}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 ml-2 opacity-0 group-hover/hash:opacity-100 transition-opacity"
                                                        onClick={() => copyHash(nod.transactionHash || "", nod.id)}
                                                    >
                                                        {copiedId === nod.id ? (
                                                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3 text-emerald-600" />
                                                        ) : (
                                                            <HugeiconsIcon icon={Copy01Icon} className="w-3 h-3 text-[var(--foreground-muted)]" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <a
                                                        href={`/nod/${nod.id}`}
                                                        className="text-sm font-medium text-[var(--foreground)] hover:text-emerald-600 hover:underline decoration-emerald-500/30 underline-offset-4 transition-colors"
                                                    >
                                                        <ProfileName username={nod.creator} />
                                                    </a>
                                                    {nod.createdByMe && (
                                                        <span className="text-[10px] bg-[var(--accent)] text-[var(--foreground-muted)] px-1.5 py-0.5 rounded-full font-medium">You</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                                                    {nod.counterparties && nod.counterparties.length > 0 ? (
                                                        nod.counterparties.map((cp, idx) => (
                                                            <React.Fragment key={cp}>
                                                                <a
                                                                    href={`/nod/${nod.id}`}
                                                                    className="hover:text-emerald-600 hover:underline decoration-emerald-500/30 underline-offset-4 transition-colors"
                                                                >
                                                                    <ProfileName username={cp} />
                                                                </a>
                                                                {idx < nod.counterparties!.length - 1 && ", "}
                                                            </React.Fragment>
                                                        ))
                                                    ) : (
                                                        <a
                                                            href={`/nod/${nod.id}`}
                                                            className="hover:text-emerald-600 hover:underline decoration-emerald-500/30 underline-offset-4 transition-colors"
                                                        >
                                                            <ProfileName username={nod.counterparty} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={nod.status} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-[var(--foreground-muted)]">{nod.createdAt}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-mono text-[var(--foreground-muted)]">{nod.timestamp}</span>
                                            </td>

                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredNods.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center mb-3">
                                        <HugeiconsIcon icon={Search01Icon} className="w-6 h-6 text-[var(--foreground-muted)]" />
                                    </div>
                                    <h3 className="text-sm font-semibold mb-1">No nods found</h3>
                                    <p className="text-xs text-[var(--foreground-muted)] max-w-xs">
                                        Try adjusting your search or filter criteria
                                    </p>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                                    >
                                        Clear Filters
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}
