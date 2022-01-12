import { BigNumberish } from "@ethersproject/bignumber";
import { keccak256 } from "@ethersproject/solidity";
import MerkleTree from "merkletreejs";

export const generateMerkleTree = (tokenIds: BigNumberish[]) => {
  if (!tokenIds.length) {
    throw new Error("Could not generate merkle tree");
  }

  const hashFn = (buffer: Buffer) =>
    Buffer.from(keccak256(["bytes"], [buffer]).slice(2), "hex");
  const leaves = tokenIds.map((tokenId) =>
    Buffer.from(keccak256(["uint256"], [tokenId]).slice(2), "hex")
  );
  return new MerkleTree(leaves, hashFn, { sortPairs: true });
};

export const generateMerkleProof = (
  merkleTree: MerkleTree,
  tokenId: BigNumberish
) => {
  const leaf = Buffer.from(keccak256(["uint256"], [tokenId]).slice(2), "hex");
  const proof = merkleTree.getHexProof(leaf);
  if (
    "0x" + leaf.toString("hex") !== merkleTree.getHexRoot() &&
    proof.length === 0
  ) {
    throw new Error("Could not generate merkle proof");
  } else {
    const numMerkleTreeLevels = merkleTree.getDepth();
    while (proof.length < numMerkleTreeLevels) {
      proof.push("0x" + "0".repeat(64));
    }
  }
  return proof;
};
