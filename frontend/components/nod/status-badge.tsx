"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type NodStatus = "draft" | "awaiting" | "nodded" | "declined" | "completed" | "expired" | "delivered" | "disputed";

interface StatusBadgeProps {
    status: NodStatus;
    className?: string;
}

const statusConfig: Record<NodStatus, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
    draft: {
        label: "Draft",
        dotColor: "bg-neutral-400",
        bgColor: "bg-neutral-100/90",
        textColor: "text-neutral-600",
    },
    awaiting: {
        label: "Awaiting",
        dotColor: "bg-amber-500",
        bgColor: "bg-amber-50/90",
        textColor: "text-amber-700",
    },
    nodded: {
        label: "Nodded",
        dotColor: "bg-blue-500",
        bgColor: "bg-blue-50/90",
        textColor: "text-blue-700",
    },
    declined: {
        label: "Declined",
        dotColor: "bg-rose-500",
        bgColor: "bg-rose-50/90",
        textColor: "text-rose-700",
    },
    completed: {
        label: "Completed",
        dotColor: "bg-emerald-500",
        bgColor: "bg-emerald-50/90",
        textColor: "text-emerald-700",
    },
    expired: {
        label: "Expired",
        dotColor: "bg-yellow-600",
        bgColor: "bg-yellow-50/90",
        textColor: "text-yellow-800",
    },
    delivered: {
        label: "Delivered",
        dotColor: "bg-indigo-500",
        bgColor: "bg-indigo-50/90",
        textColor: "text-indigo-700",
    },
    disputed: {
        label: "Disputed",
        dotColor: "bg-orange-500",
        bgColor: "bg-orange-50/90",
        textColor: "text-orange-700",
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
