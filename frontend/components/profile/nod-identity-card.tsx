"use client";

import React, { useState } from "react";
import { Copy, Check, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, truncateHash } from "@/lib/utils";

interface NodIdentityCardProps {
    id: string;
    label?: string;
    onUserClick?: () => void;
    onCardClick?: () => void;
    className?: string;
    shouldTruncate?: boolean;
}

export function NodIdentityCard({
    id,
    label = "Nod Agreement",
    onUserClick,
    onCardClick,
    className,
    shouldTruncate = true,
}: NodIdentityCardProps) {
    const [copied, setCopied] = useState(false);

    const displayId = shouldTruncate ? truncateHash(id, 6, 4) : id;

    const handleCopy = () => {
        navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={cn("rounded-xl border border-gray-100 bg-white/50 backdrop-blur-sm transition-all duration-300", className)}>
            <div className="flex items-center gap-2.5 p-2 pr-1.5">
                {/* Left Section - Status Dot */}
                <div
                    onClick={onCardClick}
                    className={cn(
                        "w-6 h-6 shrink-0 bg-emerald-50 rounded-lg flex items-center justify-center transition-all",
                        onCardClick && "cursor-pointer hover:bg-emerald-100 active:scale-95"
                    )}
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
                </div>

                {/* Middle Section - ID Information */}
                <div
                    onClick={onCardClick}
                    className={cn(
                        "flex-1 min-w-0 pr-1",
                        onCardClick && "cursor-pointer hover:opacity-70 transition-opacity"
                    )}
                >
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mb-0.5 leading-none">
                        {label}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold text-gray-800 truncate">
                            {displayId}
                        </span>
                    </div>
                </div>

                {/* Right Section - Copy Button */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopy}
                    className="w-7 h-7 shrink-0 bg-gray-50 hover:bg-emerald-50 rounded-lg border border-gray-100 flex items-center justify-center transition-all group/copy"
                    title="Copy to clipboard"
                    aria-label="Copy hash"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {copied ? (
                            <motion.div
                                key="check"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ duration: 0.1 }}
                            >
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="copy"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ duration: 0.1 }}
                            >
                                <Copy className="w-3.5 h-3.5 text-gray-400 group-hover/copy:text-emerald-600 transition-colors" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>
        </div>
    );
}
