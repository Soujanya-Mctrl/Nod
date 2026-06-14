"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
    PencilEdit01Icon,
    MailSend01Icon,
    Calendar03Icon,
    User03Icon,
    Alert01Icon,
    CheckmarkCircle01Icon,
    Coins01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStellarWallet } from "@/components/providers/stellar-provider";
import { buildSealAgreementTx, signTxWithFreighter, submitStellarTx } from "@/lib/stellar";
import { uploadToIPFS } from "@/lib/ipfs";
import { useNods, type Nod } from "@/lib/store";
import { generateHash, truncateHash } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type TemplateType = "freelancer" | "friends" | "roommates" | "vendor";

const TEMPLATES = [
    {
        id: "freelancer",
        title: "Freelancer",
        subtitle: "Freelancer / Client",
        placeholder: "Deliver logo set by Friday 6 PM. 3 concepts, 2 revision rounds.",
        caution: 50,
        allowCaution: true,
        hasDeadline: true,
        isMulti: false,
        desc: "Equal stakes (e.g. 50 XLM) committed by both parties. Missed deadline transfers entire pool to Client."
    },
    {
        id: "friends",
        title: "Friends",
        subtitle: "Social Repayment",
        placeholder: "I'll pay you back ₹800 from the concert tickets by next Sunday.",
        caution: 0,
        allowCaution: false,
        hasDeadline: true,
        isMulti: false,
        desc: "Zero caution deposit. Relies on social trust, with cryptographic expiry records as proof."
    },
    {
        id: "roommates",
        title: "Roommates",
        subtitle: "Shared House Rules",
        placeholder: "No guests after midnight on weekdays. Agreed by all roommates.",
        caution: 0,
        allowCaution: false,
        hasDeadline: false,
        isMulti: true,
        desc: "Zero caution deposit. No deadline needed—ongoing rules co-signed by multiple roommates."
    },
    {
        id: "vendor",
        title: "Vendor Deal",
        subtitle: "Business Purchase",
        placeholder: "Deliver 200 units of custom merchandise by March 15. ₹5000 upfront deposit confirmed.",
        caution: 200,
        allowCaution: true,
        hasDeadline: true,
        isMulti: false,
        desc: "High-stakes commercial deal (e.g. 200 XLM). Contract automatically resolves and returns or penalizes."
    }
] as const;

export default function CreateNodPage() {
    const router = useRouter();
    const { addNod, resolveProfile } = useNods();
    const toast = useToast();
    const { address, isConnected, connect } = useStellarWallet();

    const [activeTemplate, setActiveTemplate] = useState<TemplateType>("freelancer");
    const [agreement, setAgreement] = useState("");
    const [counterparties, setCounterparties] = useState<string[]>([""]);
    const [cautionAmount, setCautionAmount] = useState<number>(50);
    const [deadline, setDeadline] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [hash, setHash] = useState("");
    const [arbitrator, setArbitrator] = useState("");

    // Set defaults when template changes
    useEffect(() => {
        const config = TEMPLATES.find((t) => t.id === activeTemplate);
        if (!config) return;

        setAgreement("");
        setCautionAmount(config.caution);
        setCounterparties(config.isMulti ? ["", ""] : [""]);
        setArbitrator("");

        if (config.hasDeadline) {
            // Default deadline: next week
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            nextWeek.setHours(18, 0, 0, 0);
            
            // Format to YYYY-MM-DDThh:mm
            const tzoffset = nextWeek.getTimezoneOffset() * 60000; //offset in milliseconds
            const localISOTime = (new Date(nextWeek.getTime() - tzoffset)).toISOString().slice(0, 16);
            setDeadline(localISOTime);
        } else {
            setDeadline("");
        }
    }, [activeTemplate]);

    const handleAddCounterparty = () => {
        setCounterparties([...counterparties, ""]);
    };

    const handleRemoveCounterparty = (index: number) => {
        if (counterparties.length <= 1) return;
        setCounterparties(counterparties.filter((_, i) => i !== index));
    };

    const handleCounterpartyChange = (index: number, val: string) => {
        const updated = [...counterparties];
        updated[index] = val;
        setCounterparties(updated);
    };

    const isValid = agreement.trim().length > 0 && 
        counterparties.every(cp => cp.trim().length > 0) &&
        (TEMPLATES.find(t => t.id === activeTemplate)?.hasDeadline ? deadline !== "" : true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        if (!isConnected || !address) {
            toast.error("Please connect your Freighter wallet first");
            await connect();
            return;
        }

        // Resolve usernames to Stellar addresses
        const resolvedCounterparties: string[] = [];
        for (const cp of counterparties) {
            const trimmed = cp.trim();
            const resolved = resolveProfile(trimmed);
            if (resolved) {
                resolvedCounterparties.push(resolved.walletAddress);
            } else {
                resolvedCounterparties.push(trimmed);
            }
        }

        let resolvedArbitrator = "";
        if (arbitrator.trim() && cautionAmount > 0) {
            const trimmedArb = arbitrator.trim();
            const resolvedArb = resolveProfile(trimmedArb);
            resolvedArbitrator = resolvedArb ? resolvedArb.walletAddress : trimmedArb;
        }

        // Validate resolved counterparties are valid Stellar addresses
        const stellarAddrRegex = /^G[A-D][A-Z2-7]{54}$/;
        for (const addr of resolvedCounterparties) {
            if (!stellarAddrRegex.test(addr)) {
                toast.error(`"${addr}" is not a valid Stellar wallet address or registered username.`);
                return;
            }
        }

        if (resolvedArbitrator && !stellarAddrRegex.test(resolvedArbitrator)) {
            toast.error(`Arbitrator "${resolvedArbitrator}" is not a valid Stellar wallet address or registered username.`);
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Upload metadata to IPFS
            const agreementData = {
                text: agreement.trim(),
                creator: address,
                counterparties: resolvedCounterparties,
                timestamp: new Date().toISOString(),
                template: activeTemplate,
                cautionAmount: cautionAmount,
                expiresAt: deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0,
                arbitrator: resolvedArbitrator || null
            };
            const ipfsResult = await uploadToIPFS(agreementData);
            const cid = ipfsResult.IpfsHash;

            const createdAt = Math.floor(Date.now() / 1000);
            const expiresAt = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0;
            
            // Generate a random 32-byte agreement ID (as hex)
            const agreementIdHex = Array.from({ length: 32 }, () => 
                Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
            ).join('');

            // Native XLM token contract address on Testnet
            const nativeTokenAddress = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

            // 2. Build Stellar Transaction XDR
            const unsignedXdr = await buildSealAgreementTx({
                cid,
                initiator: address,
                counterparties: resolvedCounterparties,
                createdAt,
                expiresAt,
                agreementIdHex,
                tokenAddress: cautionAmount > 0 ? nativeTokenAddress : undefined,
                cautionAmount: cautionAmount > 0 ? Math.floor(cautionAmount * 10000000) : 0, // 7 decimals
                arbitrator: resolvedArbitrator || undefined
            });

            // 3. Sign with Freighter (returns signed XDR)
            const signedXdr = await signTxWithFreighter(unsignedXdr);

            // 3.5 Submit to Stellar Network
            toast.info("Submitting sealed agreement transaction to Stellar Soroban...");
            const txHash = await submitStellarTx(signedXdr);

            // 4. Send to Thin Backend Relay
            const nodId = Math.random().toString(36).substr(2, 9);
            await fetch("/api/nods/draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: nodId,
                    cid,
                    initiator: address,
                    counterparties: resolvedCounterparties,
                    text: agreement.trim(),
                    sig1: signedXdr,
                    expiresAt,
                    agreementIdHex,
                    tokenAddress: cautionAmount > 0 ? nativeTokenAddress : undefined,
                    cautionAmount: cautionAmount > 0 ? Math.floor(cautionAmount * 10000000) : 0,
                    arbitrator: resolvedArbitrator || undefined
                }),
            });

            // 5. Update local store
            const finalHash = await generateHash(`${agreement.trim()}|${address}|${createdAt}`);
            const newNod: Nod = {
                id: nodId,
                text: agreement.trim(),
                hash: finalHash,
                cid,
                sig1: signedXdr,
                transactionHash: txHash,
                creator: address,
                counterparty: resolvedCounterparties[0] || "",
                counterparties: resolvedCounterparties,
                status: "awaiting",
                createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                createdByMe: true,
                expiresAt,
                tokenAddress: cautionAmount > 0 ? nativeTokenAddress : undefined,
                cautionAmount: cautionAmount > 0 ? Math.floor(cautionAmount * 10000000) : 0,
                completedParties: [],
                arbitrator: resolvedArbitrator || undefined,
                agreementIdHex
            };
            addNod(newNod);

            setHash(finalHash);
            setShowSuccess(true);
            setIsSubmitting(false);

            setTimeout(() => {
                router.push("/");
            }, 2500);

        } catch (error: any) {
            console.error("Failed to seal nod:", error);
            toast.error(`Failed to seal nod: ${error.message || error}`);
            setIsSubmitting(false);
        }
    };

    if (showSuccess) {
        return (
            <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4 max-w-lg"
                >
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--foreground)]">Nod Draft Sealed!</h2>
                    <p className="text-[var(--foreground-muted)] text-sm max-w-md mx-auto">
                        Your agreement terms have been uploaded to IPFS and signed. Your co-signers will see it on their dashboard when they connect their Freighter wallet.
                    </p>
                    <div className="p-4 bg-[var(--accent)] rounded-lg mt-6 border border-[var(--border)]">
                        <p className="text-xs text-[var(--foreground-muted)] mb-1">Sealed Content Hash</p>
                        <code className="text-sm font-mono text-[var(--foreground)] break-all">{hash}</code>
                    </div>
                </motion.div>
            </div>
        );
    }

    const config = TEMPLATES.find((t) => t.id === activeTemplate)!;

    return (
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-xl"
            >
                <Card className="border-[var(--border-strong)]/40 shadow-xl backdrop-blur-md">
                    <CardHeader className="text-center pb-2">
                        <CardTitle className="text-2xl font-bold tracking-tight">Create a Nod</CardTitle>
                        <CardDescription>
                            Select a scenario template to configure your agreement
                        </CardDescription>
                    </CardHeader>

                    {/* Template Pills */}
                    <div className="px-6 py-2">
                        <div className="grid grid-cols-4 gap-2 bg-[var(--accent)] p-1 rounded-xl border border-[var(--border)]">
                            {TEMPLATES.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setActiveTemplate(t.id)}
                                    className={`py-2 px-1 text-xs md:text-sm font-medium rounded-lg transition-all ${
                                        activeTemplate === t.id
                                            ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm border border-[var(--border-strong)]/20"
                                            : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                    }`}
                                >
                                    {t.title}
                                </button>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-5 pt-4">
                            {/* Description helper banner */}
                            <div className="p-3.5 rounded-xl bg-[var(--accent)] border border-[var(--border)] text-xs text-[var(--foreground-muted)] flex items-start gap-2.5">
                                <span className="text-lg">💡</span>
                                <div>
                                    <span className="font-semibold text-[var(--foreground)]">{config.subtitle}: </span>
                                    {config.desc}
                                </div>
                            </div>

                            {/* Agreement Text */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                    <HugeiconsIcon icon={PencilEdit01Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                    Agreement terms
                                </label>
                                <Textarea
                                    placeholder={config.placeholder}
                                    value={agreement}
                                    onChange={(e) => setAgreement(e.target.value)}
                                    className="min-h-[100px] resize-none"
                                />
                            </div>

                            {/* Counterparty / Counterparties */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                    <HugeiconsIcon icon={User03Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                    {config.isMulti ? "Co-signers (Stellar Addresses or Usernames)" : "Who is your counterparty?"}
                                </label>

                                {config.isMulti ? (
                                    <div className="space-y-2.5">
                                        {counterparties.map((cp, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <Input
                                                    placeholder={`Roommate #${idx + 1} Address or Username`}
                                                    value={cp}
                                                    onChange={(e) => handleCounterpartyChange(idx, e.target.value)}
                                                />
                                                {counterparties.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleRemoveCounterparty(idx)}
                                                        className="h-10 w-10 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-100"
                                                    >
                                                        ✕
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAddCounterparty}
                                            className="w-full text-xs font-semibold py-1.5"
                                        >
                                            + Add Roommate
                                        </Button>
                                    </div>
                                ) : (
                                    <Input
                                        placeholder="Stellar G... Address or username"
                                        value={counterparties[0] || ""}
                                        onChange={(e) => handleCounterpartyChange(0, e.target.value)}
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Caution Money */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                        <HugeiconsIcon icon={Coins01Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        Caution money (XLM)
                                    </label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={cautionAmount}
                                        onChange={(e) => setCautionAmount(Number(e.target.value))}
                                        disabled={!config.allowCaution}
                                        className="disabled:opacity-50"
                                    />
                                </div>

                                {/* Deadline */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                        <HugeiconsIcon icon={Calendar03Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        Deadline date & time
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                        disabled={!config.hasDeadline}
                                        className="disabled:opacity-50 text-xs"
                                    />
                                </div>
                            </div>

                            {/* Arbitrator Input */}
                            {cautionAmount > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                        <HugeiconsIcon icon={User03Icon} className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        Arbitrator / Mediator (Optional)
                                    </label>
                                    <Input
                                        placeholder="Stellar G... Address or username of trusted arbitrator"
                                        value={arbitrator}
                                        onChange={(e) => setArbitrator(e.target.value)}
                                    />
                                    <p className="text-[10px] text-[var(--foreground-muted)] pl-1 leading-relaxed">
                                        This third party will be empowered to resolve escrow disputes if terms are contested.
                                    </p>
                                </div>
                            )}

                            {/* Caution warning block */}
                            {cautionAmount > 0 && (
                                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                    <HugeiconsIcon icon={Alert01Icon} className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-amber-600">Escrow Security Agreement</p>
                                        <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
                                            Creating this nod locks <strong>{cautionAmount} XLM</strong> of caution money from your wallet. Co-signers must also deposit <strong>{cautionAmount} XLM</strong> when accepting.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>

                        <CardFooter>
                            <Button
                                type="submit"
                                className="w-full cursor-pointer bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 font-semibold"
                                disabled={!isValid || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full animate-spin" />
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
