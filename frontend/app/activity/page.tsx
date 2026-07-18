"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
    Clock01Icon, 
    ArrowRight01Icon, 
    CheckmarkCircle01Icon, 
    Share01Icon,
    InboxDownloadIcon,
    SentIcon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStellarWallet } from "@/components/providers/stellar-provider";
import { useNods } from "@/lib/store";
import { Loader2, Lock, Wallet, AlertTriangle, UserCheck, Eye, ShieldAlert } from "lucide-react";
import { ProfileName } from "@/components/nod/profile-name";

interface SharedNod {
    shareId: string;
    type: "gated" | "zk";
    nodId: string;
    allowedAddress: string;
    sharerAddress?: string;
    encryptedPayload: string;
    iv: string;
    createdAt: number;
}

type TabType = "pending" | "shared-with" | "shared-by" | "ledger";

export default function ActivityPage() {
    const { address, isConnected, connect, isInitializing } = useStellarWallet();
    const { nods, isParticipant, isLoaded } = useNods();
    const [sharedWithNods, setSharedWithNods] = useState<SharedNod[]>([]);
    const [sharedByNods, setSharedByNods] = useState<SharedNod[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("pending");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchActivityData = async () => {
        if (!isConnected || !address) return;
        setIsLoading(true);
        setError(null);
        try {
            // Fetch shared with me
            const resWith = await fetch(`/api/nods/share?address=${address}`);
            let dataWith = [];
            if (resWith.ok) {
                dataWith = await resWith.json();
                dataWith.sort((a: SharedNod, b: SharedNod) => b.createdAt - a.createdAt);
            }

            // Fetch shared by me
            const resBy = await fetch(`/api/nods/share?sharerAddress=${address}`);
            let dataBy = [];
            if (resBy.ok) {
                dataBy = await resBy.json();
                dataBy.sort((a: SharedNod, b: SharedNod) => b.createdAt - a.createdAt);
            }

            setSharedWithNods(dataWith);
            setSharedByNods(dataBy);
        } catch (err: any) {
            console.error("Error loading activity:", err);
            setError(err.message || "Could not retrieve activity logs.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoaded || !isConnected || !address) {
            setSharedWithNods([]);
            setSharedByNods([]);
            return;
        }

        fetchActivityData();
    }, [isConnected, address, isLoaded]);

    const participantNods = nods.filter(isParticipant);

    // Categories
    const pendingApprovals = participantNods.filter(n => n.status === "awaiting");
    
    const ledgerHistory = participantNods.filter(n => 
        ["nodded", "completed", "delivered", "disputed", "declined", "expired"].includes(n.status)
    );

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center">
                    <HugeiconsIcon icon={Clock01Icon} className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--foreground)]">Activity Log</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Monitor agreements requiring approval, secure packages shared, and historical ledger events.
                    </p>
                </div>
            </div>

            {/* Wallet State Check */}
            {isInitializing || !isLoaded ? (
                <Card className="p-8 text-center flex flex-col items-center justify-center gap-3 border-[var(--border)] bg-[var(--background)]">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <p className="text-xs text-[var(--foreground-muted)] font-medium">Initializing secure environment...</p>
                </Card>
            ) : !isConnected || !address ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-violet-500/20 bg-gradient-to-b from-violet-500/[0.03] to-transparent shadow-lg text-center p-8">
                        <CardContent className="space-y-4 pt-4 flex flex-col items-center max-w-md mx-auto">
                            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center text-violet-600">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-[var(--foreground)]">Connect Wallet to View Activity</h3>
                            <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                Connect your Freighter wallet to verify your identity and view private agreement secure packages shared directly with your address.
                            </p>
                            <Button 
                                onClick={connect}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold cursor-pointer shadow-md hover:shadow-violet-600/10"
                            >
                                Connect Freighter Wallet
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            ) : (
                <div className="space-y-6">
                    {/* Connected Wallet Info */}
                    <div className="p-4 rounded-xl bg-[var(--accent)] border border-[var(--border)] flex items-center justify-between gap-3 shadow-inner">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600">
                                <Wallet className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider block font-bold">Connected Address</span>
                                <span className="font-mono text-xs md:text-sm text-[var(--foreground)] font-semibold break-all">
                                    {address}
                                </span>
                            </div>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                        </span>
                    </div>

                    {/* Sub-Tabs Navigation */}
                    <div className="flex border-b border-[var(--border)]/40 overflow-x-auto gap-6 scrollbar-none">
                        {(
                            [
                                { id: "pending", label: "Awaiting Action", count: pendingApprovals.length },
                                { id: "shared-with", label: "Shared with Me", count: sharedWithNods.length },
                                { id: "shared-by", label: "Shared by Me", count: sharedByNods.length },
                                { id: "ledger", label: "Ledger History", count: ledgerHistory.length }
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 text-xs sm:text-sm font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? "text-violet-600 dark:text-violet-400"
                                        : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                }`}
                            >
                                <span className="flex items-center gap-2">
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            tab.id === "pending"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                                : "bg-[var(--accent)] text-[var(--foreground)]"
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </span>
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTabUnderline"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Feed Content */}
                    {isLoading ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                            <p className="text-xs text-[var(--foreground-muted)] font-medium">Fetching secure payloads...</p>
                        </div>
                    ) : error ? (
                        <Card className="border-rose-500/20 bg-rose-500/5 p-6 text-center">
                            <div className="flex flex-col items-center gap-2 text-rose-500">
                                <AlertTriangle className="w-6 h-6" />
                                <h3 className="text-sm font-bold">Failed to load activity</h3>
                                <p className="text-xs text-[var(--foreground-muted)]">{error}</p>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {/* AWAITING ACTION TAB */}
                            {activeTab === "pending" && (
                                pendingApprovals.length === 0 ? (
                                    <div className="text-center py-12 text-xs text-[var(--foreground-muted)] bg-[var(--background)] border border-[var(--border)] rounded-2xl">
                                        No agreements are currently waiting for signatures or approval.
                                    </div>
                                ) : (
                                    pendingApprovals.map((nod) => (
                                        <Card key={nod.id} className="border-amber-500/20 dark:border-amber-500/40 bg-[var(--background)] overflow-hidden shadow-sm hover:shadow-md transition-all">
                                            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600 mt-0.5">
                                                        <UserCheck className="w-5 h-5" />
                                                    </div>
                                                    <div className="space-y-1 text-left">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-sm font-bold text-[var(--foreground)]">
                                                                Signature & Approval Required
                                                            </h4>
                                                            <span className="text-[9px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                                Awaiting Party
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-[var(--foreground-muted)] max-w-lg leading-relaxed">
                                                            Agreement ID: <span className="font-mono">{nod.id}</span>
                                                        </p>
                                                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                            {nod.createdByMe ? "Waiting for the counterparty to seal/sign" : "Counterparty has initiated. Review and sign to complete."}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-3">
                                                    <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs h-9 px-4 cursor-pointer">
                                                        <Link href={`/`}>
                                                            Go to Dashboard
                                                            <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1.5" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                )
                            )}

                            {/* SHARED WITH ME TAB */}
                            {activeTab === "shared-with" && (
                                sharedWithNods.length === 0 ? (
                                    <div className="text-center py-12 text-xs text-[var(--foreground-muted)] bg-[var(--background)] border border-[var(--border)] rounded-2xl">
                                        No agreement packages have been shared with your wallet.
                                    </div>
                                ) : (
                                    sharedWithNods.map((sn) => (
                                        <Card key={sn.shareId} className="border-[var(--border)] hover:border-violet-500/20 dark:hover:border-violet-500/40 bg-[var(--background)] overflow-hidden transition-all shadow-sm hover:shadow-md">
                                            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0 text-violet-600 mt-0.5">
                                                        <HugeiconsIcon icon={InboxDownloadIcon} className="w-5 h-5 text-violet-600" />
                                                    </div>
                                                    <div className="space-y-1 text-left">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-sm font-bold text-[var(--foreground)]">
                                                                Encrypted Agreement Received
                                                            </h4>
                                                            <span className="text-[9px] bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                                Gated
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-[var(--foreground-muted)]">
                                                            Nod ID: <span className="font-mono">{sn.nodId}</span>
                                                        </p>
                                                        {sn.sharerAddress && (
                                                            <p className="text-[11px] text-[var(--foreground-muted)]">
                                                                Shared by: <span className="font-mono text-violet-500">{sn.sharerAddress.slice(0, 6)}...{sn.sharerAddress.slice(-6)}</span>
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-[var(--foreground-muted)]">
                                                            Received on {new Date(sn.createdAt * 1000).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-3">
                                                    <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs h-9 px-4 cursor-pointer shadow-sm">
                                                        <Link href={`/nod/${sn.nodId}?shareId=${sn.shareId}`}>
                                                            Decrypt & View
                                                            <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1.5" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                )
                            )}

                            {/* SHARED BY ME TAB */}
                            {activeTab === "shared-by" && (
                                sharedByNods.length === 0 ? (
                                    <div className="text-center py-12 text-xs text-[var(--foreground-muted)] bg-[var(--background)] border border-[var(--border)] rounded-2xl">
                                        You have not shared any secure agreement links with other wallets.
                                    </div>
                                ) : (
                                    sharedByNods.map((sn) => (
                                        <Card key={sn.shareId} className="border-[var(--border)] hover:border-emerald-500/20 dark:hover:border-emerald-500/40 bg-[var(--background)] overflow-hidden transition-all shadow-sm hover:shadow-md">
                                            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0 text-emerald-600 mt-0.5">
                                                        <HugeiconsIcon icon={SentIcon} className="w-5 h-5 text-emerald-600" />
                                                    </div>
                                                    <div className="space-y-1 text-left">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-sm font-bold text-[var(--foreground)]">
                                                                Encrypted Agreement Sent
                                                            </h4>
                                                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                                Shared Link
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-[var(--foreground-muted)]">
                                                            Nod ID: <span className="font-mono">{sn.nodId}</span>
                                                        </p>
                                                        <p className="text-[11px] text-[var(--foreground-muted)]">
                                                            Recipient Wallet: <span className="font-mono text-emerald-600">{sn.allowedAddress.slice(0, 6)}...{sn.allowedAddress.slice(-6)}</span>
                                                        </p>
                                                        <p className="text-[10px] text-[var(--foreground-muted)]">
                                                            Generated on {new Date(sn.createdAt * 1000).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-3">
                                                    <Button variant="outline" onClick={() => {
                                                        const link = `${window.location.origin}/verify?shareId=${sn.shareId}`;
                                                        navigator.clipboard.writeText(link);
                                                        alert("Link copied to clipboard!");
                                                    }} className="text-xs h-9 border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer">
                                                        Copy Link
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                )
                            )}

                            {/* LEDGER HISTORY TAB */}
                            {activeTab === "ledger" && (
                                ledgerHistory.length === 0 ? (
                                    <div className="text-center py-12 text-xs text-[var(--foreground-muted)] bg-[var(--background)] border border-[var(--border)] rounded-2xl">
                                        No historical events recorded for your agreements on the blockchain.
                                    </div>
                                ) : (
                                    ledgerHistory.map((nod) => (
                                        <Card key={nod.id} className="border-[var(--border)] hover:border-violet-500/20 bg-[var(--background)] transition-all shadow-sm">
                                            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0 text-violet-600 mt-0.5">
                                                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-5 h-5 text-violet-600" />
                                                    </div>
                                                    <div className="space-y-1 text-left">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-sm font-bold text-[var(--foreground)]">
                                                                On-Chain Status Update
                                                            </h4>
                                                            <span className="text-[9px] bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 capitalize">
                                                                {nod.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-[var(--foreground-muted)] max-w-lg leading-relaxed">
                                                            Agreement ID: <span className="font-mono">{nod.id}</span>
                                                        </p>
                                                        <p className="text-xs text-[var(--foreground-muted)]">
                                                            Created on {nod.createdAt} {nod.timestamp}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                )
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
