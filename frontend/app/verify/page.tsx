"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search01Icon,
    CheckmarkCircle01Icon,
    CancelCircleIcon,
    ArrowRight01Icon,
    Copy01Icon,
    Cancel01Icon,
    GridIcon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileName } from "@/components/nod/profile-name";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type NodStatus } from "@/components/nod/status-badge";
import { cn, generateHash, truncateHash } from "@/lib/utils";

import { useNods, type Nod } from "@/lib/store";

type StatusFilter = "all" | NodStatus;

export default function VerifyPage() {
    const { nods: onChainNods, isLoaded, resolveProfile } = useNods();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [copiedId, setCopiedId] = useState<string | null>(null);

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
                const creatorProfile = resolveProfile(nod.creator);
                const counterpartyProfile = resolveProfile(nod.counterparty);
                const creatorName = creatorProfile?.displayName?.toLowerCase() || "";
                const counterpartyName = counterpartyProfile?.displayName?.toLowerCase() || "";

                return (
                    (nod.transactionHash || "").toLowerCase().includes(query) ||
                    (nod.hash || "").toLowerCase().includes(query) ||
                    (nod.creator || "").toLowerCase().includes(query) ||
                    creatorName.includes(query) ||
                    (nod.counterparty || "").toLowerCase().includes(query) ||
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
        performVerification(verifyHash);
    };

    const performVerification = async (hashToVerify: string) => {
        if (!hashToVerify.trim()) return;

        setIsVerifying(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));

        const cleanHash = hashToVerify.trim();
        const foundViaTx = onChainNods.find(n => n.transactionHash === cleanHash);
        const foundViaContent = onChainNods.find(n => n.hash === cleanHash);

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

                {/* Registry Instructions */}
                <Card className="overflow-hidden border-2 border-[var(--border)]">
                    <CardContent className="p-6">
                        <div className="rounded-xl p-6 bg-[var(--accent)]/30">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                    <HugeiconsIcon icon={Search01Icon} className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="space-y-3 flex-1">
                                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                                        How to Use the Registry
                                    </h3>
                                    <ul className="text-sm text-[var(--foreground-muted)] space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-600 mt-0.5">•</span>
                                            <span><strong>Search by hash, username, or ID</strong> using the search box below</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-600 mt-0.5">•</span>
                                            <span><strong>Filter by status</strong> (All, Awaiting, Nodded, Declined) to find specific agreements</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-600 mt-0.5">•</span>
                                            <span><strong>Click usernames</strong> to view agreement details (hash verification required for non-participants)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-600 mt-0.5">•</span>
                                            <span><strong>Copy transaction hashes</strong> by hovering over them for easy sharing</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
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

                        <div className="flex gap-2 bg-[var(--accent)] p-1 rounded-lg">
                            {statusFilters.map((filter) => (
                                <button
                                    key={filter.value}
                                    onClick={() => setStatusFilter(filter.value)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                        statusFilter === filter.value
                                            ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                                            : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                    )}
                                >
                                    {filter.label}
                                </button>
                            ))}
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
                                                <div className="flex items-center gap-1.5">
                                                    <a
                                                        href={`/nod/${nod.id}`}
                                                        className="text-sm font-medium text-[var(--foreground)] hover:text-emerald-600 hover:underline decoration-emerald-500/30 underline-offset-4 transition-colors"
                                                    >
                                                        <ProfileName username={nod.counterparty} />
                                                    </a>
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
