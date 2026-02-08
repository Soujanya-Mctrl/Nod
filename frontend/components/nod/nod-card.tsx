"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Link01Icon,
    Copy01Icon,
    Calendar03Icon,
    User03Icon,
    SentIcon,
    InboxDownloadIcon,
    Tick01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type NodStatus } from "./status-badge";
import { cn } from "@/lib/utils";
import { useNods } from "@/lib/store";
import { ProfileName } from "./profile-name";

export interface NodData {
    id: string;
    text: string;
    hash: string;
    counterparty: string;
    status: NodStatus;
    createdAt: string;
    deadline?: string;
    createdByMe?: boolean; // true = I sent this, false = I received this
}

interface NodCardProps {
    nod: NodData;
    index?: number;
}

// Helper function for relative time
function getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr.replace(/(\w+) (\d+), (\d+)/, "$1 $2, $3"));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return dateStr;
}

export function NodCard({ nod, index = 0 }: NodCardProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(nod.hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const relativeTime = getRelativeTime(nod.createdAt);
    const isSent = nod.createdByMe !== false; // Default to true for backwards compatibility

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.2,
                delay: index * 0.03,
                ease: "easeOut"
            }}
        >
            <Card className={cn(
                "h-full hover:border-[var(--border-strong)] transition-colors",
                !isSent && "border-l-2 border-l-blue-400"
            )}>
                <CardContent className="p-4 space-y-3">
                    {/* Header with sent/received indicator */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                                isSent ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                            )}>
                                <HugeiconsIcon
                                    icon={isSent ? SentIcon : InboxDownloadIcon}
                                    className="w-3.5 h-3.5"
                                />
                            </div>
                            <span className={cn(
                                "text-xs font-medium",
                                isSent ? "text-emerald-700" : "text-blue-700"
                            )}>
                                {isSent ? "Sent" : "Received"}
                            </span>
                        </div>
                        <StatusBadge status={nod.status} />
                    </div>

                    {/* Agreement text */}
                    <p className="text-sm text-[var(--foreground)] leading-relaxed line-clamp-2">
                        "{nod.text}"
                    </p>

                    {/* Meta info */}
                    <div className="flex flex-col gap-1.5 text-xs text-[var(--foreground-muted)]">
                        <div className="flex items-center gap-1.5">
                            <HugeiconsIcon icon={User03Icon} className="w-3.5 h-3.5" />
                            <span>
                                {isSent ? "To " : "From "}
                                <ProfileName username={nod.counterparty} />
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <HugeiconsIcon icon={Calendar03Icon} className="w-3.5 h-3.5" />
                            <span>{relativeTime}</span>
                            <span className="text-[var(--border-strong)]">•</span>
                            <span>{nod.createdAt}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" asChild className="flex-1">
                            <Link href={`/nod/${nod.id}`}>
                                <HugeiconsIcon icon={Link01Icon} className="w-3.5 h-3.5" />
                                View Nod
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopy}
                            title={copied ? "Copied!" : "Copy agreement hash"}
                            className={cn(
                                "h-9 w-9 transition-all duration-200",
                                copied && "border-emerald-500 bg-emerald-50 text-emerald-600"
                            )}
                            aria-label="Copy agreement hash"
                        >
                            <HugeiconsIcon
                                icon={copied ? Tick01Icon : Copy01Icon}
                                className={cn("w-3.5 h-3.5", copied && "animate-in zoom-in-50")}
                            />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
