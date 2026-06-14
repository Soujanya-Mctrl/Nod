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
    Alert01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/nod/status-badge";
import { useNods, type Nod } from "@/lib/store";
import { ProfileName } from "@/components/nod/profile-name";
import { NodIdentityCard } from "@/components/profile/nod-identity-card";
import { HashVerificationModal } from "@/components/nod/hash-verification-modal";
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
    CONTRACT_ID
} from "@/lib/stellar";
import { useToast } from "@/components/ui/toast";
import { generateHash } from "@/lib/utils";
import { queryAgreementOnChain, fetchIPFSContent, type OnChainAgreement } from "@/lib/soroban-query";

const TEMPLATES = [
    { id: "freelancer", subtitle: "Freelancer / Client" },
    { id: "friends", subtitle: "Social Repayment" },
    { id: "roommates", subtitle: "Shared House Rules" },
    { id: "vendor", subtitle: "Business Purchase" }
] as const;

export default function NodDetailPage() {
    const params = useParams();
    const router = useRouter();
    const nodId = params.id as string;
    const { getNodById, updateNod, isLoaded, isParticipant, userProfile } = useNods();

    const nod = getNodById(nodId);

    const [isActionLoading, setIsActionLoading] = useState<"accept" | "reject" | "complete" | "claim" | "deliver" | "dispute" | "resolve" | null>(null);
    const [hasAccess, setHasAccess] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isExpired, setIsExpired] = useState(false);
    const [showVerifyGuide, setShowVerifyGuide] = useState(false);
    const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

    // Live verification states
    const [verifyStep, setVerifyStep] = useState<0 | 1 | 2 | 3>(0);
    const [isVerifyRunning, setIsVerifyRunning] = useState(false);
    const [contentCheck, setContentCheck] = useState<{ passed: boolean; ipfsText: string; expectedText: string } | null>(null);
    const [ipfsCheck, setIpfsCheck] = useState<{ passed: boolean; data: Record<string, unknown> | null; error?: string } | null>(null);
    const [contractCheck, setContractCheck] = useState<{ passed: boolean; data: OnChainAgreement | null; error?: string } | null>(null);
    
    // Draft-specific states loaded from relay
    const [draftSignedCounterparties, setDraftSignedCounterparties] = useState<string[]>([]);
    const [draftSig1, setDraftSig1] = useState<string>("");
    const [agreementIdHex, setAgreementIdHex] = useState<string>("");

    const toast = useToast();
    const { address, isConnected, connect, isInitializing } = useStellarWallet();

    // Load draft info from backend if signatures/agreement ID are not present locally
    useEffect(() => {
        if (!nod || !isLoaded) return;

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
                if (nod.agreementIdHex) setAgreementIdHex(nod.agreementIdHex);
            });
    }, [nod, nodId, isLoaded]);

    const isLoadingProfile = isInitializing || (address !== null && userProfile === null);

    // Check if user has access (participant or verified hash)
    useEffect(() => {
        if (!nod || !isLoaded || isLoadingProfile) return;

        if (isParticipant(nod)) {
            setHasAccess(true);
            return;
        }

        const verifiedHashes = JSON.parse(sessionStorage.getItem("verified_nod_hashes") || "{}");
        if (verifiedHashes[nodId]) {
            setHasAccess(true);
            return;
        }

        setHasAccess(false);
    }, [nod, nodId, isLoaded, isParticipant, userProfile, address, isLoadingProfile]);

    // Expiry and Review Window timer countdown
    useEffect(() => {
        if (!nod) return;

        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);

            if (nod.status === "delivered" && nod.deliveredAt) {
                const diff = (nod.deliveredAt + 259200) - now; // 72 hours
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
            } else if (nod.expiresAt) {
                const diff = nod.expiresAt - now;

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

    if (!isLoaded || isLoadingProfile) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 pt-10">
                <div className="h-6 w-32 bg-[var(--accent)] rounded animate-pulse" />
                <div className="h-[400px] w-full bg-[var(--accent)] rounded-xl animate-pulse" />
            </div>
        );
    }

    if (!nod) {
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

            // 1. Sign XDR with Freighter
            const signedXdr = await signTxWithFreighter(unsignedXdr);

            // 2. Submit to Stellar Network
            toast.info("Submitting acceptance transaction to Stellar Soroban...");
            const txHash = await submitStellarTx(signedXdr);

            // 3. Add current user's address to signed list
            const currentSigned = [...draftSignedCounterparties];
            if (!currentSigned.includes(address)) {
                currentSigned.push(address);
            }

            const isFinalCounterparty = currentSigned.length === nod.counterparties.length;

            if (isFinalCounterparty) {
                updateNod(nodId, {
                    status: "nodded",
                    transactionHash: txHash,
                    sig1: signedXdr,
                    signedCounterparties: currentSigned,
                    completedParties: []
                });

                // Update backend relay
                await fetch("/api/nods/draft", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: nodId,
                        cid: nod.cid,
                        initiator: nod.creator,
                        counterparties: nod.counterparties,
                        signedCounterparties: currentSigned,
                        text: nod.text,
                        sig1: signedXdr,
                        expiresAt: nod.expiresAt,
                        agreementIdHex,
                        tokenAddress: nod.tokenAddress,
                        cautionAmount: nod.cautionAmount,
                        arbitrator: nod.arbitrator
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
                        cid: nod.cid,
                        initiator: nod.creator,
                        counterparties: nod.counterparties,
                        signedCounterparties: currentSigned,
                        text: nod.text,
                        sig1: signedXdr,
                        expiresAt: nod.expiresAt,
                        agreementIdHex,
                        tokenAddress: nod.tokenAddress,
                        cautionAmount: nod.cautionAmount,
                        arbitrator: nod.arbitrator
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
                initiator: nod.creator,
                counterparty: address,
                cid: nod.cid || "",
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

            const updatedCompletedParties = [...(nod.completedParties || [])];
            if (!updatedCompletedParties.includes(address)) {
                updatedCompletedParties.push(address);
            }

            // When status is 'delivered', counterparty accepting delivery = full completion.
            // The initiator already proved delivery, so no need for their second approval.
            const isDeliveryAcceptance = nod.status === "delivered";
            const totalExpectedParties = nod.counterparties.length + 1;
            const fullyCompleted = isDeliveryAcceptance || updatedCompletedParties.length === totalExpectedParties;

            updateNod(nodId, {
                completedParties: updatedCompletedParties,
                status: fullyCompleted ? "completed" : nod.status,
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

    // Show access gate if user doesn't have access
    if (!hasAccess) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/">
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Link>
                </Button>

                {!isConnected ? (
                    <Card className="border-2 overflow-hidden shadow-xl">
                        <CardHeader className="text-center pb-2 bg-[var(--accent)]/10">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                                <span className="text-4xl">🔒</span>
                            </div>
                            <CardTitle className="text-xl font-bold tracking-tight">Private Agreement Access</CardTitle>
                            <CardDescription>
                                To view this agreement, please connect your wallet or enter the sealed content hash.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
                                {/* Option 1: Participant */}
                                <div className="space-y-4 pb-6 md:pb-0 md:pr-6 flex flex-col justify-between">
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold flex items-center gap-2">
                                            <span className="text-lg">🤝</span>
                                            <span>Agreement Participant</span>
                                        </h3>
                                        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                            Are you the initiator, a co-signer, or the arbitrator? Connect your Freighter wallet to automatically unlock and view the agreement details.
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={connect} 
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold mt-4"
                                    >
                                        Connect Freighter Wallet
                                    </Button>
                                </div>

                                {/* Option 2: Third-Party */}
                                <div className="space-y-4 pt-6 md:pt-0 md:pl-6">
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold flex items-center gap-2">
                                            <span className="text-lg">🔍</span>
                                            <span>Third-Party Verifier</span>
                                        </h3>
                                        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                            If you are a third party checking this agreement, you must enter the sealed content hash to view details.
                                        </p>
                                    </div>
                                    <HashVerificationModal
                                        expectedHash={nod.hash}
                                        nodId={nodId}
                                        onVerified={() => setHasAccess(true)}
                                        isInline
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-600 flex items-center gap-2.5">
                            <HugeiconsIcon icon={Alert01Icon} className="w-4.5 h-4.5 shrink-0" />
                            <span>
                                Connected wallet <strong>{address?.slice(0, 8)}...{address?.slice(-4)}</strong> is not registered as a participant on this agreement. Enter the sealed content hash to view/verify.
                            </span>
                        </div>
                        <HashVerificationModal
                            expectedHash={nod.hash}
                            nodId={nodId}
                            onVerified={() => setHasAccess(true)}
                        />
                    </div>
                )}
            </div>
        );
    }

    const templateConfig = TEMPLATES.find((t) => t.id === (nod as any).template) || 
        (nod.cautionAmount && nod.cautionAmount > 0 ? TEMPLATES[0] : TEMPLATES[1]);

    const isUserCounterparty = address ? nod.counterparties.includes(address) : false;
    const isUserInitiator = address ? nod.creator === address : false;
    const isUserArbitrator = !!(nod.arbitrator && address && nod.arbitrator === address);

    const hasUserSignedDraft = address ? draftSignedCounterparties.includes(address) : false;
    const hasUserApprovedCompletion = address ? (nod.completedParties || []).includes(address) : false;

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

            {/* Main Agreement Details Card */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-[var(--border-strong)]/40 shadow-xl overflow-hidden">
                    <CardHeader className="border-b border-[var(--border)]/40 bg-[var(--accent)]/10 pb-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight">Agreement Status</CardTitle>
                                <CardDescription>Sealed and secured on Soroban smart contract</CardDescription>
                            </div>
                            <StatusBadge status={nod.status} />
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-5">
                        {/* Wording block */}
                        <div className="p-5 rounded-2xl bg-[var(--accent)]/50 border border-[var(--border)] relative overflow-hidden">
                            <span className="absolute right-4 top-2 text-6xl text-[var(--foreground)]/5 font-serif pointer-events-none select-none">“</span>
                            <p className="text-[var(--foreground)] font-medium leading-relaxed relative z-10 text-base">
                                "{nod.text}"
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
                                    <ProfileName username={nod.creator} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                    <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                                    <span>Co-signer(s)</span>
                                </div>
                                <div className="text-[var(--foreground)] font-semibold flex flex-col gap-1">
                                    {nod.counterparties.map((cp) => (
                                        <ProfileName key={cp} username={cp} />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1 border-t border-[var(--border)]/30 pt-3">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                    <HugeiconsIcon icon={Calendar03Icon} className="w-3.5 h-3.5" />
                                    <span>Sealed Date</span>
                                </div>
                                <p className="text-[var(--foreground)] font-semibold">{nod.createdAt}</p>
                            </div>
                            <div className="space-y-1 border-t border-[var(--border)]/30 pt-3">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                    <HugeiconsIcon icon={Clock01Icon} className="w-3.5 h-3.5" />
                                    <span>Deadline Countdown</span>
                                </div>
                                <p className={`font-semibold ${isExpired ? "text-rose-500" : "text-emerald-500 animate-pulse"}`}>
                                    {nod.expiresAt && nod.expiresAt > 0 ? timeLeft : (nod.status === 'delivered' ? timeLeft : "Ongoing Rules (No Deadline)")}
                                </p>
                            </div>

                            {/* Arbitrator metadata display */}
                            {nod.arbitrator && (
                                <div className="space-y-1 border-t border-[var(--border)]/30 pt-3 col-span-2">
                                    <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] font-medium">
                                        <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                                        <span>Arbitrator Address / Nominee</span>
                                    </div>
                                    <div className="text-[var(--foreground)] font-semibold">
                                        <ProfileName username={nod.arbitrator} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Escrow Caution Money Details */}
                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--accent)]/30 flex items-start gap-3">
                            <HugeiconsIcon icon={Coins01Icon} className="w-5 h-5 text-[var(--foreground-muted)] shrink-0 mt-0.5" />
                            <div className="space-y-1 flex-1">
                                <h4 className="text-xs font-bold text-[var(--foreground)]">Escrow Lock Details</h4>
                                {nod.cautionAmount && nod.cautionAmount > 0 ? (
                                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                        Each party deposited <strong>{nod.cautionAmount / 10000000} XLM</strong> in escrow. Status: <strong>{nod.status === 'completed' ? 'Released' : 'Locked'}</strong>. Total pool: <strong>{(nod.cautionAmount * (nod.counterparties.length + 1)) / 10000000} XLM</strong>.
                                    </p>
                                ) : (
                                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                        No caution money (0 XLM). Social commitment contract.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Signatures Acceptance List (Draft stage) */}
                        {nod.status === "awaiting" && (
                            <div className="space-y-3 pt-3 border-t border-[var(--border)]/30">
                                <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Acceptance Signature Checklist</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <ProfileName username={nod.creator} />
                                            <span className="text-[10px] bg-[var(--border-strong)]/20 text-[var(--foreground-muted)] px-1.5 py-0.5 rounded">Initiator</span>
                                        </div>
                                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                            Signed <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4" />
                                        </span>
                                    </div>

                                    {nod.counterparties.map((cp) => {
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

                        {/* Completion Approvals Checklist (Nodded/Sealed stage) */}
                        {nod.status === "nodded" && (
                            <div className="space-y-3 pt-3 border-t border-[var(--border)]/30">
                                <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Completion Approvals</h4>
                                <div className="space-y-2">
                                    {/* Initiator Completion */}
                                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <ProfileName username={nod.creator} />
                                            <span className="text-[10px] bg-[var(--border-strong)]/20 text-[var(--foreground-muted)] px-1.5 py-0.5 rounded">Initiator</span>
                                        </div>
                                        {(nod.completedParties || []).includes(nod.creator) ? (
                                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                                Approved <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4" />
                                            </span>
                                        ) : (
                                            <span className="text-[var(--foreground-muted)] flex items-center gap-1">
                                                Awaiting Completion <HugeiconsIcon icon={HourglassIcon} className="w-4 h-4" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Counterparties Completion */}
                                    {nod.counterparties.map((cp) => {
                                        const completed = (nod.completedParties || []).includes(cp);
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
                            {nod.transactionHash && (
                                <NodIdentityCard id={nod.transactionHash} label="Transaction Hash" />
                            )}
                            <NodIdentityCard id={nod.hash} label="Sealed Content Hash" />
                        </div>
                    </CardContent>

                    {/* Actions Panel */}
                    <CardFooter className="bg-[var(--accent)]/10 border-t border-[var(--border)]/40 p-4 gap-3 flex flex-col sm:flex-row">
                        {/* 1. Received Draft Actions */}
                        {nod.status === "awaiting" && isUserCounterparty && !hasUserSignedDraft && (
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

                        {/* 2. Active Agreement Actions (Nodded/Sealed stage) */}
                        {nod.status === "nodded" && (isUserInitiator || isUserCounterparty) && !hasUserApprovedCompletion && (
                            <div className="flex flex-col gap-2.5 w-full">
                                {nod.cautionAmount && nod.cautionAmount > 0 ? (
                                    /* Escrow active: use delivery → review → accept flow */
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
                                    /* No escrow: simple mutual completion */
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

                        {/* 3. Delivered review window actions */}
                        {nod.status === "delivered" && (
                            <div className="flex flex-col gap-2.5 w-full">
                                {/* Auto-complete after 72h window passes */}
                                {isExpired ? (
                                    <Button
                                        onClick={handleAutoCompleteDelivered}
                                        disabled={!!isActionLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                    >
                                        {isActionLoading === "complete" ? "Completing..." : "Auto-Complete Escrow"}
                                    </Button>
                                ) : (
                                    /* Within 72h review window: counterparty can approve completion or raise dispute */
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

                        {/* 4. Disputed Arbitrator Payout actions */}
                        {nod.status === "disputed" && (
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
                                                onClick={() => handleResolveDispute(nod.creator)}
                                                disabled={!!isActionLoading}
                                                variant="outline"
                                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs"
                                            >
                                                Award Initiator
                                            </Button>
                                            <Button
                                                onClick={() => handleResolveDispute(nod.counterparties[0])}
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
                                        Disputed. Awaiting decision by the arbitrator: <ProfileName username={nod.arbitrator || ""} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 5. Claim Expiry Actions (Only when Awaiting completion and expired) */}
                        {nod.status === "nodded" && isExpired && isUserCounterparty && nod.cautionAmount && nod.cautionAmount > 0 && (
                            <Button
                                onClick={handleClaimExpired}
                                disabled={!!isActionLoading}
                                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                            >
                                {isActionLoading === "claim" ? "Claiming..." : "Claim Expired Escrow"}
                            </Button>
                        )}

                        {/* Info banners */}
                        {nod.status === "completed" && (
                            <div className="w-full text-center py-2 text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5">
                                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4.5 h-4.5" />
                                Agreement successfully completed and resolved on Stellar
                            </div>
                        )}

                        {nod.status === "declined" && (
                            <div className="w-full text-center py-2 text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5">
                                <HugeiconsIcon icon={CancelCircleIcon} className="w-4.5 h-4.5" />
                                This agreement draft was declined on-chain
                            </div>
                        )}
                    </CardFooter>
                </Card>
            </motion.div>

            {/* Live Third-Party Verification Card */}
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

                                {/* Run All Checks button */}
                                {verifyStep === 0 && (
                                    <Button
                                        onClick={async () => {
                                            setIsVerifyRunning(true);
                                            setContentCheck(null);
                                            setIpfsCheck(null);
                                            setContractCheck(null);

                                            // Step 1: Soroban contract query
                                            setVerifyStep(1);
                                            let onChainCid = nod.cid;
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
                                            let ipfsContent: Record<string, any> | null = null;
                                            try {
                                                if (onChainCid && !onChainCid.startsWith("MOCK_CID_")) {
                                                    ipfsContent = await fetchIPFSContent(onChainCid) as Record<string, any>;
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
                                                const ipfsText = ipfsContent?.text || "";
                                                const expectedText = nod.text || "";
                                                const textMatch = ipfsText.trim() === expectedText.trim();
                                                setContentCheck({ passed: textMatch, ipfsText, expectedText });
                                            } catch {
                                                setContentCheck({ passed: false, ipfsText: "", expectedText: nod.text });
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

                                {/* Check 1: Blockchain State Check */}
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

                                {/* Check 2: Storage Verification Check */}
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

                                {/* Check 3: Content Integrity Check */}
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
                                                {contentCheck.passed ? "✓ Verified: The agreement content retrieved from decentralized storage matches the local terms exactly." : "✗ Mismatch: The agreement content does not match the local terms."}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Collapsible Technical parameters for developers */}
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
                                                                    <code className="break-all">{nod.cid || "N/A"}</code>
                                                                </div>
                                                            </>
                                                        )}
                                                        {contentCheck && (
                                                            <>
                                                                <div>
                                                                    <span className="font-semibold text-[var(--foreground)]">Expected Content: </span>
                                                                    <code className="break-all">"{contentCheck.expectedText}"</code>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-[var(--foreground)]">IPFS Content: </span>
                                                                    <code className="break-all">"{contentCheck.ipfsText}"</code>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Reset */}
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

            {/* Zero-Knowledge Proof Verification Panel */}
            <ZKVerificationPanel nod={nod} />
        </div>
    );
}
