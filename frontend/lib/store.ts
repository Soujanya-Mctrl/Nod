import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';

export type NodStatus = 'awaiting' | 'nodded' | 'declined';

export interface Nod {
    id: string;
    text: string;
    hash: string;
    transactionHash: string;
    creator: string;
    counterparty: string;
    status: NodStatus;
    createdAt: string;
    timestamp: string;
    createdByMe: boolean;
}

export interface Profile {
    id: string;
    walletAddress: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    createdAt: string;
}

interface UseNodsReturn {
    nods: Nod[];
    userProfile: Profile | null;
    isLoaded: boolean;
    addNod: (newNod: Nod) => void;
    updateNodStatus: (id: string, newStatus: NodStatus) => void;
    updateProfile: (newProfile: Profile) => void;
    checkUsernameAvailability: (username: string) => boolean;
    connectWallet: () => void;
    disconnectWallet: () => void;
    resolveProfile: (identifier: string) => Profile | undefined;
    getNodById: (id: string) => Nod | undefined;
    isParticipant: (nod: Nod) => boolean;
}

const INITIAL_NODS: Nod[] = [];

const STORAGE_KEY = 'nod_app_data_v6';

export function useNods(): UseNodsReturn {
    const [nods, setNods] = useState<Nod[]>([]);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [knownProfiles, setKnownProfiles] = useState<Record<string, Profile>>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();

    useEffect(() => {
        // Clear old storage keys to ensure fresh data
        const oldKeys = ['nod_app_data_v1', 'nod_app_data_v2', 'nod_app_data_v3', 'nod_app_data_v4', 'nod_app_data_v5'];
        oldKeys.forEach(key => localStorage.removeItem(key));

        const stored = localStorage.getItem(STORAGE_KEY);
        let currentNods: Nod[] = [];
        let currentKnownProfiles: Record<string, Profile> = {};

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                currentNods = parsed.nods || [];
                currentKnownProfiles = parsed.knownProfiles || {};
            } catch (e) {
                console.error("Failed to parse storage", e);
            }
        }

        setNods(currentNods);
        setKnownProfiles(currentKnownProfiles);
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded) return;

        if (isConnected && address) {
            let profile = Object.values(knownProfiles).find(p => p.walletAddress.toLowerCase() === address.toLowerCase());

            if (!profile) {
                // Generate a default profile for new users
                const suffix = address.slice(-4);
                profile = {
                    id: crypto.randomUUID(),
                    walletAddress: address,
                    username: `user_${suffix}`,
                    displayName: `User ${suffix}`,
                    createdAt: new Date().toLocaleDateString()
                };

                const updatedKnown = { ...knownProfiles, [profile.username]: profile };
                setKnownProfiles(updatedKnown);

                saveToStorage(nods, updatedKnown);
            }
            setUserProfile(profile);
        } else {
            setUserProfile(null);
        }
    }, [isConnected, address, isLoaded]);

    const saveToStorage = (updatedNods: Nod[], updatedKnownProfiles: Record<string, Profile> = knownProfiles) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            nods: updatedNods,
            knownProfiles: updatedKnownProfiles
        }));
    };

    const addNod = (newNod: Nod) => {
        const updatedNods = [newNod, ...nods];
        setNods(updatedNods);
        saveToStorage(updatedNods);
    };

    const updateNodStatus = (id: string, newStatus: NodStatus) => {
        const updatedNods = nods.map(nod =>
            nod.id === id ? { ...nod, status: newStatus } : nod
        );
        setNods(updatedNods);
        saveToStorage(updatedNods);
    };

    const disconnectWallet = () => {
        disconnect();
    };

    const updateProfile = (newProfile: Profile) => {
        let updatedKnown = { ...knownProfiles };

        if (userProfile && userProfile.username !== newProfile.username) {
            const oldUsername = userProfile.username;
            if (knownProfiles[newProfile.username] && knownProfiles[newProfile.username].id !== userProfile.id) {
                throw new Error("Username is already taken");
            }
            delete updatedKnown[oldUsername];
        }

        setUserProfile(newProfile);
        updatedKnown[newProfile.username] = newProfile;

        setKnownProfiles(updatedKnown);
        saveToStorage(nods, updatedKnown);
    };

    const checkUsernameAvailability = (username: string): boolean => {
        if (!knownProfiles[username]) return true;
        if (userProfile && userProfile.username === username) return true;
        return false;
    };

    const resolveProfile = (identifier: string): Profile | undefined => {
        if (!identifier) return undefined;
        if (knownProfiles[identifier]) return knownProfiles[identifier];
        return Object.values(knownProfiles).find(p => p.walletAddress.toLowerCase() === identifier.toLowerCase());
    };

    const getNodById = (id: string) => nods.find(n => n.id === id);

    const isParticipant = (nod: Nod): boolean => {
        if (!userProfile) return false;

        // Check by username
        if (nod.creator === userProfile.username || nod.counterparty === userProfile.username) {
            return true;
        }

        // Check by wallet address (case-insensitive)
        const userWallet = userProfile.walletAddress.toLowerCase();
        return nod.creator.toLowerCase() === userWallet ||
            nod.counterparty.toLowerCase() === userWallet;
    };

    return {
        nods,
        userProfile,
        isLoaded,
        addNod,
        updateNodStatus,
        updateProfile,
        checkUsernameAvailability,
        connectWallet: () => { },
        disconnectWallet,
        resolveProfile,
        getNodById,
        isParticipant
    };
}
