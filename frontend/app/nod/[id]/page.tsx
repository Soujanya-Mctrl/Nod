"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft01Icon,
    Copy01Icon,
    CheckmarkCircle01Icon,
    User03Icon,
    Calendar03Icon,
    Clock01Icon,
    Search01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type NodStatus } from "@/components/nod/status-badge";
import { cn } from "@/lib/utils";

import { useNods } from "@/lib/store";
import { ProfileName } from "@/components/nod/profile-name";
import { NodIdentityCard } from "@/components/profile/nod-identity-card";
import { HashVerificationModal } from "@/components/nod/hash-verification-modal";
import { useAccount, useSignTypedData, useWriteContract, useChainId } from "wagmi";
import { NodABI } from "../../../lib/abi/NodABI";

export default function NodDetailPage() {
    const params = useParams();
    const router = useRouter();
    const nodId = params.id as string;
    const { getNodById, updateNodStatus, isLoaded, isParticipant, userProfile } = useNods();

    const nod = getNodById(nodId);

    const [isActionLoading, setIsActionLoading] = useState<"accept" | "reject" | null>(null);
    const [hasAccess, setHasAccess] = useState(false);

    const { address } = useAccount();
    const chainId = useChainId();
    const { signTypedDataAsync } = useSignTypedData();
    const { writeContractAsync } = useWriteContract();

    // Check if user has access (participant or verified hash)
    React.useEffect(() => {
        if (!nod || !isLoaded) return;

        // Fetch draft from backend if signatures are missing
        if (!nod.sig1) {
            fetch(`/api/nods/draft?id=${nodId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.sig1) {
                        // Merge draft data into store
                        // In a real app, this would be a store action
                    }
                })
                .catch(err => console.error("Failed to fetch draft", err));
        }

        // Check if user is a participant
        if (isParticipant(nod)) {
            setHasAccess(true);
            return;
        }

        // Check if hash was previously verified in this session
        const verifiedHashes = JSON.parse(sessionStorage.getItem("verified_nod_hashes") || "{}");
        if (verifiedHashes[nodId]) {
            setHasAccess(true);
            return;
        }

        setHasAccess(false);
    }, [nod, nodId, isLoaded, isParticipant]);


    // Show loading state while fetching from storage
    if (!isLoaded) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 pt-10">
                <div className="h-6 w-32 bg-[var(--accent)] rounded animate-pulse" />
                <div className="h-[400px] w-full bg-[var(--accent)] rounded-xl animate-pulse" />
            </div>
        );
    }

    // If nod not found, show 404
    if (!nod) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center mb-4">
                    <HugeiconsIcon icon={Search01Icon} className="w-8 h-8 text-[var(--foreground-muted)]" />
                </div>
                <h1 className="text-xl font-semibold mb-2">Nod Not Found</h1>
                <p className="text-sm text-[var(--foreground-muted)] mb-6">
                    The nod you're looking for doesn't exist or has been removed.
                </p>
                <Button asChild>
                    <Link href="/">
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
        );
    }

    const handleAction = async (action: "accept" | "reject") => {
        if (!nod || !address) return;
        setIsActionLoading(action);

        try {
            if (action === "accept") {
                // 1. Sign the same payload
                const domain = {
                    name: "Nod",
                    version: "1",
                    chainId: chainId,
                } as const;

                const types = {
                    Agreement: [
                        { name: "cid", type: "string" },
                        { name: "initiator", type: "address" },
                        { name: "counterparty", type: "address" },
                        { name: "createdAt", type: "uint256" },
                        { name: "expiresAt", type: "uint256" },
                        { name: "nonce", type: "uint256" },
                    ],
                } as const;

                const value = {
                    cid: nod.cid || "",
                    initiator: nod.creator as `0x${string}`,
                    counterparty: nod.counterparty as `0x${string}`,
                    createdAt: BigInt(nod.expiresAt ? nod.expiresAt - 86400 * 7 : 0), // Mocking back
                    expiresAt: BigInt(nod.expiresAt || 0),
                    nonce: BigInt(nod.nonce || 0),
                };

                const sig2 = await signTypedDataAsync({
                    domain,
                    types,
                    primaryType: "Agreement",
                    message: value,
                });

                // 2. Call contract to seal
                await writeContractAsync({
                    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
                    abi: NodABI,
                    functionName: "sealAgreement",
                    args: [
                        nod.cid || "",
                        nod.creator as `0x${string}`,
                        nod.counterparty as `0x${string}`,
                        value.createdAt,
                        value.expiresAt,
                        value.nonce,
                        nod.sig1 as `0x${string}`,
                        sig2,
                    ],
                });
            }

            updateNodStatus(nod.id, action === "accept" ? "nodded" : "declined");
            setIsActionLoading(null);
        } catch (error) {
            console.error("Failed to action nod:", error);
            alert("Action failed. See console.");
            setIsActionLoading(null);
        }
    };

    // Show hash verification modal if user doesn't have access
    if (!hasAccess && nod) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/">
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                </Button>

                <HashVerificationModal
                    expectedHash={nod.hash}
                    nodId={nodId}
                    onVerified={() => setHasAccess(true)}
                />
            </div>
        );
    }


    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Back Button */}
            <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
                    Back to Dashboard
                </Link>
            </Button>

            {/* Nod Details Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl">Nod Details</CardTitle>
                                <CardDescription>View and verify this agreement</CardDescription>
                            </div>
                            <StatusBadge status={nod.status} />
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Agreement Text */}
                        <div className="p-4 rounded-xl bg-[var(--accent)] border border-[var(--border)]">
                            <p className="text-[var(--foreground)] font-medium">"{nod.text}"</p>
                        </div>

                        {/* Meta Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                                    <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                                    <span>From</span>
                                </div>
                                <div className="text-sm font-medium text-[var(--foreground)]">
                                    <ProfileName username={nod.creator} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                                    <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                                    <span>To</span>
                                </div>
                                <div className="text-sm font-medium text-[var(--foreground)]">
                                    <ProfileName username={nod.counterparty} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                                    <HugeiconsIcon icon={Calendar03Icon} className="w-3.5 h-3.5" />
                                    <span>Date</span>
                                </div>
                                <p className="text-sm font-medium text-[var(--foreground)]">{nod.createdAt}</p>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                                    <HugeiconsIcon icon={Clock01Icon} className="w-3.5 h-3.5" />
                                    <span>Time</span>
                                </div>
                                <p className="text-sm font-medium text-[var(--foreground)]">{nod.timestamp}</p>
                            </div>
                        </div>

                        {/* hashes */}
                        <div className="space-y-4">
                            <NodIdentityCard
                                id={nod.transactionHash}
                                label="Transaction Hash (On-Chain ID)"
                            />

                            <NodIdentityCard
                                id={nod.hash}
                                label="Sealed Content Hash"
                            />
                            <p className="text-[10px] text-[var(--foreground-muted)] pl-1">
                                Immutable hash of the agreement text + metadata.
                            </p>
                        </div>

                        {/* Share Link */}


                    </CardContent>

                    {/* Actions for Received Nods - Only show to the actual counterparty */}
                    {nod.status === "awaiting" && userProfile?.username === nod.counterparty && (
                        <CardFooter className="grid grid-cols-2 gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                onClick={() => handleAction("reject")}
                                disabled={!!isActionLoading}
                            >
                                {isActionLoading === "reject" ? "Declining..." : "Decline"}
                            </Button>
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleAction("accept")}
                                disabled={!!isActionLoading}
                            >
                                {isActionLoading === "accept" ? "Accepting..." : "Accept"}
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </motion.div>
        </div>
    );
}
