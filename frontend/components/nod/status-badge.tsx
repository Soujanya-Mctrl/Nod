"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type NodStatus = "draft" | "awaiting" | "nodded" | "declined";

interface StatusBadgeProps {
    status: NodStatus;
    className?: string;
}

const statusConfig: Record<NodStatus, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
    draft: {
        label: "Draft",
        dotColor: "bg-neutral-400",
        bgColor: "bg-neutral-100",
        textColor: "text-neutral-600",
    },
    awaiting: {
        label: "Awaiting",
        dotColor: "bg-amber-500",
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
    },
    nodded: {
        label: "Nodded",
        dotColor: "bg-emerald-500",
        bgColor: "bg-emerald-50",
        textColor: "text-emerald-700",
    },
    declined: {
        label: "Declined",
        dotColor: "bg-red-500",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
    },

};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium shrink-0",
                config.bgColor,
                config.textColor,
                className
            )}
        >
            <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
            {config.label}
        </div>
    );
}
