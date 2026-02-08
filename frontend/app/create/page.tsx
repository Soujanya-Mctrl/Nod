"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
    PencilEdit01Icon,
    MailSend01Icon,
    Calendar03Icon,
    User03Icon,
    Alert01Icon,
    FingerPrintIcon,
    CheckmarkCircle01Icon,
    Copy01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNods, type Nod } from "@/lib/store";
import { generateHash, truncateHash, cn } from "@/lib/utils";

export default function CreateNodPage() {
    const router = useRouter();
    const { addNod } = useNods();
    const [agreement, setAgreement] = useState("");
    const [counterparty, setCounterparty] = useState("");
    const [deadline, setDeadline] = useState("");
    const [hash, setHash] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const isValid = agreement.trim().length > 0 && counterparty.trim().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setIsSubmitting(true);

        // Simulate sealing process
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Canonical Bundle Hashing: Agreement + Creator + Timestamp
        // This ensures the hash is unique to this specific instance and context
        const timestamp = new Date().toISOString();
        const creator = "alex"; // Mock current user
        const canonicalString = `${agreement.trim()}|@${creator}|${timestamp}`;
        const finalHash = await generateHash(canonicalString);

        // Create new Nod object
        const txHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const newNod: Nod = {
            id: Math.random().toString(36).substr(2, 9), // Simple ID generation
            text: agreement.trim(),
            hash: finalHash,
            transactionHash: txHash,
            creator: "alex",
            counterparty: counterparty.replace('@', ''),
            status: "awaiting",
            createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            createdByMe: true
        };

        // Add to store
        addNod(newNod);

        setHash(finalHash);
        setShowSuccess(true);
        setIsSubmitting(false);

        // Redirect after a short delay to show success state
        setTimeout(() => {
            router.push("/");
        }, 2500);
    };

    if (showSuccess) {
        return (
            <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4"
                >
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--foreground)]">Nod Sealed!</h2>
                    <p className="text-[var(--foreground-muted)] max-w-md mx-auto">
                        Your agreement has been hashed and sent to @{counterparty}.
                    </p>
                    <div className="p-4 bg-[var(--accent)] rounded-lg mt-6 max-w-sm mx-auto border border-[var(--border)]">
                        <p className="text-xs text-[var(--foreground-muted)] mb-1">Sealed Hash</p>
                        <code className="text-sm font-mono text-[var(--foreground)] break-all">{truncateHash(hash)}</code>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-lg"
            >
                <Card>
                    <CardHeader className="text-center pb-2">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--foreground)] flex items-center justify-center mx-auto mb-4">
                            <HugeiconsIcon icon={PencilEdit01Icon} className="w-7 h-7 text-[var(--background)]" />
                        </div>
                        <CardTitle className="text-2xl">Create a Nod</CardTitle>
                        <CardDescription>
                            Express a friendly agreement with someone
                        </CardDescription>
                    </CardHeader>

                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-6">
                            {/* Agreement Text */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2 mb-1.5">
                                    <HugeiconsIcon icon={PencilEdit01Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                    What are you agreeing on?
                                </label>
                                <Textarea
                                    placeholder="e.g., Submit project draft by Feb 10"
                                    value={agreement}
                                    onChange={(e) => setAgreement(e.target.value)}
                                    className="min-h-[120px] resize-none"
                                />
                            </div>



                            {/* Counterparty */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2 mb-1.5">
                                    <HugeiconsIcon icon={User03Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                    Who are you making this nod with?
                                </label>
                                <Input
                                    placeholder="@username or email"
                                    value={counterparty}
                                    onChange={(e) => setCounterparty(e.target.value)}
                                />
                            </div>

                            {/* Deadline (Optional) */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2 mb-1.5">
                                    <HugeiconsIcon icon={Calendar03Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                    Optional deadline
                                </label>
                                <Input
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                />
                            </div>

                            {/* Helper Text */}
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--accent)] border border-[var(--border)]">
                                <HugeiconsIcon icon={Alert01Icon} className="w-5 h-5 text-[var(--foreground-muted)] shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-[var(--foreground)]">Immutable Seal</p>
                                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                        Once sealed, the text (and its hash) cannot be changed. This ensures the agreement remains trustworthy forever.
                                    </p>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={!isValid || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-5 h-5 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full"
                                    />
                                ) : (
                                    <>
                                        <HugeiconsIcon icon={MailSend01Icon} className="w-5 h-5 mr-2" />
                                        Seal & Send Nod
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </motion.div>
        </div>
    );
}
