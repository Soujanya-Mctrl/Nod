import { expect } from "chai";
import { ethers } from "hardhat";
import { Nod } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Nod Contract", function () {
  let nod: Nod;
  let owner: HardhatEthersSigner;
  let initiator: HardhatEthersSigner;
  let counterparty: HardhatEthersSigner;

  const domainName = "Nod";
  const domainVersion = "1";

  beforeEach(async function () {
    [owner, initiator, counterparty] = await ethers.getSigners();
    const NodFactory = await ethers.getContractFactory("Nod");
    nod = await NodFactory.deploy() as unknown as Nod;
  });

  it("Should seal an agreement with valid signatures", async function () {
    const cid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
    const createdAt = Math.floor(Date.now() / 1000);
    const expiresAt = createdAt + 3600;
    const nonce = await nod.nonces(initiator.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const domain = {
      name: domainName,
      version: domainVersion,
      chainId: chainId,
      verifyingContract: await nod.getAddress(),
    };

    const types = {
      Agreement: [
        { name: "cid", type: "string" },
        { name: "initiator", type: "address" },
        { name: "counterparty", type: "address" },
        { name: "createdAt", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      cid,
      initiator: initiator.address,
      counterparty: counterparty.address,
      createdAt,
      expiresAt,
      nonce,
    };

    // Signatures
    const sig1 = await initiator.signTypedData(domain, types, value);
    const sig2 = await counterparty.signTypedData(domain, types, value);

    await expect(
      nod.sealAgreement(
        cid,
        initiator.address,
        counterparty.address,
        createdAt,
        expiresAt,
        nonce,
        sig1,
        sig2
      )
    )
      .to.emit(nod, "AgreementSealed");

    const agreementId = ethers.solidityPackedKeccak256(
      ["string", "address", "address", "uint256"],
      [cid, initiator.address, counterparty.address, nonce]
    );

    const agreement = await nod.getAgreement(agreementId);
    expect(agreement.status).to.equal(1); // Nodded
    expect(agreement.initiator).to.equal(initiator.address);
  });

  it("Should fail with invalid signature", async function () {
    const cid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
    const createdAt = Math.floor(Date.now() / 1000);
    const expiresAt = createdAt + 3600;
    const nonce = await nod.nonces(initiator.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const domain = {
      name: domainName,
      version: domainVersion,
      chainId: chainId,
      verifyingContract: await nod.getAddress(),
    };

    const types = {
      Agreement: [
        { name: "cid", type: "string" },
        { name: "initiator", type: "address" },
        { name: "counterparty", type: "address" },
        { name: "createdAt", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      cid,
      initiator: initiator.address,
      counterparty: counterparty.address,
      createdAt,
      expiresAt,
      nonce,
    };

    const sig1 = await initiator.signTypedData(domain, types, value);
    const sig2 = await owner.signTypedData(domain, types, value); // Wrong signer

    await expect(
      nod.sealAgreement(
        cid,
        initiator.address,
        counterparty.address,
        createdAt,
        expiresAt,
        nonce,
        sig1,
        sig2
      )
    ).to.be.revertedWith("Invalid counterparty signature");
  });
});
