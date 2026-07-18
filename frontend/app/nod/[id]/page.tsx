"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft01Icon,
    User03Icon,
    Calendar03Icon,
    Clock01Icon,
    Search01Icon,
    CheckmarkCircle01Icon,
    CancelCircleIcon,
    Coins01Icon,
    SecurityCheckIcon,
    HourglassIcon,
    Alert01Icon,
    Copy01Icon,
    Tick01Icon,
    Share01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShareModal } from "@/components/nod/share-modal";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/nod/status-badge";
import { useNods, type Nod } from "@/lib/store";
import { ProfileName } from "@/components/nod/profile-name";
import { NodIdentityCard } from "@/components/profile/nod-identity-card";
import { ZKVerificationPanel } from "@/components/nod/zk-verification-panel";
import { useStellarWallet } from "@/components/providers/stellar-provider";
import { 
    signTxWithFreighter, 
    submitStellarTx, 
    buildDeclineAgreementTx,
    buildCompleteAgreementTx,
    buildClaimExpiredTx,
    buildMarkDeliveredTx,
    buildRaiseDisputeTx,
    buildResolveDisputeTx,
    buildAutoCompleteDeliveredTx,
    buildAcceptAgreementTx,
    signMessageWithFreighter,
    CONTRACT_ID
} from "@/lib/stellar";
import { useToast } from "@/components/ui/toast";
import { generateHash } from "@/lib/utils";
import { queryAgreementOnChain, fetchIPFSContent, type OnChainAgreement } from "@/lib/soroban-query";
import { isEncryptedIPFSPayload } from "@/lib/ipfs-encryption";
import { buildNodSharePackage, encodeNodSharePackage, parseNodSharePackage, decryptPayloadWithKey } from "@/lib/nod-share";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Wallet, Copy, Check } from "lucide-react";

const TEMPLATES = [
    { id: "freelancer", subtitle: "Freelancer / Client" },
    { id: "friends", subtitle: "Social Repayment" },
    { id: "roommates", subtitle: "Shared House Rules" },
    { id: "vendor", subtitle: "Business Purchase" }
] as const;

function extractAgreementTextFromIPFS(content: unknown): string {
    if (!content) return "";

    if (typeof content === "string") {
        try {
            const parsed = JSON.parse(content);
            return extractAgreementTextFromIPFS(parsed);
        } catch {
            return content;
        }
    }

    if (typeof content === "object" && "text" in content) {
        const text = (content as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
    }

    return "";
}

export default function NodDetailPage() {
    const params = useParams();
    const router = useRouter();
    const nodId = params.id as string;
    const { getNodById, updateNod, addNod, isLoaded } = useNods();

    const nod = getNodById(nodId);
    
    const [fetchedDraft, setFetchedDraft] = useState<Nod | null>(null);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [isDecryptingShare, setIsDecryptingShare] = useState(false);
    const [decryptedText, setDecryptedText] = useState<string | null>(null);

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

    const activeNod = nod || fetchedDraft;

    const [isActionLoading, setIsActionLoading] = useState<"accept" | "reject" | "complete" | "claim" | "deliver" | "dispute" | "resolve" | null>(null);
    const [hasAccess, setHasAccess] = useState(false);
    const [shareInput, setShareInput] = useState("");
    const [shareError, setShareError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isExpired, setIsExpired] = useState(false);
    const [showVerifyGuide, setShowVerifyGuide] = useState(false);
    const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

    // Live verification states
    const [verifyStep, setVerifyStep] = useState<0 | 1 | 2 | 3>(0);
    const [isVerifyRunning, setIsVerifyRunning] = useState(false);
    const [contentCheck, setContentCheck] = useState<{ passed: boolean; ipfsText: string; ipfsContent: unknown; expectedText: string; encrypted?: boolean } | null>(null);
    const [ipfsCheck, setIpfsCheck] = useState<{ passed: boolean; data: Record<string, unknown> | null; error?: string } | null>(null);
    const [contractCheck, setContractCheck] = useState<{ passed: boolean; data: OnChainAgreement | null; error?: string } | null>(null);
    
    // Draft-specific states loaded from relay
    const [draftSignedCounterparties, setDraftSignedCounterparties] = useState<string[]>([]);
    const [draftSig1, setDraftSig1] = useState<string>("");
    const [agreementIdHex, setAgreementIdHex] = useState<string>("");
    const [shareCopied, setShareCopied] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const toast = useToast();
    const { address, isConnected, connect, isInitializing } = useStellarWallet();

    // Try to load draft from relay if not in local store
    useEffect(() => {
        if (nod || !isLoaded) return;

        setIsLoadingDraft(true);
        fetch(`/api/nods/draft?id=${nodId}`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("Draft not found in relay");
            })
            .then(data => {
                setFetchedDraft({
                    id: data.id,
                    text: data.text,
                    hash: data.hash || "",
                    cid: data.cid,
                    transactionHash: data.transactionHash || "",
                    creator: data.initiator,
                    counterparty: data.counterparties[0] || "",
                    counterparties: data.counterparties,
                    status: data.status || "awaiting",
                    createdAt: new Date(data.createdAt * 1000).toLocaleDateString(),
                    timestamp: new Date(data.createdAt * 1000).toLocaleTimeString(),
                    createdByMe: false,
                    expiresAt: data.expiresAt,
                    cautionAmount: data.cautionAmount,
                    agreementIdHex: data.agreementIdHex,
                    tokenAddress: data.tokenAddress,
                    arbitrator: data.arbitrator
                });
            })
            .catch(err => {
                console.log("Failed to load draft from relay:", err.message);
            })
            .finally(() => {
                setIsLoadingDraft(false);
            });
    }, [nod, nodId, isLoaded]);

    // Parse package query parameter on details page load to automatically decrypt and bypass gate
    useEffect(() => {
        if (!isLoaded || !nodId || typeof window === "undefined") return;

        const queryParams = new URLSearchParams(window.location.search);
        const pkgParam = queryParams.get("package");
        if (pkgParam) {
            try {
                const sharePackage = parseNodSharePackage(pkgParam);
                if (sharePackage && sharePackage.nodId === nodId) {
                    const newNod: Nod = {
                        id: sharePackage.nodId,
                        text: sharePackage.text,
                        hash: sharePackage.sealedContentHash,
                        cid: sharePackage.cid,
                        transactionHash: sharePackage.transactionHash || "",
                        creator: sharePackage.creator,
                        counterparty: sharePackage.counterparties?.[0] || "",
                        counterparties: sharePackage.counterparties || [],
                        status: sharePackage.status as any,
                        createdAt: sharePackage.createdAt,
                        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                        createdByMe: false,
                        expiresAt: sharePackage.expiresAt,
                        cautionAmount: sharePackage.cautionAmount,
                        ipfsEncrypted: sharePackage.ipfsEncrypted
                    };

                    const existing = getNodById(nodId);
                    if (!existing) {
                        addNod(newNod);
                    } else {
                        updateNod(nodId, newNod);
                    }

                    setFetchedDraft(newNod);

                    const verifiedShares = JSON.parse(sessionStorage.getItem("verified_nod_shares") || "{}");
                    verifiedShares[nodId] = true;
                    sessionStorage.setItem("verified_nod_shares", JSON.stringify(verifiedShares));

                    setHasAccess(true);
                    toast.success("Agreement decrypted & loaded via direct link!");
                    
                    // Clean up URL query parameters
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                }
            } catch (err) {
                console.error("Failed to parse package from URL:", err);
            }
        }
        const shareIdParam = queryParams.get("shareId");
        if (shareIdParam) {
            handleDecryptWithShareId(shareIdParam);
            // Clean up URL query parameters
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }, [isLoaded, nodId, isConnected, address]);

    // Load draft info from backend if signatures/agreement ID are not present locally
    useEffect(() => {
        if (!activeNod || !isLoaded) return;

        fetch(`/api/nods/draft?id=${nodId}`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("Draft not found in relay");
            })
            .then(data => {
                if (data.sig1) setDraftSig1(data.sig1);
                if (data.signedCounterparties) setDraftSignedCounterparties(data.signedCounterparties);
                if (data.agreementIdHex) setAgreementIdHex(data.agreementIdHex);
            })
            .catch(err => {
                console.log("Agreement already on-chain or not found on relay:", err.message);
                if (activeNod.agreementIdHex) setAgreementIdHex(activeNod.agreementIdHex);
            });
    }, [activeNod, nodId, isLoaded]);

    useEffect(() => {
        if (!activeNod || !isLoaded || isInitializing) return;

        const isWalletParticipant = !!address && (
            activeNod.creator === address ||
            activeNod.counterparties.includes(address) ||
            activeNod.arbitrator === address
        );

        // We only grant access automatically if they are a participant and the terms text is already fetched/present
        const hasText = !!activeNod.text && activeNod.text !== "";

        const verifiedShares = JSON.parse(sessionStorage.getItem("verified_nod_shares") || "{}");
        setHasAccess((isWalletParticipant && hasText) || verifiedShares[nodId] === true);
    }, [activeNod, nodId, isLoaded, isInitializing, address]);

    const decryptDraftForParticipant = async () => {
        if (!address || !activeNod) return;

        setIsDecryptingShare(true);
        setShareError(null);
        try {
            const challenge = `Challenge: Decrypt/Verify Nod Draft ${nodId} at ${new Date().toISOString()}`;
            const signatureHex = await signMessageWithFreighter(challenge, address);

            const res = await fetch(`/api/nods/draft?id=${nodId}`, {
                headers: {
                    "x-auth-address": address,
                    "x-auth-signature": signatureHex,
                    "x-auth-challenge": challenge
                }
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Failed to authenticate participant");
            }

            const data = await res.json();
            if (!data.text) {
                throw new Error("Plaintext terms not returned from server.");
            }

            const newNod: Nod = {
                id: data.id,
                text: data.text,
                hash: data.hash || "",
                cid: data.cid,
                transactionHash: data.transactionHash || "",
                creator: data.initiator,
                counterparty: data.counterparties?.[0] || "",
                counterparties: data.counterparties || [],
                status: data.status || "awaiting",
                createdAt: new Date(data.createdAt * 1000).toLocaleDateString(),
                timestamp: new Date(data.createdAt * 1000).toLocaleTimeString(),
                createdByMe: data.initiator === address,
                expiresAt: data.expiresAt,
                cautionAmount: data.cautionAmount,
                agreementIdHex: data.agreementIdHex,
                tokenAddress: data.tokenAddress,
                arbitrator: data.arbitrator
            };

            const existing = getNodById(nodId);
            if (!existing) {
                addNod(newNod);
            } else {
                updateNod(nodId, newNod);
            }

            setFetchedDraft(newNod);
            
            const verifiedShares = JSON.parse(sessionStorage.getItem("verified_nod_shares") || "{}");
            verifiedShares[nodId] = true;
            sessionStorage.setItem("verified_nod_shares", JSON.stringify(verifiedShares));

            setHasAccess(true);
            toast.success("Agreement terms loaded & decrypted successfully!");
        } catch (err: any) {
            console.error("Participant verification failed:", err);
            setShareError(err.message || "Participant verification failed.");
            toast.error(err.message || "Participant verification failed.");
        } finally {
            setIsDecryptingShare(false);
        }
    };

    const verifySharePackageForAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeNod) return;

        const sharePackage = parseNodSharePackage(shareInput);
        if (!sharePackage) {
            setShareError("Paste a valid nodshare verification package.");
            return;
        }

        const plaintextHash = await generateHash(sharePackage.text);
        const matchesNod = sharePackage.nodId === activeNod.id ||
            sharePackage.sealedContentHash === activeNod.hash ||
            (!!activeNod.cid && sharePackage.cid === activeNod.cid);
        const matchesPlaintext = plaintextHash === sharePackage.plaintextHash && sharePackage.text === activeNod.text;

        if (!matchesNod || !matchesPlaintext) {
            setShareError("This verification package does not match this Nod.");
            return;
        }

        const verifiedShares = JSON.parse(sessionStorage.getItem("verified_nod_shares") || "{}");
        verifiedShares[nodId] = true;
        sessionStorage.setItem("verified_nod_shares", JSON.stringify(verifiedShares));
        setShareError(null);
        setHasAccess(true);
    };

    async function handleDecryptWithShareId(shareIdToDecrypt: string) {
        if (!shareIdToDecrypt.trim()) return;
        if (!isConnected || !address) {
            toast.error("Please connect your wallet first.");
            await connect();
            return;
        }

        setIsDecryptingShare(true);
        setShareError(null);
        try {
            const res = await fetch(`/api/nods/share?shareId=${shareIdToDecrypt.trim()}`);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Failed to fetch share package");
            }
            const shareData = await res.json();
            
            if (shareData.type !== "gated") {
                throw new Error("This share package is not a wallet-gated share.");
            }

            if (address.toLowerCase() !== shareData.allowedAddress.toLowerCase()) {
                throw new Error(`Access Denied: Connected wallet is not the authorized recipient.`);
            }

            const challenge = `Challenge: Decrypt Nod Share Package ${shareIdToDecrypt.trim()} at ${new Date().toISOString()}`;
            const signatureHex = await signMessageWithFreighter(challenge, address);

            const keyRes = await fetch("/api/nods/share/decrypt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shareId: shareIdToDecrypt.trim(),
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
                throw new Error("Failed to retrieve decryption key.");
            }

            const decryptedText = await decryptPayloadWithKey(
                shareData.encryptedPayload,
                keyData.iv,
                keyData.key
            );

            const packageData = JSON.parse(decryptedText);
            
            const newNod: Nod = {
                id: packageData.nodId,
                text: packageData.text,
                hash: packageData.sealedContentHash,
                cid: packageData.cid,
                transactionHash: packageData.transactionHash || "",
                creator: packageData.creator,
                counterparty: packageData.counterparties?.[0] || "",
                counterparties: packageData.counterparties || [],
                status: packageData.status as any,
                createdAt: packageData.createdAt,
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                createdByMe: false,
                expiresAt: packageData.expiresAt,
                cautionAmount: packageData.cautionAmount,
                ipfsEncrypted: packageData.ipfsEncrypted
            };

            const existing = getNodById(packageData.nodId);
            if (!existing) {
                addNod(newNod);
            } else {
                updateNod(packageData.nodId, newNod);
            }

            setDecryptedText(packageData.text);
            
            const verifiedShares = JSON.parse(sessionStorage.getItem("verified_nod_shares") || "{}");
            verifiedShares[packageData.nodId] = true;
            sessionStorage.setItem("verified_nod_shares", JSON.stringify(verifiedShares));

            setHasAccess(true);
            toast.success("Agreement decrypted successfully!");
        } catch (err: any) {
            console.error("Decryption failed:", err);
            setShareError(err.message || "Decryption failed.");
            toast.error(err.message || "Decryption failed.");
        } finally {
            setIsDecryptingShare(false);
        }
    };

    // Expiry and Review Window timer countdown
    useEffect(() => {
        if (!activeNod) return;

        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);

            if (activeNod.status === "delivered" && activeNod.deliveredAt) {
                const diff = (activeNod.deliveredAt + 259200) - now; // 72 hours
                if (diff <= 0) {
                    setTimeLeft("Review Window Expired");
                    setIsExpired(true);
                } else {
                    const hours = Math.floor(diff / 3600);
                    const mins = Math.floor((diff % 3600) / 60);
                    const secs = diff % 60;
                    setTimeLeft(`Review Window: ${hours}h ${mins}m ${secs}s`);
                    setIsExpired(false);
                }
            } else if (activeNod.expiresAt) {
                const diff = activeNod.expiresAt - now;

                if (diff <= 0) {
                    setTimeLeft("Expired");
                    setIsExpired(true);
                } else {
                    const days = Math.floor(diff / (24 * 3600));
                    const hours = Math.floor((diff % (24 * 3600)) / 3600);
                    const mins = Math.floor((diff % 3600) / 60);
                    const secs = diff % 60;
                    
                    let timeStr = "";
                    if (days > 0) timeStr += `${days}d `;
                    if (hours > 0 || days > 0) timeStr += `${hours}h `;
                    timeStr += `${mins}m ${secs}s`;
                    setTimeLeft(timeStr);
                    setIsExpired(false);
                }
            } else {
                setTimeLeft("");
                setIsExpired(false);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [nod]);

    if (!isLoaded) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 pt-10">
                <div className="h-6 w-32 bg-[var(--accent)] rounded animate-pulse" />
                <div className="h-[400px] w-full bg-[var(--accent)] rounded-xl animate-pulse" />
            </div>
        );
    }

    if (!activeNod) {
        if (isLoadingDraft) {
            return (
                <div className="max-w-2xl mx-auto space-y-6 pt-10 text-center flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                    <p className="text-sm text-[var(--foreground-muted)] font-medium">Loading agreement from relay...</p>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center mb-4 border border-[var(--border)]">
                    <HugeiconsIcon icon={Search01Icon} className="w-8 h-8 text-[var(--foreground-muted)]" />
                </div>
                <h1 className="text-xl font-semibold mb-2">Nod Not Found</h1>
                <p className="text-sm text-[var(--foreground-muted)] mb-6">
                    The nod you're looking for doesn't exist or has been removed.
                </p>
                <Button asChild>
                    <Link href="/">
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
        );
    }

    const handleAccept = async () => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("accept");

        try {
            if (!agreementIdHex) {
                throw new Error("Agreement ID not found.");
            }

            toast.info("Building accept agreement transaction on Stellar...");
            const unsignedXdr = await buildAcceptAgreementTx({
                counterparty: address,
                agreementIdHex
            });

            const signedXdr = await signTxWithFreighter(unsignedXdr);
            toast.info("Submitting acceptance transaction to Stellar Soroban...");
            const txHash = await submitStellarTx(signedXdr);

            const currentSigned = [...draftSignedCounterparties];
            if (!currentSigned.includes(address)) {
                currentSigned.push(address);
            }

            const isFinalCounterparty = currentSigned.length === activeNod.counterparties.length;

            if (isFinalCounterparty) {
                updateNod(nodId, {
                    status: "nodded",
                    transactionHash: txHash,
                    sig1: signedXdr,
                    signedCounterparties: currentSigned,
                    completedParties: []
                });

                await fetch("/api/nods/draft", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: nodId,
                        cid: activeNod.cid,
                        initiator: activeNod.creator,
                        counterparties: activeNod.counterparties,
                        signedCounterparties: currentSigned,
                        text: activeNod.text,
                        sig1: signedXdr,
                        expiresAt: activeNod.expiresAt,
                        agreementIdHex,
                        tokenAddress: activeNod.tokenAddress,
                        cautionAmount: activeNod.cautionAmount,
                        arbitrator: activeNod.arbitrator
                      }),
                });

                toast.success(`Nod successfully accepted and active on Stellar! Tx Hash: ${txHash.slice(0, 8)}...`);
            } else {
                setDraftSig1(signedXdr);
                setDraftSignedCounterparties(currentSigned);

                await fetch("/api/nods/draft", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: nodId,
                        cid: activeNod.cid,
                        initiator: activeNod.creator,
                        counterparties: activeNod.counterparties,
                        signedCounterparties: currentSigned,
                        text: activeNod.text,
                        sig1: signedXdr,
                        expiresAt: activeNod.expiresAt,
                        agreementIdHex,
                        tokenAddress: activeNod.tokenAddress,
                        cautionAmount: activeNod.cautionAmount,
                        arbitrator: activeNod.arbitrator
                    }),
                });

                toast.success("Accepted successfully! Waiting for other counterparties to sign.");
            }
        } catch (error: any) {
            console.error("Failed to accept nod:", error);
            toast.error(`Accepting failed: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleDecline = async () => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("reject");

        try {
            const unsignedDeclineXdr = await buildDeclineAgreementTx({
                initiator: activeNod.creator,
                counterparty: address,
                cid: activeNod.cid || "",
                agreementIdHex: agreementIdHex || Array.from({ length: 32 }, () => '0').join('')
            });

            const signedDeclineXdr = await signTxWithFreighter(unsignedDeclineXdr);
            const txHash = await submitStellarTx(signedDeclineXdr);

            updateNod(nodId, {
                status: "declined",
                transactionHash: txHash
            });

            toast.success(`Agreement declined successfully. On-chain receipt: ${txHash.slice(0, 8)}...`);
        } catch (error: any) {
            console.error("Failed to decline agreement:", error);
            toast.error(`Decline failed: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleComplete = async () => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("complete");

        try {
            const unsignedXdr = await buildCompleteAgreementTx({
                party: address,
                agreementIdHex: agreementIdHex || Array.from({ length: 32 }, () => '0').join('')
            });

            const signedXdr = await signTxWithFreighter(unsignedXdr);
            const txHash = await submitStellarTx(signedXdr);

            const updatedCompletedParties = [...(activeNod.completedParties || [])];
            if (!updatedCompletedParties.includes(address)) {
                updatedCompletedParties.push(address);
            }

            const isDeliveryAcceptance = activeNod.status === "delivered";
            const totalExpectedParties = activeNod.counterparties.length + 1;
            const fullyCompleted = isDeliveryAcceptance || updatedCompletedParties.length === totalExpectedParties;

            updateNod(nodId, {
                completedParties: updatedCompletedParties,
                status: fullyCompleted ? "completed" : activeNod.status,
                transactionHash: txHash
            });

            if (fullyCompleted) {
                toast.success("Agreement completed! Escrow deposits released to all participants.");
            } else {
                toast.success("Completion approved! Waiting for remaining participants to approve.");
            }
        } catch (error: any) {
            console.error("Failed to approve completion:", error);
            toast.error(`Completion approval failed: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleClaimExpired = async () => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("claim");

        try {
            const unsignedXdr = await buildClaimExpiredTx({
                claimant: address,
                agreementIdHex: agreementIdHex || Array.from({ length: 32 }, () => '0').join('')
            });

            const signedXdr = await signTxWithFreighter(unsignedXdr);
            const txHash = await submitStellarTx(signedXdr);

            updateNod(nodId, {
                status: "expired",
                transactionHash: txHash
            });

            toast.success(`Escrow penalty claimed successfully! Refund + penalty transferred to your wallet. Tx: ${txHash.slice(0, 8)}...`);
        } catch (error: any) {
            console.error("Failed to claim expired escrow:", error);
            toast.error(`Claim failed: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleMarkDelivered = async () => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("deliver");

        try {
            toast.info("Signing delivery status update on Stellar...");
            const unsignedXdr = await buildMarkDeliveredTx({
                initiator: address,
                agreementIdHex: agreementIdHex || Array.from({ length: 32 }, () => '0').join('')
            });

            const signedXdr = await signTxWithFreighter(unsignedXdr);
            const txHash = await submitStellarTx(signedXdr);

            updateNod(nodId, {
                status: "delivered",
                transactionHash: txHash,
                deliveredAt: Math.floor(Date.now() / 1000)
            });

            toast.success(`Agreement marked as Delivered! 72-hour dispute review window has started. Tx: ${txHash.slice(0, 8)}...`);
        } catch (error: any) {
            console.error("Failed to mark delivered:", error);
            toast.error(`Delivery update failed: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleRaiseDispute = async () => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("dispute");

        try {
            toast.info("Signing dispute transaction on Stellar...");
            const unsignedXdr = await buildRaiseDisputeTx({
                claimant: address,
                agreementIdHex: agreementIdHex || Array.from({ length: 32 }, () => '0').join('')
            });

            const signedXdr = await signTxWithFreighter(unsignedXdr);
            const txHash = await submitStellarTx(signedXdr);

            updateNod(nodId, {
                status: "disputed",
                transactionHash: txHash
            });

            toast.success(`Dispute successfully raised! Escrow locked. Arbitrator notified. Tx: ${txHash.slice(0, 8)}...`);
        } catch (error: any) {
            console.error("Failed to raise dispute:", error);
            toast.error(`Failed to raise dispute: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleResolveDispute = async (winner: string) => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("resolve");

        try {
            toast.info(`Signing arbitration decision awarding pool to ${winner.slice(0, 8)}...`);
            const unsignedXdr = await buildResolveDisputeTx({
                arbitrator: address,
                agreementIdHex: agreementIdHex || Array.from({ length: 32 }, () => '0').join(''),
                winner
            });

            const signedXdr = await signTxWithFreighter(unsignedXdr);
            const txHash = await submitStellarTx(signedXdr);

            updateNod(nodId, {
                status: "completed",
                transactionHash: txHash
            });

            toast.success(`Dispute successfully resolved! Entire escrow pool awarded to the winner. Tx: ${txHash.slice(0, 8)}...`);
        } catch (error: any) {
            console.error("Failed to resolve dispute:", error);
            toast.error(`Dispute resolution failed: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleAutoCompleteDelivered = async () => {
        if (!address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        setIsActionLoading("complete");

        try {
            toast.info("Signing auto-completion on Stellar...");
            const unsignedXdr = await buildAutoCompleteDeliveredTx({
                caller: address,
                agreementIdHex: agreementIdHex || Array.from({ length: 32 }, () => '0').join('')
            });

            const signedXdr = await signTxWithFreighter(unsignedXdr);
            const txHash = await submitStellarTx(signedXdr);

            updateNod(nodId, {
                status: "completed",
                transactionHash: txHash
            });

            toast.success(`Escrow completed! Deposits released back to all participants. Tx: ${txHash.slice(0, 8)}...`);
        } catch (error: any) {
            console.error("Failed to auto-complete delivered:", error);
            toast.error(`Auto-complete failed: ${error.message || error}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const templateConfig = TEMPLATES.find((t) => t.id === (activeNod as any).template) || 
        (activeNod.cautionAmount && activeNod.cautionAmount > 0 ? TEMPLATES[0] : TEMPLATES[1]);

    const isUserCounterparty = address ? activeNod.counterparties.includes(address) : false;
    const isUserInitiator = address ? activeNod.creator === address : false;
    const isUserArbitrator = !!(activeNod.arbitrator && address && activeNod.arbitrator === address);

    const hasUserSignedDraft = address ? draftSignedCounterparties.includes(address) : false;
    const hasUserApprovedCompletion = address ? (activeNod.completedParties || []).includes(address) : false;

    const handleCopyVerificationShare = async () => {
        const sharePackage = await buildNodSharePackage(activeNod);
        await navigator.clipboard.writeText(encodeNodSharePackage(sharePackage));
        setShareCopied(true);
        toast.success("Third-party verification package copied.");
        setTimeout(() => setShareCopied(false), 2000);
    };

    if (!hasAccess) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header / Back */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/">
                            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Link>
                    </Button>
                    <div className="text-xs text-[var(--foreground-muted)] uppercase tracking-wider font-semibold px-2 py-1 rounded bg-[var(--accent)] border border-[var(--border)]">
                        Gated
                    </div>
                </div>

                {/* Copyable Nod ID Badge */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--accent)] border border-[var(--border)] shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--foreground-muted)] block uppercase tracking-wider">Nod ID</span>
                        <code className="text-xs font-mono text-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)] select-all">{nodId}</code>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            navigator.clipboard.writeText(nodId);
                            toast.success("Nod ID copied to clipboard!");
                        }}
                        className="h-8 px-3 hover:bg-[var(--accent)] text-[var(--foreground)] font-medium cursor-pointer"
                    >
                        <HugeiconsIcon icon={Copy01Icon} className="w-3.5 h-3.5 mr-1.5" />
                        Copy ID
                    </Button>
                </div>

                {/* Gated Access Card */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-violet-500/20 bg-gradient-to-b from-violet-500/[0.04] to-violet-500/[0.01] dark:from-violet-500/[0.08] dark:to-transparent shadow-xl backdrop-blur-md overflow-hidden">
                        <CardHeader className="border-b border-[var(--border)]/60 pb-5 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center mb-3">
                                <Lock className="w-6 h-6 text-violet-500 animate-pulse" />
                            </div>
                            <CardTitle className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                                Wallet-Gated Access
                            </CardTitle>
                            <CardDescription className="text-xs text-[var(--foreground-muted)] max-w-md mx-auto mt-1 leading-relaxed">
                                This agreement's details are encrypted and wallet-gated. Please connect your wallet to verify participation, or provide a Share ID to decrypt and view the terms.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {/* Wallet check */}
                            {!isConnected ? (
                                <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] text-center space-y-3">
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        Are you a participant of this agreement? Connect your wallet to instantly unlock access.
                                    </p>
                                    <Button
                                        onClick={connect}
                                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold cursor-pointer"
                                    >
                                        Connect Wallet
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-[var(--accent)]/50 border border-[var(--border)] flex items-center justify-between gap-3 shadow-inner">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <Wallet className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider block font-bold">Connected Wallet</span>
                                                <span className="font-mono text-sm text-[var(--foreground)] font-semibold">
                                                    {address ? `${address.slice(0, 6)}...${address.slice(-6)}` : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Active
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                                onClick={() => {
                                                    if (address) {
                                                        navigator.clipboard.writeText(address);
                                                        toast.success("Wallet address copied!");
                                                    }
                                                }}
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Participant Unlock Option */}
                                    {address && activeNod && (
                                        (() => {
                                            const isWalletParticipant = activeNod.creator === address ||
                                                activeNod.counterparties.includes(address) ||
                                                activeNod.arbitrator === address;
                                            const hasText = !!activeNod.text && activeNod.text !== "";
                                            
                                            if (isWalletParticipant && !hasText) {
                                                return (
                                                    <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-center space-y-3">
                                                        <p className="text-xs text-[var(--foreground)] font-semibold">
                                                            You are identified as a participant of this agreement.
                                                        </p>
                                                        <p className="text-[11px] text-[var(--foreground-muted)]">
                                                            To view and decrypt the terms client-side, please verify ownership of your wallet.
                                                        </p>
                                                        <Button
                                                            onClick={decryptDraftForParticipant}
                                                            disabled={isDecryptingShare}
                                                            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold cursor-pointer"
                                                        >
                                                            {isDecryptingShare ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                    <span>Decrypting Terms...</span>
                                                                </div>
                                                            ) : (
                                                                "Verify Wallet & Decrypt"
                                                            )}
                                                        </Button>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()
                                    )}
                                </div>
                            )}

                            {/* Decrypt Form */}
                            <form onSubmit={(e) => { 
                                e.preventDefault(); 
                                if (shareInput.trim().startsWith("nodshare:")) {
                                    verifySharePackageForAccess(e);
                                } else {
                                    handleDecryptWithShareId(shareInput);
                                }
                            }} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase tracking-wider block">
                                        Decrypt using Share ID or Paste Package
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Enter secure Share ID (UUID) or paste nodshare:..."
                                            value={shareInput}
                                            onChange={(e) => { setShareInput(e.target.value); setShareError(null); }}
                                            className="font-mono text-sm flex-1"
                                        />
                                        <Button
                                            type="submit"
                                            disabled={isDecryptingShare || !shareInput.trim()}
                                            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-5 cursor-pointer shadow-md hover:shadow-violet-600/10 active:scale-95 transition-all"
                                        >
                                            {isDecryptingShare ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Decrypt & View"
                                            )}
                                        </Button>
                                    </div>
                                    {shareError && (
                                        <p className="text-xs text-rose-500 font-semibold">{shareError}</p>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Zero-Knowledge Proof Verification Panel */}
                <ZKVerificationPanel nod={activeNod} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header / Back */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/">
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Link>
                </Button>
                <div className="text-xs text-[var(--foreground-muted)] uppercase tracking-wider font-semibold px-2 py-1 rounded bg-[var(--accent)] border border-[var(--border)]">
                    {templateConfig.subtitle}
                </div>
            </div>

            {/* Copyable Nod ID Badge */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--accent)] border border-[var(--border)] shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--foreground-muted)] block uppercase tracking-wider">Nod ID</span>
                    <code className="text-xs font-mono text-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)] select-all">{nodId}</code>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        navigator.clipboard.writeText(nodId);
                        toast.success("Nod ID copied to clipboard!");
                    }}
                    className="h-8 px-3 hover:bg-[var(--accent)] text-[var(--foreground)] font-medium cursor-pointer"
                >
                    <HugeiconsIcon icon={Copy01Icon} className="w-3.5 h-3.5 mr-1.5" />
                    Copy ID
                </Button>
            </div>

            {/* Main Agreement Details Card */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-[var(--border-strong)]/40 shadow-xl overflow-hidden">
                    <CardHeader className="border-b border-[var(--border)]/40 bg-[var(--accent)]/10 pb-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight">Agreement Status</CardTitle>
                                <CardDescription>Sealed and secured on Soroban smart contract</CardDescription>
                            </div>
                            <StatusBadge status={activeNod.status} />
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-5">
                        {/* Wording block */}
                        <div className="p-5 rounded-2xl bg-[var(--accent)]/50 border border-[var(--border)] relative overflow-hidden">
                            <span className="absolute right-4 top-2 text-6xl text-[var(--foreground)]/5 font-serif pointer-events-none select-none">“</span>
                            <p className="text-[var(--foreground)] font-medium leading-relaxed relative z-10 text-base">
                                "{decryptedText || activeNod.text}"
                            </p>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs md:text-sm">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                    <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                                    <span>Initiator</span>
                                </div>
                                <div className="text-[var(--foreground)] font-semibold">
                                    <ProfileName username={activeNod.creator} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                    <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                                    <span>Co-signer(s)</span>
                                </div>
                                <div className="text-[var(--foreground)] font-semibold flex flex-col gap-1">
                                    {activeNod.counterparties.map((cp) => (
                                        <ProfileName key={cp} username={cp} />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1 border-t border-[var(--border)]/30 pt-3">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                    <HugeiconsIcon icon={Calendar03Icon} className="w-3.5 h-3.5" />
                                    <span>Sealed Date</span>
                                </div>
                                <p className="text-[var(--foreground)] font-semibold">{activeNod.createdAt}</p>
                            </div>
                            <div className="space-y-1 border-t border-[var(--border)]/30 pt-3">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                    <HugeiconsIcon icon={Clock01Icon} className="w-3.5 h-3.5" />
                                    <span>Deadline Countdown</span>
                                </div>
                                <p className={`font-semibold ${isExpired ? "text-rose-500" : "text-emerald-500 animate-pulse"}`}>
                                    {activeNod.expiresAt && activeNod.expiresAt > 0 ? timeLeft : (activeNod.status === 'delivered' ? timeLeft : "Ongoing Rules (No Deadline)")}
                                </p>
                            </div>

                            {/* Arbitrator display */}
                            {activeNod.arbitrator && (
                                <div className="space-y-1 border-t border-[var(--border)]/30 pt-3 col-span-2">
                                    <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                        <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                                        <span>Arbitrator Address / Nominee</span>
                                    </div>
                                    <div className="text-[var(--foreground)] font-semibold">
                                        <ProfileName username={activeNod.arbitrator} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Escrow Details */}
                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--accent)]/30 flex items-start gap-3">
                            <HugeiconsIcon icon={Coins01Icon} className="w-5 h-5 text-[var(--foreground-muted)] shrink-0 mt-0.5" />
                            <div className="space-y-1 flex-1">
                                <h4 className="text-xs font-bold text-[var(--foreground)]">Escrow Lock Details</h4>
                                {activeNod.cautionAmount && activeNod.cautionAmount > 0 ? (
                                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                        Each party deposited <strong>{activeNod.cautionAmount / 10000000} XLM</strong> in escrow. Status: <strong>{activeNod.status === 'completed' ? 'Released' : 'Locked'}</strong>. Total pool: <strong>{(activeNod.cautionAmount * (activeNod.counterparties.length + 1)) / 10000000} XLM</strong>.
                                    </p>
                                ) : (
                                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                        No caution money (0 XLM). Social commitment contract.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Checklist */}
                        {activeNod.status === "awaiting" && (
                            <div className="space-y-3 pt-3 border-t border-[var(--border)]/30">
                                <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Acceptance Signature Checklist</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <ProfileName username={activeNod.creator} />
                                            <span className="text-[10px] bg-[var(--border-strong)]/20 text-[var(--foreground-muted)] px-1.5 py-0.5 rounded">Initiator</span>
                                        </div>
                                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                            Signed <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4" />
                                        </span>
                                    </div>

                                    {activeNod.counterparties.map((cp) => {
                                        const signed = draftSignedCounterparties.includes(cp);
                                        return (
                                            <div key={cp} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
                                                <ProfileName username={cp} />
                                                {signed ? (
                                                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                                        Signed <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4" />
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-500 font-semibold flex items-center gap-1">
                                                        Pending Accept <HugeiconsIcon icon={HourglassIcon} className="w-4 h-4 animate-spin" />
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Completion checklist */}
                        {activeNod.status === "nodded" && (
                            <div className="space-y-3 pt-3 border-t border-[var(--border)]/30">
                                <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Completion Approvals</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <ProfileName username={activeNod.creator} />
                                            <span className="text-[10px] bg-[var(--border-strong)]/20 text-[var(--foreground-muted)] px-1.5 py-0.5 rounded">Initiator</span>
                                        </div>
                                        {(activeNod.completedParties || []).includes(activeNod.creator) ? (
                                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                                Approved <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4" />
                                            </span>
                                        ) : (
                                            <span className="text-[var(--foreground-muted)] flex items-center gap-1">
                                                Awaiting Completion <HugeiconsIcon icon={HourglassIcon} className="w-4 h-4" />
                                            </span>
                                        )}
                                    </div>

                                    {activeNod.counterparties.map((cp) => {
                                        const completed = (activeNod.completedParties || []).includes(cp);
                                        return (
                                            <div key={cp} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
                                                <ProfileName username={cp} />
                                                {completed ? (
                                                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                                        Approved <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4" />
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--foreground-muted)] flex items-center gap-1">
                                                        Awaiting Completion <HugeiconsIcon icon={HourglassIcon} className="w-4 h-4" />
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* On-chain Identity Cards */}
                        <div className="space-y-3 pt-3 border-t border-[var(--border)]/30">
                            {activeNod.transactionHash && (
                                <NodIdentityCard id={activeNod.transactionHash} label="Transaction Hash" />
                            )}
                            <NodIdentityCard id={activeNod.hash} label="Sealed Content Hash" />
                            <NodIdentityCard id={CONTRACT_ID} label="Stellar Contract ID" />
                            
                            {/* Verification Links */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <a
                                    href={`https://horizon-testnet.stellar.org/accounts/${CONTRACT_ID}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] bg-white dark:bg-zinc-900 hover:bg-gray-50 border border-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Verify on Horizon RPC</span>
                                    <span className="text-[9px] text-gray-400 font-normal">→</span>
                                </a>
                                <a
                                    href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] bg-white dark:bg-zinc-900 hover:bg-gray-50 border border-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Verify on Stellar.Expert</span>
                                    <span className="text-[9px] text-gray-400 font-normal">→</span>
                                </a>
                            </div>
                        </div>

                        {/* Share Options Container */}
                        <div className="space-y-3">
                            {/* Gated Share */}
                            <div className="p-4 rounded-xl border border-violet-500/15 bg-violet-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 space-y-1">
                                    <h4 className="text-xs font-bold text-[var(--foreground)]">Secure Share Link (Gated)</h4>
                                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                        Generate a client-side encrypted share link gated to a specific recipient wallet address.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsShareModalOpen(true)}
                                    className="shrink-0 border-violet-200 text-violet-700 hover:bg-violet-50 font-semibold cursor-pointer"
                                >
                                    <HugeiconsIcon icon={Share01Icon} className="w-4 h-4 mr-2" />
                                    Share Securely
                                </Button>
                            </div>

                            {/* Ungated Share */}
                            <div className="p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 space-y-1">
                                    <h4 className="text-xs font-bold text-[var(--foreground)]">Direct Share Link (Ungated)</h4>
                                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                        Copy a direct link containing the full agreement package. Anyone with this link can view the terms instantly.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                        try {
                                            const sharePackage = await buildNodSharePackage(activeNod);
                                            const encoded = encodeNodSharePackage(sharePackage);
                                            const link = `${window.location.origin}/nod/${activeNod.id}?package=${encoded}`;
                                            await navigator.clipboard.writeText(link);
                                            toast.success("Direct share link copied to clipboard!");
                                        } catch (err: any) {
                                            console.error("Failed to copy share link:", err);
                                            toast.error("Failed to generate direct share link.");
                                        }
                                    }}
                                    className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold cursor-pointer"
                                >
                                    <HugeiconsIcon icon={Share01Icon} className="w-4 h-4 mr-2" />
                                    Copy Direct Link
                                </Button>
                            </div>
                        </div>
                    </CardContent>

                    {/* Actions Panel */}
                    <CardFooter className="bg-[var(--accent)]/10 border-t border-[var(--border)]/40 p-4 gap-3 flex flex-col sm:flex-row">
                        {activeNod.status === "awaiting" && isUserCounterparty && !hasUserSignedDraft && (
                            <div className="grid grid-cols-2 gap-3 w-full">
                                <Button
                                    variant="outline"
                                    onClick={handleDecline}
                                    disabled={!!isActionLoading}
                                    className="text-red-500 border-red-200/50 hover:bg-red-50"
                                >
                                    {isActionLoading === "reject" ? "Declining..." : "Decline Nod"}
                                </Button>
                                <Button
                                    onClick={handleAccept}
                                    disabled={!!isActionLoading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                >
                                    {isActionLoading === "accept" ? "Accepting..." : "Co-sign & Accept"}
                                </Button>
                            </div>
                        )}

                        {activeNod.status === "nodded" && (isUserInitiator || isUserCounterparty) && !hasUserApprovedCompletion && (
                            <div className="flex flex-col gap-2.5 w-full">
                                {activeNod.cautionAmount && activeNod.cautionAmount > 0 ? (
                                    isUserInitiator ? (
                                        <Button
                                            onClick={handleMarkDelivered}
                                            disabled={!!isActionLoading}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                        >
                                            {isActionLoading === "deliver" ? "Marking..." : "Mark as Delivered"}
                                        </Button>
                                    ) : (
                                        <div className="w-full text-center py-2.5 text-xs text-[var(--foreground-muted)] bg-[var(--accent)]/30 border border-[var(--border)] rounded-lg font-medium flex items-center justify-center gap-1.5">
                                            <HugeiconsIcon icon={HourglassIcon} className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                            Waiting for initiator to mark delivery
                                        </div>
                                    )
                                ) : (
                                    <Button
                                        onClick={handleComplete}
                                        disabled={!!isActionLoading}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                    >
                                        {isActionLoading === "complete" ? "Completing..." : "Confirm Completion"}
                                    </Button>
                                )}
                            </div>
                        )}

                        {activeNod.status === "delivered" && (
                            <div className="flex flex-col gap-2.5 w-full">
                                {isExpired ? (
                                    <Button
                                        onClick={handleAutoCompleteDelivered}
                                        disabled={!!isActionLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                    >
                                        {isActionLoading === "complete" ? "Completing..." : "Auto-Complete Escrow"}
                                    </Button>
                                ) : (
                                    isUserCounterparty && (
                                        <div className="grid grid-cols-2 gap-3 w-full">
                                            <Button
                                                variant="outline"
                                                onClick={handleRaiseDispute}
                                                disabled={!!isActionLoading}
                                                className="text-red-500 border-red-200 hover:bg-red-50"
                                            >
                                                {isActionLoading === "dispute" ? "Disputing..." : "Raise Dispute"}
                                            </Button>
                                            <Button
                                                onClick={handleComplete}
                                                disabled={!!isActionLoading}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                            >
                                                {isActionLoading === "complete" ? "Confirm Delivery" : "Accept Delivery"}
                                            </Button>
                                        </div>
                                    )
                                )}

                                {!isUserCounterparty && !isExpired && (
                                    <div className="text-center py-2 text-xs text-[var(--foreground-muted)] flex items-center justify-center gap-1">
                                        <HugeiconsIcon icon={HourglassIcon} className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                        Awaiting review by co-signers (72h window active)
                                    </div>
                                )}
                            </div>
                        )}

                        {activeNod.status === "disputed" && (
                            <div className="flex flex-col gap-2.5 w-full">
                                {isUserArbitrator ? (
                                    <div className="space-y-3 p-4 rounded-xl bg-orange-500/5 border border-orange-500/15">
                                        <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
                                            <HugeiconsIcon icon={Alert01Icon} className="w-4.5 h-4.5" />
                                            <span>Arbitrator Control Panel</span>
                                        </div>
                                        <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
                                            As the nominated arbitrator, please verify the terms, timestamps, and delivery evidence, then award the escrow pool to the deserving party:
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                onClick={() => handleResolveDispute(activeNod.creator)}
                                                disabled={!!isActionLoading}
                                                variant="outline"
                                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs"
                                            >
                                                Award Initiator
                                            </Button>
                                            <Button
                                                onClick={() => handleResolveDispute(activeNod.counterparties[0])}
                                                disabled={!!isActionLoading}
                                                variant="outline"
                                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs"
                                            >
                                                Award Co-signer
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full text-center py-2.5 text-xs text-orange-600 bg-orange-50/50 border border-orange-100 rounded-lg font-medium flex items-center justify-center gap-1.5">
                                        <HugeiconsIcon icon={Alert01Icon} className="w-4 h-4 animate-pulse" />
                                        Disputed. Awaiting decision by the arbitrator: <ProfileName username={activeNod.arbitrator || ""} />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeNod.status === "nodded" && isExpired && isUserCounterparty && activeNod.cautionAmount && activeNod.cautionAmount > 0 && (
                            <Button
                                onClick={handleClaimExpired}
                                disabled={!!isActionLoading}
                                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                            >
                                {isActionLoading === "claim" ? "Claiming..." : "Claim Expired Escrow"}
                            </Button>
                        )}

                        {activeNod.status === "completed" && (
                            <div className="w-full text-center py-2 text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5">
                                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4.5 h-4.5" />
                                Agreement successfully completed and resolved on Stellar
                            </div>
                        )}

                        {activeNod.status === "declined" && (
                            <div className="w-full text-center py-2 text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5">
                                <HugeiconsIcon icon={CancelCircleIcon} className="w-4.5 h-4.5" />
                                This agreement draft was declined on-chain
                            </div>
                        )}
                    </CardFooter>
                </Card>
            </motion.div>

            {/* Live Verification */}
            <Card className="border-[var(--border)] shadow-md overflow-hidden">
                <button
                    onClick={() => {
                        setShowVerifyGuide(!showVerifyGuide);
                        if (showVerifyGuide) {
                            setShowTechnicalDetails(false);
                        }
                    }}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--accent)]/30 transition-colors"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <HugeiconsIcon icon={SecurityCheckIcon} className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="text-left">
                            <span className="text-sm font-bold text-[var(--foreground)] block">Verify Agreement Authenticity</span>
                            <span className="text-[10px] text-emerald-600 font-medium">Verify content integrity & blockchain status</span>
                        </div>
                    </div>
                    <span className="text-xs text-[var(--foreground-muted)]">
                        {showVerifyGuide ? "Hide ▲" : "Run Checks ▼"}
                    </span>
                </button>

                <AnimatePresence>
                    {showVerifyGuide && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="px-5 pb-5 pt-2 border-t border-[var(--border)]/40 space-y-5">
                                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                    Independently verify that this agreement has not been altered or tampered with since it was signed. This runs automated checks comparing the text structure, storage records, and live blockchain status.
                                </p>

                                {verifyStep === 0 && (
                                    <Button
                                        onClick={async () => {
                                            setIsVerifyRunning(true);
                                            setContentCheck(null);
                                            setIpfsCheck(null);
                                            setContractCheck(null);

                                            // Step 1: Soroban contract query
                                            setVerifyStep(1);
                                            let onChainCid = activeNod.cid;
                                            let contractData: OnChainAgreement | null = null;
                                            try {
                                                if (agreementIdHex) {
                                                    contractData = await queryAgreementOnChain(agreementIdHex);
                                                    setContractCheck({ passed: !!contractData, data: contractData });
                                                    if (contractData?.cid) {
                                                        onChainCid = contractData.cid;
                                                    }
                                                } else {
                                                    setContractCheck({ passed: false, data: null, error: "No agreement ID — not yet sealed on-chain" });
                                                }
                                            } catch {
                                                setContractCheck({ passed: false, data: null, error: "RPC query failed" });
                                            }
                                            await new Promise(r => setTimeout(r, 600));

                                            // Step 2: IPFS fetch
                                            setVerifyStep(2);
                                            let ipfsContent: Record<string, unknown> | null = null;
                                            try {
                                                if (onChainCid && !onChainCid.startsWith("MOCK_CID_")) {
                                                    ipfsContent = await fetchIPFSContent(onChainCid);
                                                    setIpfsCheck({ passed: !!ipfsContent, data: ipfsContent });
                                                } else {
                                                    setIpfsCheck({ passed: false, data: null, error: onChainCid?.startsWith("MOCK_CID_") ? "Mock CID — IPFS not pinned" : "No CID available" });
                                                }
                                            } catch {
                                                setIpfsCheck({ passed: false, data: null, error: "Failed to reach IPFS gateway" });
                                            }
                                            await new Promise(r => setTimeout(r, 600));

                                            // Step 3: Content Match
                                            setVerifyStep(3);
                                            try {
                                                const expectedText = activeNod.text || "";
                                                if (isEncryptedIPFSPayload(ipfsContent)) {
                                                    setContentCheck({ passed: !!expectedText, ipfsText: expectedText, ipfsContent, expectedText, encrypted: true });
                                                } else {
                                                    const ipfsText = extractAgreementTextFromIPFS(ipfsContent);
                                                    const textMatch = ipfsText.trim() === expectedText.trim();
                                                    setContentCheck({ passed: textMatch, ipfsText, ipfsContent, expectedText });
                                                }
                                            } catch {
                                                setContentCheck({ passed: false, ipfsText: "", ipfsContent: null, expectedText: activeNod.text });
                                            }

                                            setIsVerifyRunning(false);
                                        }}
                                        disabled={isVerifyRunning}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                                    >
                                        <HugeiconsIcon icon={SecurityCheckIcon} className="w-4 h-4 mr-2" />
                                        Run Authenticity Checks
                                    </Button>
                                )}

                                {verifyStep >= 1 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">1</div>
                                            <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Blockchain State Check</h4>
                                            {contractCheck && (
                                                <HugeiconsIcon
                                                    icon={contractCheck.passed ? CheckmarkCircle01Icon : CancelCircleIcon}
                                                    className={`w-4 h-4 ${contractCheck.passed ? "text-emerald-500" : "text-amber-500"}`}
                                                />
                                            )}
                                            {!contractCheck && verifyStep === 1 && (
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-3.5 h-3.5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                            )}
                                        </div>
                                        {contractCheck && (
                                            <div className={`p-3 rounded-lg border text-xs ${contractCheck.passed ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-600" : "bg-amber-500/5 border-amber-500/15 text-amber-600"} font-semibold`}>
                                                {contractCheck.passed ? `✓ Verified: Active contract confirmed on Stellar Blockchain (${contractCheck.data?.statusLabel}).` : `⚠ Warning: ${contractCheck.error || "Blockchain check failed"}`}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {verifyStep >= 2 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">2</div>
                                            <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Storage Verification Check</h4>
                                            {ipfsCheck && (
                                                <HugeiconsIcon
                                                    icon={ipfsCheck.passed ? CheckmarkCircle01Icon : CancelCircleIcon}
                                                    className={`w-4 h-4 ${ipfsCheck.passed ? "text-emerald-500" : "text-amber-500"}`}
                                                />
                                            )}
                                            {!ipfsCheck && verifyStep === 2 && (
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-3.5 h-3.5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                            )}
                                        </div>
                                        {ipfsCheck && (
                                            <div className={`p-3 rounded-lg border text-xs ${ipfsCheck.passed ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-600" : "bg-amber-500/5 border-amber-500/15 text-amber-600"} font-semibold`}>
                                                {ipfsCheck.passed ? "✓ Verified: Agreement terms are securely backed up in decentralized storage." : `⚠ Warning: ${ipfsCheck.error || "Storage check failed"}`}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {verifyStep >= 3 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">3</div>
                                            <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Content Integrity Check</h4>
                                            {contentCheck && (
                                                <HugeiconsIcon
                                                    icon={contentCheck.passed ? CheckmarkCircle01Icon : CancelCircleIcon}
                                                    className={`w-4 h-4 ${contentCheck.passed ? "text-emerald-500" : "text-rose-500"}`}
                                                />
                                            )}
                                            {!contentCheck && verifyStep === 3 && (
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-3.5 h-3.5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                            )}
                                        </div>
                                        {contentCheck && (
                                            <div className={`p-3 rounded-lg border text-xs ${contentCheck.passed ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-600" : "bg-rose-500/5 border-rose-500/15 text-rose-500"} font-semibold`}>
                                                {contentCheck.encrypted
                                                    ? "✓ Verified: IPFS stores an encrypted agreement payload. Plaintext is available only from a participating party."
                                                    : contentCheck.passed
                                                        ? "✓ Verified: The agreement content retrieved from decentralized storage matches the local terms exactly."
                                                        : "✗ Mismatch: The agreement content does not match the local terms."}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {(contentCheck || ipfsCheck || contractCheck) && (
                                    <div className="border-t border-[var(--border)]/30 pt-3">
                                        <button
                                            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                                            className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <HugeiconsIcon icon={SecurityCheckIcon} className="w-3.5 h-3.5" />
                                            <span>{showTechnicalDetails ? "Hide Technical Parameters" : "Show Technical Parameters (Developers)"}</span>
                                        </button>

                                        <AnimatePresence>
                                            {showTechnicalDetails && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden mt-2"
                                                >
                                                    <div className="p-3 rounded-lg bg-[var(--accent)] border border-[var(--border)] text-[10px] text-[var(--foreground-muted)] space-y-1.5 font-mono">
                                                        {contractCheck && (
                                                            <>
                                                                <div>
                                                                    <span className="font-semibold text-[var(--foreground)]">Stellar Contract Address: </span>
                                                                    <code className="break-all">{CONTRACT_ID}</code>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-[var(--foreground)]">On-Chain Agreement ID: </span>
                                                                    <code className="break-all">{agreementIdHex || "N/A"}</code>
                                                                </div>
                                                            </>
                                                        )}
                                                        {ipfsCheck && (
                                                            <>
                                                                <div>
                                                                    <span className="font-semibold text-[var(--foreground)]">IPFS CID: </span>
                                                                    <code className="break-all">{activeNod.cid || "N/A"}</code>
                                                                </div>
                                                            </>
                                                        )}
                                                        {contentCheck && (
                                                            <>
                                                                <div>
                                                                    <span className="font-semibold text-[var(--foreground)]">Expected Content: </span>
                                                                    <code className="break-all">{JSON.stringify(contentCheck.expectedText)}</code>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-[var(--foreground)]">IPFS Content: </span>
                                                                    <pre className="mt-1 whitespace-pre-wrap break-all rounded-md bg-white border border-neutral-200 p-3 text-[10px] leading-relaxed text-neutral-800">
                                                                        {JSON.stringify(contentCheck.ipfsContent, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {verifyStep > 0 && !isVerifyRunning && (
                                    <div className="flex justify-center pt-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setVerifyStep(0);
                                                setContentCheck(null);
                                                setIpfsCheck(null);
                                                setContractCheck(null);
                                                setShowTechnicalDetails(false);
                                            }}
                                            className="text-xs text-[var(--foreground-muted)] cursor-pointer"
                                        >
                                            Run Again
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            {/* Zero-Knowledge Panel */}
            <ZKVerificationPanel nod={activeNod} />

            {/* Share Modal */}
            {activeNod && (
                <ShareModal
                    nod={activeNod}
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                />
            )}
        </div>
    );
}
