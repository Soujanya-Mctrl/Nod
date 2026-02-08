"use client";

import React, { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Add01Icon, InboxIcon, Clock01Icon, CheckmarkCircle01Icon, Cancel01Icon, SentIcon, InboxDownloadIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type { NodData } from "@/components/nod/nod-card";
import { useNods } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FilterOption } from "../components/nod/filter-pills";

// Lazy load components
const NodCard = dynamic(() => import("@/components/nod/nod-card").then(mod => ({ default: mod.NodCard })), {
    loading: () => <CardSkeleton />,
});

const FilterPills = dynamic(() => import("../components/nod/filter-pills").then(mod => ({ default: mod.FilterPills })), {
    loading: () => <div className="h-10 flex gap-2">{[...Array(5)].map((_, i) => <div key={i} className="w-20 h-9 bg-[var(--accent)] rounded-lg animate-pulse" />)}</div>,
});

import { WalletConnect } from "@/components/profile/wallet-connect";

// Card skeleton for loading state
function CardSkeleton() {
    return (
        <Card className="h-full animate-pulse">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                    <div className="h-5 w-24 bg-[var(--accent)] rounded" />
                    <div className="h-6 w-16 bg-[var(--accent)] rounded-md" />
                </div>
                <div className="h-10 w-full bg-[var(--accent)] rounded" />
                <div className="space-y-2">
                    <div className="h-4 w-32 bg-[var(--accent)] rounded" />
                    <div className="h-4 w-40 bg-[var(--accent)] rounded" />
                </div>
                <div className="flex gap-2 pt-1">
                    <div className="h-9 flex-1 bg-[var(--accent)] rounded-lg" />
                    <div className="h-9 w-9 bg-[var(--accent)] rounded-lg" />
                </div>
            </CardContent>
        </Card>
    );
}

// Empty state config
const emptyStateConfig: Record<FilterOption, { icon: typeof InboxIcon; title: string; description: string }> = {
    all: { icon: InboxIcon, title: "No nods yet", description: "Create your first nod or wait for someone to send you one." },
    awaiting: { icon: Clock01Icon, title: "No pending nods", description: "No agreements waiting for a response." },
    nodded: { icon: CheckmarkCircle01Icon, title: "No acknowledged nods", description: "No agreements have been acknowledged yet." },
    declined: { icon: Cancel01Icon, title: "No declined nods", description: "No agreements have been declined." },
    draft: { icon: InboxIcon, title: "No drafts", description: "You don't have any draft agreements." }
};

export default function Dashboard() {
    const { nods, isLoaded } = useNods();
    const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

    // Show skeletons while loading from storage
    if (!isLoaded) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between">
                    <div className="h-10 w-48 bg-[var(--accent)] rounded-lg animate-pulse" />
                    <div className="h-10 w-32 bg-[var(--accent)] rounded-lg animate-pulse" />
                </div>
                <div className="flex gap-4">
                    <div className="h-10 w-24 bg-[var(--accent)] rounded-lg animate-pulse" />
                    <div className="h-10 w-24 bg-[var(--accent)] rounded-lg animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
                </div>
            </div>
        );
    }

    const filteredNods = activeFilter === "all"
        ? nods
        : nods.filter((nod) => nod.status === activeFilter);

    const emptyState = emptyStateConfig[activeFilter];
    const sentCount = nods.filter(n => n.createdByMe).length;
    const receivedCount = nods.filter(n => !n.createdByMe).length;


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Your Nods</h1>
                    <p className="text-[var(--foreground-muted)]">Manage your agreements and promises</p>
                </div>
                <div className="flex items-center gap-3">
                    <WalletConnect />
                    <Link href="/create">
                        <Button className="bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity">
                            <HugeiconsIcon icon={PlusSignIcon} className="w-5 h-5 mr-2" />
                            New Nod
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <HugeiconsIcon icon={SentIcon} className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">{sentCount} Sent</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                    <HugeiconsIcon icon={InboxDownloadIcon} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{receivedCount} Received</span>
                </div>
            </div>

            {/* Filters */}
            <Suspense fallback={<div className="h-10 flex gap-2">{[...Array(5)].map((_, i) => <div key={i} className="w-20 h-9 bg-[var(--accent)] rounded-lg animate-pulse" />)}</div>}>
                <FilterPills activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            </Suspense>

            {/* Cards Grid */}
            {filteredNods.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Suspense fallback={[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}>
                        {filteredNods.map((nod, index) => (
                            <NodCard key={nod.id} nod={nod} index={index} />
                        ))}
                    </Suspense>
                </div>
            ) : (
                <motion.div key={activeFilter} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="py-12">
                        <CardContent className="flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center mb-3">
                                <HugeiconsIcon icon={emptyState.icon} className="w-6 h-6 text-[var(--foreground-muted)]" />
                            </div>
                            <h3 className="text-sm font-semibold mb-1">{emptyState.title}</h3>
                            <p className="text-xs text-[var(--foreground-muted)] max-w-xs mb-4">{emptyState.description}</p>
                            {activeFilter === "all" ? (
                                <Button asChild size="sm"><Link href="/create"><HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />Create Nod</Link></Button>
                            ) : (
                                <Button variant="secondary" size="sm" onClick={() => setActiveFilter("all")}>View All</Button>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
}
