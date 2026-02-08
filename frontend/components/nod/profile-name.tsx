"use client";

import React from "react";
import { useNods } from "@/lib/store";

export function ProfileName({ username }: { username: string }) {
    const { resolveProfile } = useNods();
    const profile = resolveProfile(username);

    if (profile && profile.displayName) {
        return (
            <span className="text-[var(--foreground)] font-medium">
                {profile.displayName} <span className="text-[var(--foreground-muted)] font-normal">(@{username})</span>
            </span>
        );
    }

    return <span className="text-[var(--foreground)] font-medium">@{username}</span>;
}
