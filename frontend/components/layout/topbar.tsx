"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Wallet, Clock, Lock, CheckCircle, ChevronDown, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStellarWallet } from "@/components/providers/stellar-provider";
import { useNods, type Nod } from "@/lib/store";
import { WalletConnect } from "@/components/profile/wallet-connect";
import { useSidebar } from "./sidebar-context";

interface SharedNod {
    shareId: string;
    type: "gated" | "zk";
    nodId: string;
    allowedAddress: string;
    createdAt: number;
}

export function Topbar() {
    const pathname = usePathname();
    const { address, isConnected } = useStellarWallet();
    const { nods, isParticipant } = useNods();
    const { toggleOpen, isMobile } = useSidebar();
    
    const [sharedNods, setSharedNods] = useState<SharedNod[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Fetch shared nods for notification badge
    useEffect(() => {
        if (!isConnected || !address) {
            setSharedNods([]);
            return;
        }

        const fetchShared = async () => {
            try {
                const res = await fetch(`/api/nods/share?address=${address}`);
                if (res.ok) {
                    const data = await res.json();
                    setSharedNods(data);
                }
            } catch (err) {
                console.error("Error fetching shares for notifications:", err);
            }
        };

        fetchShared();
        // Poll every 30 seconds for new shares/activities
        const interval = setInterval(fetchShared, 30000);
        return () => clearInterval(interval);
    }, [isConnected, address]);

    // Close popover when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Get page title from route
    const getPageTitle = () => {
        switch (pathname) {
            case "/":
                return "Dashboard";
            case "/create":
                return "Create Nod";
            case "/verify":
                return "Verify & Audit";
            case "/activity":
                return "Activity Log";
            default:
                if (pathname?.startsWith("/nod/")) return "Agreement Details";
                return "Nod Registry";
        }
    };

    // Calculate activities
    const participantNods = nods.filter(isParticipant);
    
    // 1. Pending nods awaiting approval
    const pendingNods = participantNods.filter(n => n.status === "awaiting");
    
    // 2. Shares received
    const notificationShares = sharedNods;

    const totalNotifications = pendingNods.length + notificationShares.length;

    return (
        <header className="sticky top-0 z-40 w-full border-b border-[var(--border)]/40 bg-[var(--background)]/80 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-6 lg:px-8">
                {/* Left Side: Mobile Menu or Page Title */}
                <div className="flex items-center gap-4">
                    {isMobile && (
                        <button
                            onClick={toggleOpen}
                            className="p-2 -ml-2 rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors"
                            aria-label="Open sidebar"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    )}
                    <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)] sm:text-base">
                        {getPageTitle()}
                    </h2>
                </div>

                {/* Right Side: Notifications & Wallet Connect */}
                <div className="flex items-center gap-4">
                    {/* Notification Bell */}
                    {isConnected && (
                        <div className="relative" ref={popoverRef}>
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className={`relative p-2 rounded-xl border border-[var(--border)]/60 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-all cursor-pointer ${
                                    isOpen ? "bg-[var(--accent)] text-[var(--foreground)]" : ""
                                }`}
                            >
                                <Bell className="w-4 h-4" />
                                {totalNotifications > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white shadow-sm animate-pulse">
                                        {totalNotifications}
                                    </span>
                                )}
                            </button>

                            {/* Dropdown Popover */}
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 mt-2.5 w-80 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-xl ring-1 ring-black/5 z-50 text-[var(--foreground)]"
                                    >
                                        <div className="flex items-center justify-between border-b border-[var(--border)]/40 pb-2 mb-3">
                                            <span className="text-xs font-bold">Notifications</span>
                                            {totalNotifications > 0 && (
                                                <span className="text-[10px] bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 font-bold px-2 py-0.5 rounded-full">
                                                    {totalNotifications} Actionable
                                                </span>
                                            )}
                                        </div>

                                        <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 select-none">
                                            {totalNotifications === 0 ? (
                                                <div className="py-6 text-center text-xs text-[var(--foreground-muted)]">
                                                    No pending actions or shared payloads.
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Pending Approvals */}
                                                    {pendingNods.map(nod => (
                                                        <Link
                                                            key={nod.id}
                                                            href={`/`}
                                                            onClick={() => setIsOpen(false)}
                                                            className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[var(--accent)] transition-colors border border-transparent hover:border-[var(--border)]/40 block text-left"
                                                        >
                                                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600">
                                                                <Clock className="w-4 h-4" />
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <span className="text-[11px] font-bold block leading-snug">
                                                                    Approval Required
                                                                </span>
                                                                <span className="text-[10px] text-[var(--foreground-muted)] line-clamp-1">
                                                                    {nod.createdByMe ? "Waiting for counterparty signature" : "Signature required from you"}
                                                                </span>
                                                            </div>
                                                        </Link>
                                                    ))}

                                                    {/* Shares Received */}
                                                    {notificationShares.map(share => (
                                                        <Link
                                                            key={share.shareId}
                                                            href={`/nod/${share.nodId}?shareId=${share.shareId}`}
                                                            onClick={() => setIsOpen(false)}
                                                            className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[var(--accent)] transition-colors border border-transparent hover:border-[var(--border)]/40 block text-left"
                                                        >
                                                            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 text-violet-600">
                                                                <Lock className="w-4 h-4" />
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <span className="text-[11px] font-bold block leading-snug">
                                                                    Encrypted Share Received
                                                                </span>
                                                                <span className="text-[10px] text-[var(--foreground-muted)] line-clamp-1 font-mono">
                                                                    Nod ID: {share.nodId}
                                                                </span>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </>
                                            )}
                                        </div>

                                        <div className="border-t border-[var(--border)]/40 pt-2.5 mt-3 flex justify-center">
                                            <Link
                                                href="/activity"
                                                onClick={() => setIsOpen(false)}
                                                className="text-[11px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors flex items-center gap-1"
                                            >
                                                Open Full Activity Log
                                            </Link>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Wallet Connect */}
                    <div className="shrink-0">
                        <WalletConnect />
                    </div>
                </div>
            </div>
        </header>
    );
}
