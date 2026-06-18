"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    X, 
    Share2, 
    Lock, 
    QrCode, 
    Copy, 
    Check, 
    Loader2, 
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Nod } from "@/lib/store";
import { buildNodSharePackage, encryptPayloadWithRandomKey, registerGatedShare } from "@/lib/nod-share";
import { useToast } from "@/components/ui/toast";

interface ShareModalProps {
    nod: Nod;
    isOpen: boolean;
    onClose: () => void;
}

export function ShareModal({ nod, isOpen, onClose }: ShareModalProps) {
    const toast = useToast();
    const [recipientAddress, setRecipientAddress] = useState("");
    const [step, setStep] = useState<"form" | "generating" | "ready">("form");
    const [statusMessage, setStatusMessage] = useState("");
    const [shareId, setShareId] = useState("");
    const [copied, setCopied] = useState(false);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!recipientAddress || !recipientAddress.startsWith("G") || recipientAddress.length !== 56) {
            toast.error("Please enter a valid Stellar recipient wallet address (starts with G, 56 characters).");
            return;
        }

        setStep("generating");

        try {
            setStatusMessage("Encrypting agreement details...");
            
            // Build plaintext package
            const sharePackage = await buildNodSharePackage(nod);
            
            // Encrypt payload client-side with random symmetric key
            const { ciphertextHex, ivHex, keyHex } = await encryptPayloadWithRandomKey(JSON.stringify(sharePackage));

            setStatusMessage("Registering Gated Access with key relay...");
            const generatedShareId = await registerGatedShare({
                nodId: nod.id,
                allowedAddress: recipientAddress,
                encryptedPayload: ciphertextHex,
                iv: ivHex,
                key: keyHex
            });

            setShareId(generatedShareId);
            setStep("ready");
            toast.success("Private encrypted link generated successfully!");
        } catch (err: any) {
            console.error("Failed to generate share:", err);
            toast.error(err.message || "Failed to generate share link.");
            setStep("form");
        }
    };

    const getShareLink = () => {
        if (typeof window === "undefined") return "";
        return `${window.location.origin}/verify?shareId=${shareId}`;
    };

    const handleCopy = async () => {
        const link = getShareLink();
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Link copied to clipboard!");
    };

    const qrCodeUrl = shareId 
        ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getShareLink())}`
        : "";

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        className="relative z-10 w-full max-w-lg bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden p-6 text-[var(--foreground)]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[var(--border)]/40 pb-4 mb-5">
                            <div className="flex items-center gap-2">
                                <Lock className="w-5 h-5 text-violet-500" />
                                <h3 className="text-base font-bold">Secure Encrypted Share</h3>
                            </div>
                            <button 
                                onClick={onClose}
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1 rounded-lg hover:bg-[var(--accent)]"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* STEP 1: Form Input */}
                        {step === "form" && (
                            <form onSubmit={handleGenerate} className="space-y-5">
                                <div className="space-y-3">
                                    <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-left flex items-start gap-3">
                                        <Lock className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs font-bold block mb-1">Wallet-Gated Access</span>
                                            <span className="text-[11px] text-[var(--foreground-muted)] leading-relaxed block">
                                                This agreement is encrypted client-side using an AES-GCM symmetric key. 
                                                Only the recipient wallet address specified below can request the key and decrypt/read the terms on the Verify page.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase tracking-wider block">
                                            Authorized Recipient Wallet Address
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={recipientAddress}
                                            onChange={(e) => setRecipientAddress(e.target.value.trim())}
                                            placeholder="Stellar public key e.g. G..."
                                            className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--accent)]/40 focus:ring-1 focus:ring-violet-500 focus:outline-none placeholder:text-[var(--foreground-muted)]/50"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full text-white font-semibold py-2.5 rounded-xl transition-colors mt-2 bg-violet-600 hover:bg-violet-700 cursor-pointer"
                                >
                                    Create Private Encrypted Link
                                </Button>
                            </form>
                        )}

                        {/* STEP 2: Loading State */}
                        {step === "generating" && (
                            <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                                <p className="text-xs text-[var(--foreground-muted)] font-medium">
                                    {statusMessage}
                                </p>
                            </div>
                        )}

                        {/* STEP 3: Ready State */}
                        {step === "ready" && (
                            <div className="space-y-5 text-center">
                                {/* Title / State banner */}
                                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl inline-flex items-center gap-2 mx-auto">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs font-bold text-emerald-600">
                                        Private Encrypted Link Ready
                                    </span>
                                </div>

                                {/* QR Code */}
                                {qrCodeUrl && (
                                    <div className="bg-white p-3 rounded-xl inline-block border border-[var(--border)]/40 shadow-sm mx-auto">
                                        <img 
                                            src={qrCodeUrl} 
                                            alt="Share QR Code" 
                                            className="w-44 h-44 object-contain" 
                                        />
                                    </div>
                                )}

                                {/* Link display */}
                                <div className="space-y-1.5 text-left">
                                    <label className="text-[10px] font-bold text-[var(--foreground-muted)] uppercase tracking-wider block">
                                        Secure Decryption URL
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-[10px] font-mono p-2 rounded-lg bg-[var(--accent)] border border-[var(--border)] overflow-x-auto whitespace-nowrap block">
                                            {getShareLink()}
                                        </code>
                                        <Button
                                            onClick={handleCopy}
                                            variant="outline"
                                            size="sm"
                                            className="border-[var(--border)] text-[var(--foreground)] shrink-0 h-8 w-8 p-0"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-[var(--foreground-muted)] text-center mt-1">
                                        Only the authorized wallet can open this link and decrypt the details.
                                    </p>
                                </div>

                                {/* Close Button */}
                                <Button
                                    onClick={onClose}
                                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] border border-[var(--border)] py-2 rounded-xl mt-4"
                                >
                                    Done
                                </Button>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
