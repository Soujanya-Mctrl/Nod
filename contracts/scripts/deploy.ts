import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Nod contract...");

  const Nod = await ethers.getContractFactory("Nod");
  const nod = await Nod.deploy();

  await nod.waitForDeployment();

  const address = await nod.getAddress();

  console.log(`Nod contract deployed to: ${address}`);
  
  // Wait for a few block confirmations to ensure the contract is indexed by Etherscan
  console.log("Waiting for block confirmations...");
  // await nod.deploymentTransaction()?.wait(5);

  console.log("\nTo verify the contract, run:");
  console.log(`npx hardhat verify --network ${process.env.HARDHAT_NETWORK || "sepolia"} ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
