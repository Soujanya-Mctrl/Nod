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
}

const INITIAL_NODS: Nod[] = [
    {
        id: "1",
        text: "Submit project draft by Feb 10",
        hash: "0x29f6792326ce411b21a653df109aeeabf84e03b1706501179f437fe7788e059da",
        transactionHash: "0x8a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1",
        creator: "alex",
        counterparty: "jordan",
        status: "awaiting",
        createdAt: "Feb 3, 2026",
        timestamp: "14:32:18",
        createdByMe: true,
    },
    {
        id: "2",
        text: "Pay 50% deposit for the design work",
        hash: "0x0442324d8e384ad9046fd14278a458611651a810ef1a6721e661491429178aa37",
        transactionHash: "0xc1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0g1",
        creator: "jordan",
        counterparty: "alex",
        status: "nodded",
        createdAt: "Feb 1, 2026",
        timestamp: "09:15:42",
        createdByMe: false,
    },
    {
        id: "3",
        text: "Share API documentation by end of week",
        hash: "0x2288d014720d40c16caaa56f7063bac6393c221268a9f9575dd812a7500f05175",
        transactionHash: "0xe5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j",
        creator: "alex",
        counterparty: "taylor",
        status: "awaiting",
        createdAt: "Jan 28, 2026",
        timestamp: "18:47:03",
        createdByMe: true,
    },
    {
        id: "5",
        text: "Setup staging environment for testing",
        hash: "0x4d8e324d8e384ad9046fd14278a458611651a810ef1a6721e661491429178f1b2",
        transactionHash: "0x9h8i7j6k5l4m3n2o1p0q9r8s7t6u5v4w3x2y1z0a9b8c7d6e5f4g3h2i1j0k9l",
        creator: "alex",
        counterparty: "casey",
        status: "nodded",
        createdAt: "Jan 20, 2026",
        timestamp: "16:08:29",
        createdByMe: true,
    },
    {
        id: "6",
        text: "Deliver final mockups and assets",
        hash: "0x2a3c324d8e384ad9046fd14278a458611651a810ef1a6721e661491429178g5h7",
        transactionHash: "0x3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q",
        creator: "riley",
        counterparty: "alex",
        status: "nodded",
        createdAt: "Jan 18, 2026",
        timestamp: "13:44:11",
        createdByMe: false,
    },
    {
        id: "7",
        text: "Review and sign the partnership agreement",
        hash: "0x1b4d324d8e384ad9046fd14278a458611651a810ef1a6721e661491429178h8i9",
        transactionHash: "0x7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v",
        creator: "alex",
        counterparty: "morgan",
        status: "awaiting",
        createdAt: "Jan 15, 2026",
        timestamp: "20:31:55",
        createdByMe: true,
    },
    {
        id: "8",
        text: "Initial consultation notes",
        hash: "0x5e6f324d8e384ad9046fd14278a458611651a810ef1a6721e661491429178j2k3",
        transactionHash: "0x1w2x3y4z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a",
        creator: "quinn",
        counterparty: "alex",
        status: "nodded",
        createdAt: "Jan 10, 2026",
        timestamp: "07:59:37",
        createdByMe: false,
    },
    {
        id: "9",
        text: "Conflict resolution meeting",
        hash: "0x8f2a324d8e384ad9046fd14278a458611651a810ef1a6721e661491429178k9l4",
        transactionHash: "0x5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0a1b2c3d4e5f",
        creator: "alex",
        counterparty: "sam",
        status: "declined",
        createdAt: "Jan 05, 2026",
        timestamp: "11:15:20",
        createdByMe: true,
    }
];

const STORAGE_KEY = 'nod_app_data_v3';

export function useNods(): UseNodsReturn {
    const [nods, setNods] = useState<Nod[]>([]);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [knownProfiles, setKnownProfiles] = useState<Record<string, Profile>>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();

    const MOCK_PROFILES: Record<string, Profile> = {
        'alex': { id: 'p1', walletAddress: '0x1234567890abcdef1234567890abcdef12345678', username: 'alex', displayName: 'Alex Morgan', createdAt: '2026-01-01' },
        'jordan': { id: 'p2', walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12', username: 'jordan', displayName: 'Jordan Lee', createdAt: '2026-01-02' },
        'taylor': { id: 'p3', walletAddress: '0x7890abcdef1234567890abcdef1234567890abcd', username: 'taylor', displayName: 'Taylor Swift', createdAt: '2026-01-03' },
        'casey': { id: 'p4', walletAddress: '0xabcde1234567890abcdef1234567890abcdef123', username: 'casey', displayName: 'Casey Neistat', createdAt: '2026-01-04' },
    };

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        let currentNods: Nod[] = INITIAL_NODS;
        let currentKnownProfiles = MOCK_PROFILES;

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                currentNods = parsed.nods || INITIAL_NODS;
                if (parsed.knownProfiles) {
                    currentKnownProfiles = { ...MOCK_PROFILES, ...parsed.knownProfiles };
                }
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
                const suffix = address.slice(-4);
                profile = {
                    id: crypto.randomUUID(),
                    walletAddress: address,
                    username: `nod_${suffix}`,
                    displayName: "",
                    createdAt: new Date().toLocaleDateString()
                };

                const updatedKnown = { ...knownProfiles, [profile.username]: profile };
                setKnownProfiles(updatedKnown);

                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    nods,
                    knownProfiles: updatedKnown
                }));
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
        getNodById
    };
}
