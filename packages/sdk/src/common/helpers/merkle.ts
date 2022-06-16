import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { keccak256 } from "ethers/lib/utils";
import MerkleTree from "merkletreejs";

export const hashFn = (tokenId: BigNumberish) =>
  keccak256(
    Buffer.from(
      BigNumber.from(tokenId).toHexString().slice(2).padStart(64, "0"),
      "hex"
    )
  );

export const generateMerkleTree = (tokenIds: BigNumberish[]) => {
  if (!tokenIds.length) {
    throw new Error("Could not generate merkle tree");
  }

  const leaves = tokenIds.map(hashFn);
  return new MerkleTree(leaves, hashFn, { sort: true });
};

export const generateMerkleProof = (
  merkleTree: MerkleTree,
  tokenId: BigNumberish
) => {
  const leaf = hashFn(tokenId);
  const proof = merkleTree.getHexProof(leaf);
  if (leaf !== merkleTree.getHexRoot() && proof.length === 0) {
    throw new Error("Could not generate merkle proof");
  } else {
    const numMerkleTreeLevels = merkleTree.getDepth();
    while (proof.length < numMerkleTreeLevels) {
      proof.push("0x" + "0".repeat(64));
    }
  }
  return proof;
};
