"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type FilterOption = "all" | "awaiting" | "nodded" | "declined" | "draft";

interface FilterPillsProps {
    activeFilter: FilterOption;
    onFilterChange: (filter: FilterOption) => void;
}

export function FilterPills({ activeFilter, onFilterChange }: FilterPillsProps) {
    const filters: { value: FilterOption; label: string }[] = [
        { value: "all", label: "All" },
        { value: "awaiting", label: "Awaiting" },
        { value: "nodded", label: "Nodded" },
        { value: "declined", label: "Declined" },
        { value: "draft", label: "Drafts" },
    ];

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filters.map((filter) => (
                <button
                    key={filter.value}
                    onClick={() => onFilterChange(filter.value)}
                    className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                        activeFilter === filter.value
                            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] shadow-sm"
                            : "bg-transparent text-[var(--foreground-muted)] border-transparent hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    )}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    );
}
