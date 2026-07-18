"use client";

import React from "react";
import { Wallet, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";

export interface WalletOption {
    id: string;
    name: string;
    description: string;
    type: "extension" | "web" | "hardware";
    recommended?: boolean;
}

export const SUPPORTED_WALLETS: WalletOption[] = [
    {
        id: "freighter",
        name: "Freighter Wallet",
        description: "Official browser extension wallet for Stellar & Soroban smart contracts.",
        type: "extension",
        recommended: true,
    },
    {
        id: "albedo",
        name: "Albedo Link",
        description: "Secure web-based Stellar signer with no extension download needed.",
        type: "web",
    },
    {
        id: "xbull",
        name: "xBull Wallet",
        description: "Feature-rich multi-platform extension and web wallet for Stellar.",
        type: "extension",
    },
    {
        id: "lobstr",
        name: "LOBSTR Wallet",
        description: "Mobile and web Stellar wallet with seamless sign-in integration.",
        type: "web",
    },
    {
        id: "hana",
        name: "Hana Wallet",
        description: "Multi-chain browser extension supporting Soroban ecosystem.",
        type: "extension",
    },
];

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectWallet: (walletId: string) => Promise<any> | any;
    isConnecting: boolean;
    connectingWalletId: string | null;
    errorMsg: string | null;
}

export function WalletModal({
    isOpen,
    onClose,
    onSelectWallet,
    isConnecting,
    connectingWalletId,
    errorMsg,
}: WalletModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl space-y-5 text-[var(--foreground)]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--border)]/40 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold tracking-tight">Connect Stellar Wallet</h3>
                            <p className="text-xs text-[var(--foreground-muted)]">Select your preferred wallet provider</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 hover:bg-[var(--accent)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-bold">Connection Error</p>
                            <p className="opacity-90 leading-relaxed">{errorMsg}</p>
                        </div>
                    </div>
                )}

                {/* Wallet Selection List */}
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {SUPPORTED_WALLETS.map((wallet) => {
                        const isLoadingThis = isConnecting && connectingWalletId === wallet.id;

                        return (
                            <button
                                key={wallet.id}
                                onClick={() => onSelectWallet(wallet.id)}
                                disabled={isConnecting}
                                className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between group cursor-pointer ${
                                    isLoadingThis
                                        ? "border-emerald-500 bg-emerald-500/10"
                                        : "border-[var(--border)]/60 hover:border-emerald-500/50 hover:bg-emerald-500/5 bg-[var(--card-bg,transparent)]"
                                }`}
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform font-bold text-sm">
                                        {wallet.name.charAt(0)}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-[var(--foreground)]">
                                                {wallet.name}
                                            </span>
                                            {wallet.recommended && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                                    Recommended
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-[var(--foreground-muted)] line-clamp-1">
                                            {wallet.description}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    {isLoadingThis ? (
                                        <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4 text-[var(--foreground-muted)] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer security note */}
                <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-[11px] text-[var(--foreground-muted)]">
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        StellarWalletsKit Encrypted
                    </span>
                    <span>Testnet Active</span>
                </div>
            </div>
        </div>
    );
}
