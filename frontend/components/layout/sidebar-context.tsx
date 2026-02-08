"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface SidebarContextType {
    isOpen: boolean;
    isCollapsed: boolean;
    setIsOpen: (open: boolean) => void;
    setIsCollapsed: (collapsed: boolean) => void;
    toggleOpen: () => void;
    toggleCollapsed: () => void;
    isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);
    const toggleCollapsed = useCallback(() => setIsCollapsed((prev) => !prev), []);

    return (
        <SidebarContext.Provider
            value={{
                isOpen,
                isCollapsed,
                setIsOpen,
                setIsCollapsed,
                toggleOpen,
                toggleCollapsed,
                isMobile,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
