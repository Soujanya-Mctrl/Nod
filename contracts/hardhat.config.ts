import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const config: HardhatUserConfig = {
    solidity: "0.8.28",
    networks: {
        // Example:
        // sepolia: {
        //   url: process.env.RPC_URL || "",
        //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        // },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};

export default config;
