"use client";

import React from "react";

export type FilterOption = "all" | "awaiting" | "nodded" | "completed" | "expired" | "declined" | "draft";

interface FilterPillsProps {
    activeFilter: FilterOption;
    onFilterChange: (filter: FilterOption) => void;
}

export function FilterPills({ activeFilter, onFilterChange }: FilterPillsProps) {
    const filters: { value: FilterOption; label: string }[] = [
        { value: "all", label: "All" },
        { value: "awaiting", label: "Awaiting" },
        { value: "nodded", label: "Active" },
        { value: "completed", label: "Completed" },
        { value: "expired", label: "Expired" },
        { value: "declined", label: "Declined" },
        { value: "draft", label: "Drafts" },
    ];

    return (
        <div className="w-full max-w-3xl">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 bg-[var(--accent)] p-1 rounded-xl border border-[var(--border)]">
                {filters.map((filter) => {
                    const isSelected = activeFilter === filter.value;
                    return (
                        <button
                            key={filter.value}
                            type="button"
                            onClick={() => onFilterChange(filter.value)}
                            className={`py-2 px-1 text-xs md:text-sm font-medium rounded-lg transition-all text-center cursor-pointer ${
                                isSelected
                                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm border border-[var(--border-strong)]/20 font-semibold"
                                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                            }`}
                        >
                            {filter.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
