"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { requestAccess, getAddress, isConnected } from "@stellar/freighter-api";
import { useToast } from "@/components/ui/toast";

interface StellarWalletContextType {
    isConnected: boolean;
    isConnecting: boolean;
    isInitializing: boolean;
    address: string | null;
    connect: () => Promise<string | null>;
    disconnect: () => void;
}

const StellarWalletContext = createContext<StellarWalletContextType>({
    isConnected: false,
    isConnecting: false,
    isInitializing: true,
    address: null,
    connect: async () => null,
    disconnect: () => {},
});

export const StellarProvider = ({ children }: { children: React.ReactNode }) => {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const toast = useToast();

    // Load active account and listen to focus events for user switching
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const connectedRes = await isConnected();
                if (connectedRes.isConnected) {
                    const addressRes = await getAddress();
                    if (addressRes.address && !addressRes.error) {
                        setAddress(addressRes.address);
                        localStorage.setItem("stellar_connected_address", addressRes.address);
                    } else {
                        const storedAddress = localStorage.getItem("stellar_connected_address");
                        if (storedAddress) {
                            setAddress(storedAddress);
                        }
                    }
                } else {
                    setAddress(null);
                    localStorage.removeItem("stellar_connected_address");
                }
            } catch (e) {
                console.log("Failed to check connection or fetch address:", e);
            } finally {
                setIsInitializing(false);
            }
        };

        checkConnection();

        // Listen for window focus to detect Freighter account switches automatically
        window.addEventListener("focus", checkConnection);
        return () => {
            window.removeEventListener("focus", checkConnection);
        };
    }, []);

    const connect = async () => {
        setIsConnecting(true);
        try {
            const connectedRes = await isConnected();
            if (!connectedRes.isConnected) {
                toast.error("Freighter wallet extension not found. Please install it.");
                setIsConnecting(false);
                return null;
            }

            const accessRes = await requestAccess();
            if (accessRes.address && !accessRes.error) {
                setAddress(accessRes.address);
                localStorage.setItem("stellar_connected_address", accessRes.address);
                setIsConnecting(false);
                return accessRes.address;
            } else if (accessRes.error) {
                toast.error(`Freighter Connection Error: ${accessRes.error}`);
            }
        } catch (error) {
            console.error("Failed to connect to Freighter wallet:", error);
        }
        setIsConnecting(false);
        return null;
    };

    const disconnect = () => {
        setAddress(null);
        localStorage.removeItem("stellar_connected_address");
    };

    return (
        <StellarWalletContext.Provider
            value={{
                isConnected: !!address,
                isConnecting,
                isInitializing,
                address,
                connect,
                disconnect,
            }}
        >
            {children}
        </StellarWalletContext.Provider>
    );
};

export const useStellarWallet = () => useContext(StellarWalletContext);
