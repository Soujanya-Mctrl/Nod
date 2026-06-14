"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckmarkCircle01Icon, Alert01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 4000);
    }, [removeToast]);

    const success = useCallback((msg: string) => toast(msg, "success"), [toast]);
    const error = useCallback((msg: string) => toast(msg, "error"), [toast]);
    const info = useCallback((msg: string) => toast(msg, "info"), [toast]);

    return (
        <ToastContext.Provider value={{ toast, success, error, info }}>
            {children}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md ${
                                t.type === "success"
                                    ? "bg-emerald-50/90 border-emerald-200 text-emerald-800"
                                    : t.type === "error"
                                    ? "bg-rose-50/90 border-rose-200 text-rose-800"
                                    : "bg-slate-50/90 border-slate-200 text-slate-800"
                            }`}
                        >
                            <HugeiconsIcon
                                icon={
                                    t.type === "success"
                                        ? CheckmarkCircle01Icon
                                        : t.type === "error"
                                        ? Alert01Icon
                                        : InformationCircleIcon
                                }
                                className={`w-5 h-5 shrink-0 mt-0.5 ${
                                    t.type === "success"
                                        ? "text-emerald-600"
                                        : t.type === "error"
                                        ? "text-rose-600"
                                        : "text-slate-600"
                                }`}
                            />
                            <div className="flex-1 text-sm font-medium leading-relaxed">{t.message}</div>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="text-current opacity-60 hover:opacity-100 transition-opacity font-semibold ml-2 text-xs"
                            >
                                ✕
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};
