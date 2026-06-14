"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    ChevronDown,
    Check,
    Folder,
    Clock,
    Play,
    CheckCircle,
    AlertTriangle,
    XCircle,
    FileText,
    LucideIcon
} from "lucide-react";

export type FilterOption = "all" | "awaiting" | "nodded" | "completed" | "expired" | "declined" | "draft";

interface FilterOptionConfig {
    value: FilterOption;
    label: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
}

const filterConfigs: Record<FilterOption, FilterOptionConfig> = {
    all: { value: "all", label: "All Nods", icon: Folder, color: "text-zinc-600 dark:text-zinc-400", bgColor: "bg-zinc-100 dark:bg-zinc-800" },
    awaiting: { value: "awaiting", label: "Awaiting Signatures", icon: Clock, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100/60 dark:bg-amber-900/30" },
    nodded: { value: "nodded", label: "Active Agreements", icon: Play, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100/60 dark:bg-blue-900/30" },
    completed: { value: "completed", label: "Completed", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100/60 dark:bg-emerald-900/30" },
    expired: { value: "expired", label: "Expired", icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-100/60 dark:bg-yellow-900/30" },
    declined: { value: "declined", label: "Declined", icon: XCircle, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-100/60 dark:bg-rose-900/30" },
    draft: { value: "draft", label: "Drafts", icon: FileText, color: "text-neutral-500 dark:text-neutral-400", bgColor: "bg-neutral-100 dark:bg-neutral-800" },
};

interface FilterDropdownProps {
    activeFilter: FilterOption;
    onFilterChange: (filter: FilterOption) => void;
    counts?: Record<FilterOption, number>;
}

export function FilterPills({ activeFilter, onFilterChange, counts }: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const activeConfig = filterConfigs[activeFilter];
    const ActiveIcon = activeConfig.icon;

    const filters = Object.values(filterConfigs);

    return (
        <div className="relative inline-block text-left w-full sm:w-64" ref={containerRef}>
            {/* Label for context */}
            <span className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">
                Filter Agreements
            </span>

            {/* Dropdown Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all shadow-sm cursor-pointer",
                    "bg-[var(--background)] border-[var(--border-strong)] text-[var(--foreground)]",
                    "hover:bg-[var(--accent)] hover:border-[var(--foreground-muted)]",
                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--background)] focus:ring-[var(--foreground)]",
                    isOpen && "border-[var(--foreground)] bg-[var(--accent)]"
                )}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn("p-1 rounded-md", activeConfig.bgColor)}>
                        <ActiveIcon className={cn("w-4 h-4 shrink-0", activeConfig.color)} />
                    </span>
                    <span className="truncate font-semibold">{activeConfig.label}</span>
                    {counts !== undefined && (
                        <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-[var(--accent)] text-[var(--foreground-muted)] font-medium">
                            {counts[activeFilter]}
                        </span>
                    )}
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="ml-2 text-[var(--foreground-muted)] shrink-0"
                >
                    <ChevronDown className="w-4 h-4" />
                </motion.div>
            </button>

            {/* Dropdown Options Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={cn(
                            "absolute left-0 mt-2 w-full sm:w-72 rounded-xl border shadow-lg z-50 py-1.5 focus:outline-none origin-top-left",
                            "bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-zinc-200/80 dark:border-zinc-800/80"
                        )}
                        role="listbox"
                    >
                        {filters.map((filter) => {
                            const Icon = filter.icon;
                            const isSelected = activeFilter === filter.value;
                            const count = counts?.[filter.value];

                            return (
                                <button
                                    key={filter.value}
                                    onClick={() => {
                                        onFilterChange(filter.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "flex items-center justify-between w-full px-3.5 py-2 text-sm text-left transition-colors cursor-pointer",
                                        isSelected
                                            ? "bg-zinc-50 dark:bg-zinc-900/60 font-semibold text-[var(--foreground)]"
                                            : "text-[var(--foreground-muted)] hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 hover:text-[var(--foreground)]"
                                    )}
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={cn("p-1 rounded-md shrink-0", filter.bgColor)}>
                                            <Icon className={cn("w-4 h-4", filter.color)} />
                                        </span>
                                        <span className="truncate">{filter.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {count !== undefined && (
                                            <span className={cn(
                                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                                isSelected
                                                    ? "bg-zinc-200 dark:bg-zinc-800 text-[var(--foreground)]"
                                                    : "bg-zinc-100 dark:bg-zinc-900 text-[var(--foreground-muted)]"
                                            )}>
                                                {count}
                                            </span>
                                        )}
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-[var(--foreground)]" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

