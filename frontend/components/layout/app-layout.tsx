"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { SidebarProvider } from "./sidebar-context";
import { MobileHeader } from "./mobile-header";

// Lazy load the sidebar
const Sidebar = dynamic(() => import("./sidebar").then(mod => ({ default: mod.Sidebar })), {
    ssr: false,
    loading: () => (
        <div className="hidden md:block w-60 h-screen bg-[var(--sidebar-bg)] border-r border-[var(--border)] shrink-0" />
    ),
});

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-[var(--background)]">
                <Suspense fallback={<div className="hidden md:block w-60 h-screen bg-[var(--sidebar-bg)] shrink-0" />}>
                    <Sidebar />
                </Suspense>
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <MobileHeader />
                    <main className="flex-1 overflow-y-auto p-6 lg:p-8">
                        <div className="max-w-7xl mx-auto">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
