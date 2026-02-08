"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User03Icon, CheckmarkCircle01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNods, type Profile } from "@/lib/store";

export function ProfileSetup() {
    const { userProfile, updateProfile } = useNods();
    const [isVisible, setIsVisible] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Show if profile exists but has no display name (meaning it's the auto-generated one)
        if (userProfile && !userProfile.displayName) {
            setUsername(userProfile.username);
            // Delay slightly to not jar the user on load
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [userProfile]);

    const handleSave = async () => {
        if (!userProfile) return;

        setIsSaving(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        updateProfile({
            ...userProfile,
            username: username.trim().toLowerCase(), // Enforce lowercase
            displayName: displayName.trim() || username // Fallback to username if empty
        });

        setIsSaving(false);
        setIsVisible(false);
    };

    const handleSkip = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-8"
            >
                <Card className="bg-gradient-to-br from-[var(--accent)] to-[var(--background)] border-emerald-100/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <HugeiconsIcon icon={User03Icon} className="w-24 h-24" />
                    </div>

                    <CardContent className="p-6 relative z-10">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                            <div className="flex-1 space-y-2">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                        <HugeiconsIcon icon={User03Icon} className="w-4 h-4" />
                                    </span>
                                    Set up your profile
                                </h2>
                                <p className="text-sm text-[var(--foreground-muted)] max-w-lg">
                                    Add a display name to make your agreements easier to recognize.
                                    Your username <code className="text-xs bg-black/5 px-1 rounded">{username}</code> will be used for identification.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-end">
                                <div className="w-full sm:w-64 space-y-1.5">
                                    <label className="text-xs font-medium text-[var(--foreground-muted)] ml-1">
                                        Display Name
                                    </label>
                                    <Input
                                        placeholder="e.g. Alex Morgan"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="bg-[var(--background)]"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={handleSkip}
                                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                    >
                                        Skip
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving || !displayName.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]"
                                    >
                                        {isSaving ? "Saving..." : "Save Profile"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </AnimatePresence>
    );
}
