"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckmarkCircle01Icon,
    CancelCircleIcon,
    SecurityCheckIcon,
    ArrowRight01Icon,
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

interface ZKVerificationPanelProps {
    nod: Nod;
}

export function ZKVerificationPanel({ nod }: ZKVerificationPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [proof, setProof] = useState<ZKProof | null>(null);
    const [verificationResult, setVerificationResult] = useState<ZKVerificationResult | null>(null);

    const canGenerate = nod.status !== "draft" && nod.status !== "declined";

    const handleGenerateProof = async () => {
        setIsGenerating(true);
        setVerificationResult(null);

        // Simulate brief computation delay
        await new Promise((resolve) => setTimeout(resolve, 1200));

        try {
            const counterparty = nod.counterparties?.[0] || nod.counterparty || "";
            const timestamp = nod.timestamp
                ? parseInt(nod.timestamp)
                : Math.floor(Date.now() / 1000);

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
        } catch (error) {
            console.error("Failed to generate ZK proof:", error);
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
        } catch (error) {
            console.error("Failed to verify ZK proof:", error);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleReset = () => {
        setProof(null);
        setVerificationResult(null);
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
                            Zero-Knowledge Proof Verification
                        </span>
                        <span className="text-[10px] text-violet-600 font-medium">
                            Phase 2 Preview — Noir Circuit Demo
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
                                    <strong className="text-violet-600">What is this?</strong>{" "}
                                    Zero-Knowledge proofs let you prove you know the agreement details
                                    (text, signatures, timestamps) <em>without revealing them</em> to
                                    the verifier. The Noir circuit ({'"'}nod_circuits{'"'}) verifies
                                    Ed25519 signatures, commitment hashes, and expiry constraints
                                    entirely inside a cryptographic proof.
                                </p>
                            </div>

                            {/* Step 1: Generate Proof */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                                        1
                                    </div>
                                    <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                                        Generate Proof
                                    </h4>
                                </div>

                                {!proof ? (
                                    <Button
                                        onClick={handleGenerateProof}
                                        disabled={isGenerating || !canGenerate}
                                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold"
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
                                                Computing witness & generating proof...
                                            </div>
                                        ) : (
                                            <>
                                                <HugeiconsIcon
                                                    icon={SecurityCheckIcon}
                                                    className="w-4 h-4 mr-2"
                                                />
                                                Generate ZK Proof
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-2.5"
                                    >
                                        <div className="p-3 rounded-lg bg-[var(--accent)] border border-[var(--border)] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                                    ✓ Proof Generated
                                                </span>
                                                <span className="text-[10px] text-[var(--foreground-muted)]">
                                                    {proof.circuitName}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                        Proof (π)
                                                    </span>
                                                    <code className="text-[11px] font-mono text-[var(--foreground)] break-all select-all">
                                                        0x{proof.proofHex}
                                                    </code>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                        Commitment
                                                    </span>
                                                    <code className="text-[11px] font-mono text-[var(--foreground)] break-all select-all">
                                                        0x{proof.publicInputs.commitment}
                                                    </code>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 pt-1">
                                                    <div>
                                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                            Initiator Key
                                                        </span>
                                                        <code className="text-[10px] font-mono text-[var(--foreground)] break-all">
                                                            {proof.publicInputs.initiatorPubKey.slice(0, 8)}...
                                                            {proof.publicInputs.initiatorPubKey.slice(-4)}
                                                        </code>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                            Counterparty Key
                                                        </span>
                                                        <code className="text-[10px] font-mono text-[var(--foreground)] break-all">
                                                            {proof.publicInputs.counterpartyPubKey.slice(0, 8)}...
                                                            {proof.publicInputs.counterpartyPubKey.slice(-4)}
                                                        </code>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                            Status Check
                                                        </span>
                                                        <span className={`text-[10px] font-semibold ${proof.publicInputs.statusNodded ? "text-emerald-600" : "text-rose-500"}`}>
                                                            {proof.publicInputs.statusNodded ? "Active ✓" : "Inactive ✗"}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-[var(--foreground-muted)] font-medium block">
                                                            Expiry
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-[var(--foreground)]">
                                                            {proof.publicInputs.expiresAt === 0
                                                                ? "No expiry"
                                                                : new Date(proof.publicInputs.expiresAt * 1000).toLocaleDateString()}
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
                                            Verify Proof
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
                                                    Verifying proof constraints...
                                                </div>
                                            ) : (
                                                <>
                                                    <HugeiconsIcon
                                                        icon={CheckmarkCircle01Icon}
                                                        className="w-4 h-4 mr-2"
                                                    />
                                                    Verify ZK Proof
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
                                                            ? "Proof Valid — All constraints satisfied"
                                                            : "Proof Invalid — One or more checks failed"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Individual checks */}
                                            <div className="space-y-1.5">
                                                {verificationResult.checks.map((check, idx) => (
                                                    <motion.div
                                                        key={check.name}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.08 }}
                                                        className="flex items-start gap-2 p-2 rounded-lg bg-[var(--accent)]/50"
                                                    >
                                                        <HugeiconsIcon
                                                            icon={
                                                                check.passed
                                                                    ? CheckmarkCircle01Icon
                                                                    : CancelCircleIcon
                                                            }
                                                            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                                                check.passed
                                                                    ? "text-emerald-500"
                                                                    : "text-rose-500"
                                                            }`}
                                                        />
                                                        <div>
                                                            <span className="text-[10px] font-bold text-[var(--foreground)] block">
                                                                {check.name}
                                                            </span>
                                                            <span className="text-[10px] text-[var(--foreground-muted)] font-mono">
                                                                {check.detail}
                                                            </span>
                                                        </div>
                                                    </motion.div>
                                                ))}
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
                                        Reset & Try Again
                                    </Button>
                                </div>
                            )}

                            {/* Noir circuit reference */}
                            <div className="border-t border-[var(--border)]/30 pt-3">
                                <p className="text-[10px] text-[var(--foreground-muted)] leading-relaxed">
                                    <strong>Circuit:</strong>{" "}
                                    <code className="text-violet-600">circuits/src/main.nr</code> — Noir v0.30+
                                    {" · "}
                                    <strong>Private inputs:</strong> sig1, sig2, text, timestamp, nonce
                                    {" · "}
                                    <strong>Public inputs:</strong> commitment, initiator_pub_key,
                                    counterparty_pub_key, status_nodded, expires_at
                                </p>
                            </div>
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
