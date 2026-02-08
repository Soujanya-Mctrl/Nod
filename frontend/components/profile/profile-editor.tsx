"use client";

import React, { useState, useEffect } from "react";
import { User03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNods } from "@/lib/store";
import { cn, truncateHash } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ProfileEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileEditor({ isOpen, onClose }: ProfileEditorProps) {
    const { userProfile, updateProfile, checkUsernameAvailability, disconnectWallet } = useNods();
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (userProfile && isOpen) {
            setDisplayName(userProfile.displayName || "");
            setUsername(userProfile.username);
            setUsernameError(null);
        }
    }, [userProfile, isOpen]);

    const handleUsernameChange = (value: string) => {
        const lower = value.toLowerCase();
        // Allow alphanumeric and underscore only
        if (!/^[a-z0-9_]*$/.test(lower)) return;

        setUsername(lower);

        if (lower.length < 3) {
            setUsernameError("Username must be at least 3 characters");
            return;
        }

        if (lower.length > 20) {
            setUsernameError("Username must be max 20 characters");
            return;
        }

        if (!checkUsernameAvailability(lower)) {
            setUsernameError("Username is already taken");
            return;
        }

        setUsernameError(null);
    };

    const handleSave = async () => {
        if (!userProfile) return;
        if (usernameError) return;
        if (username.length < 3) {
            setUsernameError("Username must be at least 3 characters");
            return;
        }

        setIsSaving(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 600));

        try {
            updateProfile({
                ...userProfile,
                displayName: displayName.trim(),
                username: username
            });
            onClose();
        } catch (e) {
            setUsernameError("Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-[var(--background)] border-[var(--border)]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HugeiconsIcon icon={User03Icon} className="w-5 h-5 text-emerald-600" />
                        Edit Profile
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                            Wallet Address
                        </label>
                        <div className="p-3 rounded-lg bg-[var(--accent)] font-mono text-xs text-[var(--foreground-muted)] break-all border border-transparent">
                            {userProfile?.walletAddress ? truncateHash(userProfile.walletAddress, 10, 8) : ""}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                            Username
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]">@</span>
                            <Input
                                value={username}
                                readOnly
                                tabIndex={-1}
                                className={cn(
                                    "pl-7 bg-[var(--accent)] text-[var(--foreground-muted)] cursor-not-allowed border-transparent focus-visible:ring-0",
                                )}
                                placeholder="username"
                            />
                        </div>
                        <p className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Usernames are permanent and linked to your wallet.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                            Display Name
                        </label>
                        <Input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. Alex Morgan"
                            autoFocus
                            className="bg-[var(--background)] text-[var(--foreground)]"
                        />
                        <p className="text-[10px] text-[var(--foreground-muted)]">
                            This name will be visible to others but does not affect your cryptographic identity.
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-2">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            disconnectWallet();
                            onClose();
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
                    >
                        Disconnect Wallet
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose} className="text-[var(--foreground-muted)]">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !!usernameError}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white w-24"
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
