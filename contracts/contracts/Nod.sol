// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Nod is EIP712, Ownable {
    using ECDSA for bytes32;

    enum NodStatus { Awaiting, Nodded, Declined }

    struct Agreement {
        string cid; // IPFS Content Identifier
        address initiator;
        address counterparty;
        NodStatus status;
        uint256 createdAt;
        uint256 expiresAt;
    }

    bytes32 private constant AGREEMENT_TYPEHASH = keccak256(
        "Agreement(string cid,address initiator,address counterparty,uint256 createdAt,uint256 expiresAt,uint256 nonce)"
    );

    mapping(bytes32 => Agreement) public agreements;
    mapping(address => uint256) public nonces;

    event AgreementSealed(bytes32 indexed agreementId, string cid, address indexed initiator, address indexed counterparty, uint256 timestamp);
    event AgreementDeclined(bytes32 indexed agreementId, address indexed counterparty, uint256 timestamp);

    constructor() EIP712("Nod", "1") Ownable(msg.sender) {}

    /**
     * @dev Seals an agreement by verifying signatures from both initiator and counterparty.
     * @param cid IPFS Content Identifier of the agreement text
     * @param initiator Address of the agreement initiator
     * @param counterparty Address of the agreement counterparty
     * @param createdAt Trusted timestamp from backend
     * @param expiresAt Expiry timestamp
     * @param nonce Nonce to prevent replay attacks
     * @param sig1 Signature of the initiator
     * @param sig2 Signature of the counterparty
     */
    function sealAgreement(
        string calldata cid,
        address initiator,
        address counterparty,
        uint256 createdAt,
        uint256 expiresAt,
        uint256 nonce,
        bytes calldata sig1,
        bytes calldata sig2
    ) external {
        require(block.timestamp <= expiresAt, "Agreement expired");
        require(nonces[initiator] == nonce, "Invalid nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                AGREEMENT_TYPEHASH,
                keccak256(bytes(cid)),
                initiator,
                counterparty,
                createdAt,
                expiresAt,
                nonce
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer1 = hash.recover(sig1);
        address signer2 = hash.recover(sig2);

        require(signer1 == initiator, "Invalid initiator signature");
        require(signer2 == counterparty, "Invalid counterparty signature");

        bytes32 agreementId = keccak256(abi.encodePacked(cid, initiator, counterparty, nonce));
        require(agreements[agreementId].initiator == address(0), "Agreement already exists");

        agreements[agreementId] = Agreement({
            cid: cid,
            initiator: initiator,
            counterparty: counterparty,
            status: NodStatus.Nodded,
            createdAt: createdAt,
            expiresAt: expiresAt
        });

        nonces[initiator]++;

        emit AgreementSealed(agreementId, cid, initiator, counterparty, block.timestamp);
    }

    /**
     * @dev Explicitly decline an agreement.
     * @param agreementId The unique identifier for the agreement
     */
    function declineAgreement(bytes32 agreementId) external {
        Agreement storage agreement = agreements[agreementId];
        require(msg.sender == agreement.counterparty, "Only counterparty can decline");
        require(agreement.status == NodStatus.Awaiting, "Invalid agreement state");

        agreement.status = NodStatus.Declined;
        emit AgreementDeclined(agreementId, msg.sender, block.timestamp);
    }

    function getAgreement(bytes32 agreementId) external view returns (Agreement memory) {
        return agreements[agreementId];
    }
}
