"use client";

import React from "react";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useSidebar } from "./sidebar-context";

export function MobileHeader() {
    const { toggleOpen, isMobile } = useSidebar();

    if (!isMobile) return null;

    return (
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-[var(--background)] border-b border-[var(--border)] md:hidden">
            <button
                onClick={toggleOpen}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--accent)] transition-colors"
                aria-label="Open menu"
            >
                <HugeiconsIcon icon={Menu01Icon} className="w-5 h-5 text-[var(--foreground)]" />
            </button>

            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-[var(--foreground)] flex items-center justify-center">
                    <span className="text-[var(--background)] font-bold text-xs">N</span>
                </div>
                <span className="text-sm font-semibold text-[var(--foreground)]">Nod</span>
            </div>

            {/* Spacer */}
            <div className="w-10" />
        </header>
    );
}
