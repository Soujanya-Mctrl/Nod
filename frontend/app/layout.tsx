import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppLayout } from "@/components/layout/app-layout";
import { Web3Provider } from "@/components/providers/web3-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nod — Friendly Agreements",
  description: "Record friendly agreements backed by blockchain. Express, acknowledge, and verify shared understanding.",
  keywords: ["agreements", "blockchain", "nod", "friendly", "acknowledge"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Web3Provider>
          <AppLayout>{children}</AppLayout>
        </Web3Provider>
      </body>
    </html>
  );
}
