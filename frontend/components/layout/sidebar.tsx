"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    GridViewIcon,
    PencilEdit01Icon,
    Search01Icon,
    Menu01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

const navItems = [
    { href: "/", label: "Dashboard", icon: GridViewIcon },
    { href: "/create", label: "Create Nod", icon: PencilEdit01Icon },
    { href: "/verify", label: "Verify Nod", icon: Search01Icon },
];

export function Sidebar() {
    const { isOpen, isCollapsed, toggleCollapsed, setIsOpen, isMobile } = useSidebar();
    const pathname = usePathname();

    const sidebarContent = (
        <div className="flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)]">
            {/* Logo / Hamburger */}
            <div className="h-14 flex items-center justify-center px-3 border-b border-[var(--border)]">
                {isCollapsed && !isMobile ? (
                    <button
                        onClick={toggleCollapsed}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--accent)] transition-colors"
                        aria-label="Expand sidebar"
                    >
                        <HugeiconsIcon icon={Menu01Icon} className="w-5 h-5 text-[var(--foreground)]" />
                    </button>
                ) : (
                    <div className="flex items-center justify-between w-full px-1">
                        <Link href="/" className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[var(--foreground)] flex items-center justify-center shrink-0">
                                <span className="text-[var(--background)] font-bold text-sm">N</span>
                            </div>
                            <span className="text-base font-semibold text-[var(--foreground)]">
                                Nod
                            </span>
                        </Link>
                        {!isMobile && (
                            <button
                                onClick={toggleCollapsed}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--accent)] transition-colors"
                                aria-label="Collapse sidebar"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--foreground-muted)]">
                                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 px-2 overflow-y-auto">
                <div className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => isMobile && setIsOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg transition-all duration-150 min-h-[40px]",
                                    isCollapsed && !isMobile
                                        ? "justify-center px-2 py-2"
                                        : "px-3 py-2",
                                    isActive
                                        ? "bg-[var(--foreground)] text-[var(--background)]"
                                        : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
                                )}
                                title={isCollapsed && !isMobile ? item.label : undefined}
                            >
                                <HugeiconsIcon icon={item.icon} className="w-5 h-5 shrink-0" />
                                {(!isCollapsed || isMobile) && (
                                    <span className="text-sm font-medium truncate">{item.label}</span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Footer */}
            {(!isCollapsed || isMobile) && (
                <div className="p-3 border-t border-[var(--border)]">
                    <div className="text-xs text-[var(--foreground-subtle)]">
                        © 2026 Nod
                    </div>
                </div>
            )}
        </div>
    );

    // Mobile: Overlay sidebar
    if (isMobile) {
        return (
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/20 z-40 md:hidden"
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 h-full w-60 z-50 md:hidden shadow-xl"
                        >
                            {sidebarContent}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        );
    }

    // Desktop: Static sidebar
    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 64 : 240 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="hidden md:block h-screen shrink-0 sticky top-0 overflow-hidden"
        >
            {sidebarContent}
        </motion.aside>
    );
}
