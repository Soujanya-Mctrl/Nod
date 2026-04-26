# NOD — Blockchain Agreement Platform

![Nod Banner](https://img.shields.io/badge/NOD-Blockchain%20Agreements-blueviolet?style=for-the-badge&logo=ethereum)
![Status](https://img.shields.io/badge/Status-Development-orange?style=for-the-badge)

**NOD** is a state-of-the-art decentralized platform designed for secure, immutable, and transparent digital agreements. Built on the principle of "Trust but Verify," Nod leverages Ethereum smart contracts to ensure that every handshake, agreement, and contract is permanently etched into the blockchain.

---

## ✨ Key Features

- **🚀 Instant Deployment**: Deploy legally-binding (on-chain) agreements in seconds.
- **🔐 Immutable Security**: Once a "NOD" is signed, it cannot be altered or deleted.
- **🎨 Premium UI/UX**: A modern, sleek interface built with Next.js and Tailwind CSS.
- **🔗 Multi-Network Support**: Local testing, Testnets (Sepolia/Avalanche), and Mainnet ready.
- **🧾 Transparent History**: Full audit trail for every interaction.

---

## 🏗️ Project Structure

The project is organized as a monorepo for seamless integration between the blockchain logic and the user interface.

```text
nod/
├── 📂 contracts/        # 📜 Smart Contract Development (Hardhat)
│   ├── 📂 src/          # Solidity source files
│   ├── 📂 test/         # Unit & Integration tests
│   ├── 📂 scripts/      # Deployment & Maintenance scripts
│   └── 📄 hardhat.config.ts
├── 📂 frontend/         # 💻 Web Application (Next.js)
│   ├── 📂 app/          # App router, pages & layouts
│   ├── 📂 components/   # Reusable UI components (Shadcn UI)
│   ├── 📂 lib/          # Utilities, Web3 providers & hooks
│   └── 📄 next.config.ts
├── 📄 .env              # Environment variables
└── 📄 package.json      # Workspace configurations
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 15+](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **Web3 Library**: [Viem](https://viem.sh/) / [Wagmi](https://wagmi.sh/)

### Blockchain
- **Development Environment**: [Hardhat](https://hardhat.org/)
- **Language**: [Solidity 0.8.28](https://soliditylang.org/)
- **Core Library**: [OpenZeppelin](https://openzeppelin.com/contracts/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [MetaMask](https://metamask.io/) or any EIP-1193 wallet

### 1. Installation
Clone the repository and install dependencies from the root:
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory (use `.env.example` as a template):
```bash
cp .env.example .env
```

### 3. Smart Contract Development
```bash
# Compile contracts
npm run contracts:compile

# Run local Hardhat node
npm run contracts:node

# Run tests
npm run contracts:test
```

### 4. Frontend Development
```bash
# Start the Next.js dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 📜 Commands Reference

| Action | Command |
| :--- | :--- |
| **Install** | `npm install` |
| **Dev Server** | `npm run dev` |
| **Compile Contracts** | `npm run contracts:compile` |
| **Deploy Contracts** | `npm run contracts:deploy` |
| **Run Tests** | `npm run contracts:test` |

---
