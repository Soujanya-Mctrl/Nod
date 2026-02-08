"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckmarkCircle01Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HashVerificationModalProps {
    expectedHash: string;
    onVerified: () => void;
    nodId: string;
}

export function HashVerificationModal({ expectedHash, onVerified, nodId }: HashVerificationModalProps) {
    const [inputHash, setInputHash] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inputHash.trim()) {
            setError("Please enter a content hash");
            return;
        }

        setIsVerifying(true);
        setError(null);

        // Simulate verification delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const cleanInput = inputHash.trim();
        const cleanExpected = expectedHash.trim();

        if (cleanInput === cleanExpected) {
            // Store verified hash in session storage
            const verifiedHashes = JSON.parse(sessionStorage.getItem("verified_nod_hashes") || "{}");
            verifiedHashes[nodId] = true;
            sessionStorage.setItem("verified_nod_hashes", JSON.stringify(verifiedHashes));

            onVerified();
        } else {
            setError("Invalid content hash. Please check and try again.");
            setIsVerifying(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center min-h-[400px]"
        >
            <Card className="max-w-md w-full border-2">
                <CardHeader className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">🔒</span>
                    </div>
                    <CardTitle className="text-xl">Content Hash Required</CardTitle>
                    <CardDescription>
                        This agreement is private. Enter the sealed content hash to view details.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="hash-input" className="text-sm font-medium text-[var(--foreground)]">
                                Sealed Content Hash
                            </label>
                            <Input
                                id="hash-input"
                                type="text"
                                placeholder="0x..."
                                value={inputHash}
                                onChange={(e) => {
                                    setInputHash(e.target.value);
                                    setError(null);
                                }}
                                className={cn(
                                    "font-mono text-sm",
                                    error && "border-red-300 focus-visible:ring-red-500"
                                )}
                                disabled={isVerifying}
                            />

                            <AnimatePresence mode="wait">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex items-center gap-2 text-sm text-red-600"
                                    >
                                        <HugeiconsIcon icon={CancelCircleIcon} className="w-4 h-4" />
                                        <span>{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isVerifying || !inputHash.trim()}
                        >
                            {isVerifying ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="w-5 h-5 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full"
                                />
                            ) : (
                                <>
                                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 mr-2" />
                                    Verify & View
                                </>
                            )}
                        </Button>

                        <div className="pt-2 border-t border-[var(--border)]">
                            <p className="text-xs text-[var(--foreground-muted)] text-center">
                                💡 Tip: You can find the content hash in the registry table or from the agreement creator.
                            </p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </motion.div>
    );
}
