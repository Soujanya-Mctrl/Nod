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
import { ChevronDown, Check } from "lucide-react";



import { useNods, type Nod } from "@/lib/store";

type StatusFilter = "all" | NodStatus;

export default function VerifyPage() {
    const { nods: onChainNods, isLoaded, resolveProfile } = useNods();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [copiedId, setCopiedId] = useState<string | null>(null);

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

    // Verification state
    const [verifyHash, setVerifyHash] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{
        found: boolean;
        nod?: Nod;
        method?: 'transaction' | 'content';
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

                {/* Live Verification Panel */}
                <Card className="overflow-hidden border-2 border-[var(--border)]">
                    <CardContent className="p-6 space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                <HugeiconsIcon icon={SecurityCheckIcon} className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-[var(--foreground)]">
                                    Verify an Agreement
                                </h3>
                                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    Enter a transaction hash or IPFS CID (Content Hash) to verify its status on the registry.
                                </p>
                            </div>
                        </div>

                        {/* Verification Form */}
                        <form onSubmit={handleVerificationSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--foreground)]">Transaction Hash or IPFS CID (Content Hash)</label>
                                <Input
                                    placeholder="e.g. Qm... or 0x... / transaction hash"
                                    value={verifyHash}
                                    onChange={(e) => { setVerifyHash(e.target.value); setVerificationResult(null); }}
                                    className="font-mono text-sm"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isVerifying || !verifyHash.trim()}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                            >
                                {isVerifying ? (
                                    <div className="flex items-center gap-2">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                                        />
                                        Searching registry...
                                    </div>
                                ) : (
                                    <>
                                        <HugeiconsIcon icon={SecurityCheckIcon} className="w-4 h-4 mr-2" />
                                        Verify Hash
                                    </>
                                )}
                            </Button>
                        </form>

                        {/* Verification Result */}
                        <AnimatePresence>
                            {verificationResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-3"
                                >
                                    {/* Result banner */}
                                    <div className={`p-4 rounded-lg border ${verificationResult.found ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                                        <div className="flex items-center gap-2.5">
                                            <HugeiconsIcon
                                                icon={verificationResult.found ? CheckmarkCircle01Icon : CancelCircleIcon}
                                                className={`w-5 h-5 ${verificationResult.found ? "text-emerald-600" : "text-rose-500"}`}
                                            />
                                            <div>
                                                <span className={`text-sm font-bold ${verificationResult.found ? "text-emerald-600" : "text-rose-500"}`}>
                                                    {verificationResult.found ? "✓ Agreement Found" : "✗ No Matching Agreement"}
                                                </span>
                                                {verificationResult.method && (
                                                    <span className="text-[10px] text-[var(--foreground-muted)] block mt-0.5">
                                                        Matched via {verificationResult.method === 'transaction' ? 'transaction hash' : 'IPFS CID (Content Hash)'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Matched nod details */}
                                        {verificationResult.nod && (
                                            <div className="mt-3 pt-3 border-t border-[var(--border)]/30 grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">Status</span>
                                                    <StatusBadge status={verificationResult.nod.status} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">Initiator</span>
                                                    <span className="text-xs font-semibold text-[var(--foreground)]"><ProfileName username={verificationResult.nod.creator} /></span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">Sealed</span>
                                                    <span className="text-xs text-[var(--foreground)]">{verificationResult.nod.createdAt}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">Escrow</span>
                                                    <span className="text-xs font-semibold text-[var(--foreground)]">{verificationResult.nod.cautionAmount ? `${(verificationResult.nod.cautionAmount / 10_000_000).toFixed(2)} XLM` : "None"}</span>
                                                </div>
                                            </div>
                                        )}

                                        {verificationResult.nod && (
                                            <div className="mt-3">
                                                <a
                                                    href={`/nod/${verificationResult.nod.id}`}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                                                >
                                                    View Full Agreement
                                                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
