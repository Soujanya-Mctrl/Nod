import { useState, useEffect, useMemo } from 'react';
import { useStellarWallet } from '@/components/providers/stellar-provider';
import { queryAgreementOnChain, queryUserAgreementsOnChain, fetchIPFSContent } from './soroban-query';


export type NodStatus = 'draft' | 'awaiting' | 'nodded' | 'declined' | 'completed' | 'expired' | 'delivered' | 'disputed';

export interface Nod {
    id: string;
    text: string;
    hash: string;
    cid?: string;
    sig1?: string;
    sig2?: string;
    transactionHash: string;
    creator: string;
    counterparty: string;
    counterparties: string[];
    status: NodStatus;
    createdAt: string;
    timestamp: string;
    createdByMe: boolean;
    expiresAt?: number;
    nonce?: number;
    nonceHex?: string;
    commitmentHex?: string;
    tokenAddress?: string;
    cautionAmount?: number;
    completedParties?: string[];
    agreementIdHex?: string;
    signedCounterparties?: string[];
    arbitrator?: string;
    deliveredAt?: number;
    ipfsEncrypted?: boolean;
    encryptionMessage?: string;
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
    updateNod: (id: string, updatedFields: Partial<Nod>) => void;
    updateProfile: (newProfile: Profile) => void;
    checkUsernameAvailability: (username: string) => boolean;
    connectWallet: () => void;
    disconnectWallet: () => void;
    resolveProfile: (identifier: string) => Profile | undefined;
    getNodById: (id: string) => Nod | undefined;
    isParticipant: (nod: Nod) => boolean;
}

const INITIAL_NODS: Nod[] = [];

const STORAGE_KEY = 'nod_app_data_v8';

export function useNods(): UseNodsReturn {
    const [nods, setNods] = useState<Nod[]>([]);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [knownProfiles, setKnownProfiles] = useState<Record<string, Profile>>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const { address, isConnected, connect, disconnect } = useStellarWallet();

    useEffect(() => {
        // Clear old storage keys to ensure fresh data
        const oldKeys = ['nod_app_data_v1', 'nod_app_data_v2', 'nod_app_data_v3', 'nod_app_data_v4', 'nod_app_data_v5', 'nod_app_data_v6', 'nod_app_data_v7'];
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
            let profile = Object.values(knownProfiles).find(p => p.walletAddress === address);

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

    useEffect(() => {
        if (!isLoaded || !isConnected || !address) return;

        let active = true;

        const loadOnChainAgreements = async () => {
            try {
                // 1. Get all agreement IDs for the user from the contract
                const agreementIds = await queryUserAgreementsOnChain(address);
                if (agreementIds.length === 0 || !active) return;

                const fetchedNods: Nod[] = [];

                // 2. Fetch details for each agreement
                for (const idHex of agreementIds) {
                    if (!active) break;
                    const onChain = await queryAgreementOnChain(idHex);
                    if (onChain) {
                        const existing = nods.find(n => n.agreementIdHex === idHex || n.hash === idHex);
                        
                        let text = existing?.text || "";
                        let ipfsEncrypted = existing?.ipfsEncrypted;
                        let encryptionMessage = existing?.encryptionMessage;

                        if (!text && onChain.cid) {
                            try {
                                const ipfsContent = await fetchIPFSContent(onChain.cid);
                                if (ipfsContent) {
                                    if (ipfsContent.encryptedPayload) {
                                        ipfsEncrypted = true;
                                        text = ""; // Need decryption
                                    } else {
                                        text = typeof ipfsContent.text === "string" ? ipfsContent.text : "";
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to fetch IPFS content for on-chain agreement:", e);
                            }
                        }

                        const statusLabel = onChain.statusLabel.toLowerCase() as NodStatus;

                        fetchedNods.push({
                            id: existing?.id || idHex.slice(0, 8),
                            text,
                            hash: onChain.commitment || idHex,
                            cid: onChain.cid || undefined,
                            transactionHash: existing?.transactionHash || "",
                            creator: onChain.initiator,
                            counterparty: onChain.counterparties[0] || "",
                            counterparties: onChain.counterparties,
                            status: statusLabel,
                            createdAt: new Date(onChain.createdAt * 1000).toLocaleDateString(),
                            timestamp: new Date(onChain.createdAt * 1000).toLocaleTimeString(),
                            createdByMe: onChain.initiator.toLowerCase() === address.toLowerCase(),
                            expiresAt: onChain.expiresAt,
                            tokenAddress: onChain.tokenAddress || undefined,
                            cautionAmount: Number(onChain.cautionAmount),
                            completedParties: onChain.completedParties,
                            arbitrator: onChain.arbitrator || undefined,
                            agreementIdHex: idHex,
                            ipfsEncrypted,
                            encryptionMessage
                        });
                    }
                }

                if (active) {
                    setNods(prevNods => {
                        const merged = [...prevNods];
                        fetchedNods.forEach(fn => {
                            const idx = merged.findIndex(mn => mn.agreementIdHex === fn.agreementIdHex || mn.hash === fn.hash);
                            if (idx >= 0) {
                                merged[idx] = {
                                    ...merged[idx],
                                    ...fn,
                                    text: fn.text || merged[idx].text,
                                };
                            } else {
                                merged.push(fn);
                            }
                        });
                        saveToStorage(merged);
                        return merged;
                    });
                }
            } catch (err) {
                console.error("Failed to load user agreements from ledger:", err);
            }
        };

        loadOnChainAgreements();

        return () => {
            active = false;
        };
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

    const updateNod = (id: string, updatedFields: Partial<Nod>) => {
        const updatedNods = nods.map(nod =>
            nod.id === id ? { ...nod, ...updatedFields } : nod
        );
        setNods(updatedNods);
        saveToStorage(updatedNods, knownProfiles);
    };

    const updateNodStatus = (id: string, newStatus: NodStatus) => {
        updateNod(id, { status: newStatus });
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

    const mappedNods = useMemo(() => {
        return nods.map(nod => {
            const resolvedCounterparty = nod.counterparty || (nod.counterparties && nod.counterparties[0]) || "";
            if (!userProfile) {
                return {
                    ...nod,
                    counterparty: resolvedCounterparty
                };
            }
            const userWallet = userProfile.walletAddress;
            const userUser = userProfile.username.toLowerCase();
            const isCreator = nod.creator === userWallet || nod.creator.toLowerCase() === userUser;
            return {
                ...nod,
                counterparty: resolvedCounterparty,
                createdByMe: isCreator
            };
        });
    }, [nods, userProfile]);

    const getNodById = (id: string) => mappedNods.find(n => n.id === id);

    const isParticipant = (nod: Nod): boolean => {
        if (!userProfile) return false;

        const userUsername = userProfile.username.toLowerCase();
        const userWallet = userProfile.walletAddress;

        if (nod.creator === userWallet || nod.creator.toLowerCase() === userUsername) {
            return true;
        }

        if (nod.counterparties) {
            for (const cp of nod.counterparties) {
                if (cp === userWallet || cp.toLowerCase() === userUsername) {
                    return true;
                }
            }
        }

        if (nod.arbitrator) {
            if (nod.arbitrator === userWallet || nod.arbitrator.toLowerCase() === userUsername) {
                return true;
            }
        }

        return false;
    };

    return {
        nods: mappedNods,
        userProfile,
        isLoaded,
        addNod,
        updateNodStatus,
        updateNod,
        updateProfile,
        checkUsernameAvailability,
        connectWallet: connect,
        disconnectWallet,
        resolveProfile,
        getNodById,
        isParticipant
    };
}
