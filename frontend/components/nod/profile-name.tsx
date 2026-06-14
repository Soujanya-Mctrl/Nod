"use client";

import React from "react";
import { useNods } from "@/lib/store";

export function ProfileName({ username }: { username: string }) {
    const { resolveProfile } = useNods();
    const profile = resolveProfile(username);

    const isAddress = username.startsWith('G') && username.length === 56;
    const truncatedAddress = isAddress 
        ? `${username.slice(0, 6)}...${username.slice(-4)}`
        : username;

    if (profile && profile.displayName) {
        const isProfileAddress = profile.username.startsWith('G') && profile.username.length === 56;
        const profileUserLabel = isProfileAddress
            ? `${profile.username.slice(0, 6)}...${profile.username.slice(-4)}`
            : `@${profile.username}`;

        return (
            <span className="text-[var(--foreground)] font-medium">
                {profile.displayName} <span className="text-[var(--foreground-muted)] font-normal">({profileUserLabel})</span>
            </span>
        );
    }

    const finalLabel = isAddress ? truncatedAddress : `@${username}`;
    return <span className="text-[var(--foreground)] font-medium">{finalLabel}</span>;
}
