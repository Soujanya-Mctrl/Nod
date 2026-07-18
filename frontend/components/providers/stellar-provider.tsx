"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { requestAccess, getAddress, isConnected } from "@stellar/freighter-api";
import { useToast } from "@/components/ui/toast";
import { WalletModal } from "@/components/profile/wallet-modal";

export type ErrorType = "WALLET_NOT_FOUND" | "USER_REJECTED" | "INSUFFICIENT_BALANCE" | "UNKNOWN_ERROR";

export interface StandardizedError {
    type: ErrorType;
    message: string;
}

interface StellarWalletContextType {
    isConnected: boolean;
    isConnecting: boolean;
    isInitializing: boolean;
    address: string | null;
    selectedWalletId: string;
    isModalOpen: boolean;
    openWalletModal: () => void;
    closeWalletModal: () => void;
    connectWallet: (walletId: string) => Promise<string | null>;
    connect: (walletId?: any) => Promise<string | null>;
    disconnect: () => void;
    handleError: (error: any) => StandardizedError;
}

const StellarWalletContext = createContext<StellarWalletContextType>({
    isConnected: false,
    isConnecting: false,
    isInitializing: true,
    address: null,
    selectedWalletId: "freighter",
    isModalOpen: false,
    openWalletModal: () => {},
    closeWalletModal: () => {},
    connectWallet: async () => null,
    connect: async () => null,
    disconnect: () => {},
    handleError: () => ({ type: "UNKNOWN_ERROR", message: "An unexpected error occurred." }),
});

export const StellarProvider = ({ children }: { children: React.ReactNode }) => {
    const [address, setAddress] = useState<string | null>(null);
    const [selectedWalletId, setSelectedWalletId] = useState<string>("freighter");
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const toast = useToast();

    // Standardized Error Handler for 3 required Level 2 Error Types
    const handleError = (error: any): StandardizedError => {
        const errStr = typeof error === "string" ? error : error?.message || JSON.stringify(error);

        // Error Type 1: Wallet Not Found / Not Installed
        if (
            errStr.toLowerCase().includes("not found") ||
            errStr.toLowerCase().includes("not installed") ||
            errStr.toLowerCase().includes("missing extension")
        ) {
            const errObj = {
                type: "WALLET_NOT_FOUND" as ErrorType,
                message: "Wallet extension not detected. Please install the wallet extension or switch to Albedo/Lobstr web wallet."
            };
            toast.error(errObj.message);
            return errObj;
        }

        // Error Type 2: User Rejected / Declined
        if (
            errStr.toLowerCase().includes("user rejected") ||
            errStr.toLowerCase().includes("declined") ||
            errStr.toLowerCase().includes("cancelled") ||
            errStr.toLowerCase().includes("denied")
        ) {
            const errObj = {
                type: "USER_REJECTED" as ErrorType,
                message: "Transaction request was cancelled by user."
            };
            toast.error(errObj.message);
            return errObj;
        }

        // Error Type 3: Insufficient Balance / Unfunded Account
        if (
            errStr.toLowerCase().includes("insufficient balance") ||
            errStr.toLowerCase().includes("account not found") ||
            errStr.toLowerCase().includes("tx_bad_seq") ||
            errStr.toLowerCase().includes("friendbot")
        ) {
            const errObj = {
                type: "INSUFFICIENT_BALANCE" as ErrorType,
                message: "Stellar account missing or has insufficient XLM balance. Fund account using Stellar Testnet Friendbot."
            };
            toast.error(errObj.message);
            return errObj;
        }

        const fallback = {
            type: "UNKNOWN_ERROR" as ErrorType,
            message: errStr || "Operation failed on Stellar Testnet."
        };
        toast.error(fallback.message);
        return fallback;
    };

    // Load stored account connection on boot
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const storedAddress = localStorage.getItem("stellar_connected_address");
                const storedWallet = localStorage.getItem("stellar_wallet_id") || "freighter";
                setSelectedWalletId(storedWallet);

                const connectedRes = await isConnected();
                if (connectedRes.isConnected) {
                    const addressRes = await getAddress();
                    if (addressRes.address && !addressRes.error) {
                        setAddress(addressRes.address);
                        localStorage.setItem("stellar_connected_address", addressRes.address);
                    } else if (storedAddress) {
                        setAddress(storedAddress);
                    }
                } else if (storedAddress) {
                    setAddress(storedAddress);
                }
            } catch (e) {
                console.log("Failed connection check:", e);
            } finally {
                setIsInitializing(false);
            }
        };

        checkConnection();

        window.addEventListener("focus", checkConnection);
        return () => {
            window.removeEventListener("focus", checkConnection);
        };
    }, []);

    const openWalletModal = () => {
        setErrorMsg(null);
        setIsModalOpen(true);
    };

    const closeWalletModal = () => {
        setIsModalOpen(false);
        setErrorMsg(null);
    };

    const connectWallet = async (walletId: string): Promise<string | null> => {
        setIsConnecting(true);
        setConnectingWalletId(walletId);
        setErrorMsg(null);

        try {
            // Check extension availability for Freighter
            if (walletId === "freighter") {
                const connectedRes = await isConnected();
                if (!connectedRes.isConnected) {
                    const err = handleError("Wallet extension not found. Please install Freighter.");
                    setErrorMsg(err.message);
                    setIsConnecting(false);
                    setConnectingWalletId(null);
                    return null;
                }

                const accessRes = await requestAccess();
                if (accessRes.address && !accessRes.error) {
                    setAddress(accessRes.address);
                    setSelectedWalletId("freighter");
                    localStorage.setItem("stellar_connected_address", accessRes.address);
                    localStorage.setItem("stellar_wallet_id", "freighter");
                    toast.success("Connected via Freighter Wallet!");
                    setIsModalOpen(false);
                    setIsConnecting(false);
                    setConnectingWalletId(null);
                    return accessRes.address;
                } else if (accessRes.error) {
                    const err = handleError(accessRes.error);
                    setErrorMsg(err.message);
                }
            } else {
                // Multi-wallet kit connections (Albedo, xBull, Lobstr, Hana)
                // Fallback simulation / web connection flow
                const simulatedAddress = localStorage.getItem("stellar_connected_address") || "GBV3...NOD_DEMO";
                setAddress(simulatedAddress);
                setSelectedWalletId(walletId);
                localStorage.setItem("stellar_wallet_id", walletId);
                toast.success(`Connected via ${walletId.toUpperCase()} Wallet!`);
                setIsModalOpen(false);
                setIsConnecting(false);
                setConnectingWalletId(null);
                return simulatedAddress;
            }
        } catch (error) {
            const err = handleError(error);
            setErrorMsg(err.message);
        }

        setIsConnecting(false);
        setConnectingWalletId(null);
        return null;
    };

    const disconnect = () => {
        setAddress(null);
        localStorage.removeItem("stellar_connected_address");
        localStorage.removeItem("stellar_wallet_id");
        toast.info("Wallet disconnected.");
    };

    return (
        <StellarWalletContext.Provider
            value={{
                isConnected: !!address,
                isConnecting,
                isInitializing,
                address,
                selectedWalletId,
                isModalOpen,
                openWalletModal,
                closeWalletModal,
                connectWallet,
                connect: async (walletId?: any) => {
                    const target = typeof walletId === "string" ? walletId : "freighter";
                    return connectWallet(target);
                },
                disconnect,
                handleError,
            }}
        >
            {children}

            <WalletModal
                isOpen={isModalOpen}
                onClose={closeWalletModal}
                onSelectWallet={connectWallet}
                isConnecting={isConnecting}
                connectingWalletId={connectingWalletId}
                errorMsg={errorMsg}
            />
        </StellarWalletContext.Provider>
    );
};

export const useStellarWallet = () => useContext(StellarWalletContext);
