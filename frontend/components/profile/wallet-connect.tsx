"use client";

import React, { useState } from "react";
import { User03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useNods } from "@/lib/store";
import { useStellarWallet } from "@/components/providers/stellar-provider";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { NodIdentityCard } from "@/components/profile/nod-identity-card";

export function WalletConnect() {
    const { isConnected, isConnecting, address, connect, disconnect } = useStellarWallet();
    const { userProfile } = useNods();
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    if (isConnected && address && userProfile) {
        return (
            <div className="flex items-center gap-3">
                <NodIdentityCard
                    id={address}
                    label={userProfile.displayName || userProfile.username}
                    onUserClick={() => setIsEditorOpen(true)}
                    onCardClick={disconnect}
                />
                <ProfileEditor
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <Button
                onClick={connect}
                disabled={isConnecting}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl px-6 py-6 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-none font-semibold tracking-wide cursor-pointer"
            >
                {isConnecting ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Connecting...
                    </div>
                ) : (
                    "Connect Freighter"
                )}
            </Button>
        </div>
    );
}
