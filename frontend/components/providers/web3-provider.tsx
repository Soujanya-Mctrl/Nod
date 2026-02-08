"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
    getDefaultConfig({
        // Your dApps chains
        chains: [mainnet, sepolia],
        transports: {
            // RPC URL for each chain
            [mainnet.id]: http(),
            [sepolia.id]: http(),
        },

        // Required API Keys
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "PLACEHOLDER",

        // Required App Info
        appName: "Nod",

        // Optional App Info
        appDescription: "Friendly Agreements backed by Blockchain",
        appUrl: "https://nod.app",
        appIcon: "https://family.co/logo.png",
    }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ConnectKitProvider
                    customTheme={{
                        "--ck-font-family": "var(--font-geist-sans)",
                        "--ck-border-radius": "12px",
                    }}
                    mode="auto"
                >
                    {children}
                </ConnectKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};
