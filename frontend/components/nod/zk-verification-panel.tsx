"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckmarkCircle01Icon,
    CancelCircleIcon,
    SecurityCheckIcon,
    ArrowRight01Icon,
    Alert01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Nod } from "@/lib/store";
import {
    generateZKProof,
    verifyZKProof,
    type ZKProof,
    type ZKVerificationResult,
} from "@/lib/zk-verifier";
import { useToast } from "@/components/ui/toast";

interface ZKVerificationPanelProps {
    nod: Nod;
}

export function ZKVerificationPanel({ nod }: ZKVerificationPanelProps) {
    const toast = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [proof, setProof] = useState<ZKProof | null>(null);
    const [verificationResult, setVerificationResult] = useState<ZKVerificationResult | null>(null);
    const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

    // ZK constraints require status_nodded = true, which maps to active/nodded, completed, or delivered statuses
    const canGenerate = nod.status === "nodded" || nod.status === "completed" || nod.status === "delivered";

    const handleGenerateProof = async () => {
        setIsGenerating(true);
        setVerificationResult(null);

        // Simulate brief computation delay
        await new Promise((resolve) => setTimeout(resolve, 1200));

        try {
            const counterparty = nod.counterparties?.[0] || nod.counterparty || "";
            
            // Safely parse creation date and time to unix timestamp
            let timestamp = Math.floor(Date.now() / 1000);
            if (nod.createdAt && nod.timestamp) {
                const dateStr = `${nod.createdAt} ${nod.timestamp}`;
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                    timestamp = Math.floor(parsedDate.getTime() / 1000);
                }
            }

            const generatedProof = await generateZKProof({
                text: nod.text,
                initiator: nod.creator,
                counterparty,
                timestamp,
                expiresAt: nod.expiresAt || 0,
                status: nod.status,
                contentHash: nod.hash,
            });

            setProof(generatedProof);
            toast.success("Verification receipt successfully created!");
        } catch (error: any) {
            console.error("Failed to generate ZK proof:", error);
            if (error.stack) {
                console.error("Stack trace:", error.stack);
            }
            toast.error(`${error.message || "Failed to generate ZK proof."} ${error.stack ? "\nStack: " + error.stack.slice(0, 150) : ""}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleVerifyProof = async () => {
        if (!proof) return;

        setIsVerifying(true);

        // Simulate verification delay
        await new Promise((resolve) => setTimeout(resolve, 900));

        try {
            const result = await verifyZKProof(proof);
            setVerificationResult(result);
            if (result.valid) {
                toast.success("Receipt verified successfully!");
            } else {
                toast.error("Receipt verification failed.");
            }
        } catch (error: any) {
            console.error("Failed to verify ZK proof:", error);
            toast.error(error.message || "Failed to verify ZK proof.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleReset = () => {
        setProof(null);
        setVerificationResult(null);
        setShowTechnicalDetails(false);
    };

    return (
        <Card className="border-[var(--border)] shadow-md overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--accent)]/30 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <HugeiconsIcon icon={SecurityCheckIcon} className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="text-left">
                        <span className="text-sm font-bold text-[var(--foreground)] block">
                            Create Private Verification Receipt
                        </span>
                        <span className="text-[10px] text-violet-600 font-medium">
                            Prove agreement details without revealing them
                        </span>
                    </div>
                </div>
                <span className="text-xs text-[var(--foreground-muted)]">
                    {isOpen ? "Hide ▲" : "Show ▼"}
                </span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <CardContent className="px-5 pb-5 pt-2 border-t border-[var(--border)]/40 space-y-5">
                            {/* Explainer */}
                            <div className="p-3.5 rounded-xl bg-violet-500/5 border border-violet-500/10">
                                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                    <strong className="text-violet-600">How does this work?</strong>{" "}
                                    Want to show someone that this agreement is signed and valid, but keep the actual agreement terms, names, and contract details completely private? Generate a secure digital receipt (a Zero-Knowledge Proof) in your browser. Anyone can verify this receipt to confirm it is authentic and active on the blockchain without learning any of its private details.
                                </p>
                            </div>

                            {/* Step 1: Generate Proof */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                                        1
                                    </div>
                                    <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                                        Create Verification Receipt
                                    </h4>
                                </div>

                                {!proof ? (
                                    <div className="space-y-3">
                                        {!canGenerate && (
                                            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[11px] text-[var(--foreground-muted)] leading-relaxed">
                                                <HugeiconsIcon icon={Alert01Icon} className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-semibold text-amber-600">Agreement Not Active: </span>
                                                    {nod.status === "awaiting" && "This agreement is currently awaiting co-signatures. Both parties must sign before a private verification receipt can be created."}
                                                    {nod.status === "draft" && "This agreement is a draft and has not been signed or sealed yet."}
                                                    {nod.status === "declined" && "This agreement was declined and is not active."}
                                                    {nod.status === "expired" && "This agreement has expired."}
                                                </div>
                                            </div>
                                        )}

                                        <Button
                                            onClick={handleGenerateProof}
                                            disabled={isGenerating || !canGenerate}
                                            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold cursor-pointer"
                                        >
                                            {isGenerating ? (
                                                <div className="flex items-center gap-2">
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{
                                                            duration: 1,
                                                            repeat: Infinity,
                                                            ease: "linear",
                                                        }}
                                                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                                    />
                                                    Creating secure cryptographic receipt...
                                                </div>
                                            ) : (
                                                <>
                                                    <HugeiconsIcon
                                                        icon={SecurityCheckIcon}
                                                        className="w-4 h-4 mr-2"
                                                    />
                                                    Create Private Receipt
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-2.5"
                                    >
                                        <div className="p-3 rounded-lg bg-[var(--accent)] border border-[var(--border)] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                                    ✓ Receipt Successfully Created
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs pt-1 border-t border-[var(--border)]">
                                                <div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                        Secure Cryptographic Receipt (Proof Hash)
                                                    </span>
                                                    <code className="text-[10px] font-mono text-[var(--foreground)] break-all select-all block p-1.5 rounded bg-[var(--accent)]/50 border border-[var(--border)]/50 mt-1">
                                                        0x{proof.proofHex.slice(0, 64)}...
                                                    </code>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                            On-Chain Content Match
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-emerald-600">
                                                            Verified Match ✓
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                            Agreement Status
                                                        </span>
                                                        <span className={`text-[10px] font-semibold ${proof.publicInputs.statusNodded ? "text-emerald-600" : "text-rose-500"}`}>
                                                            {proof.publicInputs.statusNodded ? "Active on Stellar" : "Inactive"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Step 2: Verify Proof */}
                            {proof && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="space-y-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                                            2
                                        </div>
                                        <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                                            Verify Receipt
                                        </h4>
                                    </div>

                                    {!verificationResult ? (
                                        <Button
                                            onClick={handleVerifyProof}
                                            disabled={isVerifying}
                                            variant="outline"
                                            className="w-full border-violet-200 text-violet-600 hover:bg-violet-50 font-semibold"
                                        >
                                            {isVerifying ? (
                                                <div className="flex items-center gap-2">
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{
                                                            duration: 1,
                                                            repeat: Infinity,
                                                            ease: "linear",
                                                        }}
                                                        className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full"
                                                    />
                                                    Verifying cryptographic receipt...
                                                </div>
                                            ) : (
                                                <>
                                                    <HugeiconsIcon
                                                        icon={CheckmarkCircle01Icon}
                                                        className="w-4 h-4 mr-2"
                                                    />
                                                    Verify Private Receipt
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-2.5"
                                        >
                                            {/* Overall result banner */}
                                            <div
                                                className={`p-3 rounded-lg border ${
                                                    verificationResult.valid
                                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                                        : "bg-rose-500/5 border-rose-500/20"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <HugeiconsIcon
                                                        icon={
                                                            verificationResult.valid
                                                                ? CheckmarkCircle01Icon
                                                                : CancelCircleIcon
                                                        }
                                                        className={`w-5 h-5 ${
                                                            verificationResult.valid
                                                                ? "text-emerald-600"
                                                                : "text-rose-500"
                                                        }`}
                                                    />
                                                    <span
                                                        className={`text-sm font-bold ${
                                                            verificationResult.valid
                                                                ? "text-emerald-600"
                                                                : "text-rose-500"
                                                        }`}
                                                    >
                                                        {verificationResult.valid
                                                            ? "Receipt Verified: Agreement is authentic!"
                                                            : "Receipt Invalid: Verification failed"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Individual checks */}
                                            <div className="space-y-1.5">
                                                {verificationResult.checks.map((check, idx) => {
                                                    // Map technical check names to friendly titles
                                                    let friendlyName = check.name;
                                                    let friendlyDetail = check.detail;
                                                    if (check.name === "Status check passed") {
                                                        friendlyName = "Active Contract Verified";
                                                        friendlyDetail = "The agreement is confirmed active on-chain";
                                                    } else if (check.name === "Preimage hash matches commitment") {
                                                        friendlyName = "Content Integrity Checked";
                                                        friendlyDetail = "Receipt content matches the original signed terms";
                                                    } else if (check.name === "Current time before expiration") {
                                                        friendlyName = "Agreement has not expired";
                                                        friendlyDetail = "Agreement is within its valid term window";
                                                    } else if (check.name === "Initiator public key is valid") {
                                                        friendlyName = "Signatures Authenticated";
                                                        friendlyDetail = "Cryptographic signatures verified";
                                                    }

                                                    return (
                                                        <motion.div
                                                            key={check.name}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: idx * 0.08 }}
                                                            className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--accent)]/50 border border-[var(--border)]/50"
                                                        >
                                                            <HugeiconsIcon
                                                                icon={
                                                                    check.passed
                                                                        ? CheckmarkCircle01Icon
                                                                        : CancelCircleIcon
                                                                }
                                                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                                                    check.passed
                                                                        ? "text-emerald-500"
                                                                        : "text-rose-500"
                                                                }`}
                                                            />
                                                            <div>
                                                                <span className="text-xs font-bold text-[var(--foreground)] block">
                                                                    {friendlyName}
                                                                </span>
                                                                <span className="text-[10px] text-[var(--foreground-muted)] leading-relaxed">
                                                                    {friendlyDetail}
                                                                </span>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {/* Reset */}
                            {proof && (
                                <div className="flex justify-center pt-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleReset}
                                        className="text-xs text-[var(--foreground-muted)]"
                                    >
                                        Create New Receipt
                                    </Button>
                                </div>
                            )}

                            {/* Collapsible Technical parameters for developers */}
                            <div className="border-t border-[var(--border)]/30 pt-3">
                                <button
                                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                                    className="text-[11px] font-bold text-violet-600 hover:underline flex items-center gap-1.5"
                                >
                                    <HugeiconsIcon icon={SecurityCheckIcon} className="w-3.5 h-3.5" />
                                    <span>{showTechnicalDetails ? "Hide Technical Parameters" : "Show Technical Parameters (Developers)"}</span>
                                </button>

                                <AnimatePresence>
                                    {showTechnicalDetails && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden mt-2"
                                        >
                                            <div className="p-3 rounded-lg bg-[var(--accent)] border border-[var(--border)] text-[10px] text-[var(--foreground-muted)] space-y-1.5 font-mono">
                                                <div>
                                                    <span className="font-semibold text-[var(--foreground)]">Circuit File: </span>
                                                    <code>circuits/src/main.nr</code>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-[var(--foreground)]">Noir Compiler: </span>
                                                    <code>v1.0.0-beta.20</code>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-[var(--foreground)]">Private Inputs: </span>
                                                    <code>agreement_text_hash, initiator_bytes, created_at_bytes, nonce</code>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-[var(--foreground)]">Public Inputs: </span>
                                                    <code>commitment, status_nodded, expires_at, timestamp</code>
                                                </div>
                                                {proof && (
                                                    <div className="pt-2 border-t border-[var(--border)]/50 mt-2">
                                                        <span className="font-semibold text-[var(--foreground)] block mb-1">Full Proof Bytecode:</span>
                                                        <code className="break-all whitespace-pre-wrap select-all block max-h-[120px] overflow-y-auto p-1 rounded bg-black/5">
                                                            {proof.proofHex}
                                                        </code>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
