# Nod Smart Contracts

This directory contains the Solidity smart contracts for the Nod project.

## Structure
- `/contracts`: Solidity source files.
- `/test`: Hardhat tests.
- `/scripts`: Deployment and utility scripts.

## Setup
1. Ensure the root `.env` file has the following variables:
   ```env
   PRIVATE_KEY=your_private_key
   RPC_URL=your_rpc_url
   ETHERSCAN_API_KEY=your_api_key
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Deployment

To deploy to Sepolia testnet:
```bash
npm run deploy --network sepolia
```

## Verification

After deployment, verify the contract on Etherscan:
```bash
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
```
