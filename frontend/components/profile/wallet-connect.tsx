"use client";

import React, { useState } from "react";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { User03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useNods } from "@/lib/store";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { NodIdentityCard } from "@/components/profile/nod-identity-card";

export function WalletConnect() {
    const { isConnected } = useAccount();
    const { userProfile } = useNods();
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    return (
        <div className="flex items-center gap-3">
            <ConnectKitButton.Custom>
                {({ isConnected, isConnecting, show, address, ensName, chain }) => {
                    if (isConnected && address && userProfile) {
                        return (
                            <>
                                <NodIdentityCard
                                    id={address}
                                    label={userProfile.displayName || userProfile.username}
                                    onUserClick={() => setIsEditorOpen(true)}
                                    onCardClick={show}
                                />
                                <ProfileEditor
                                    isOpen={isEditorOpen}
                                    onClose={() => setIsEditorOpen(false)}
                                />
                            </>
                        );
                    }

                    return (
                        <Button
                            onClick={show}
                            disabled={isConnecting}
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl px-6 py-6 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-none font-semibold tracking-wide"
                        >
                            {isConnecting ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Connecting...
                                </div>
                            ) : (
                                "Connect Wallet"
                            )}
                        </Button>
                    );
                }}
            </ConnectKitButton.Custom>
        </div>
    );
}
