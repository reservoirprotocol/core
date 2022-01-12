import { Interface, defaultAbiCoder } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { generateMerkleProof, generateMerkleTree } from "./utils";
import { BaseBuilder, BaseBuildParams } from "../base";
import * as Addresses from "../../addresses";
import { Order } from "../../order";
import * as Types from "../../types";
import { getCurrentTimestamp, getRandomBytes32, s } from "../../../utils";

import TokenListVerifierAbi from "../../abis/TokenListVerifier.json";
import Erc721Abi from "../../../common/abis/Erc721.json";

// Wyvern V2 calldata:
// `transferFrom(address from, address to, uint256 tokenId)`

const REPLACEMENT_PATTERN_BUY = (numTokens: number) => {
  const numMerkleTreeLevels = Math.ceil(Math.log2(numTokens));
  return (
    // "transferFrom" 4byte signature
    "0x00000000" +
    // "from" field
    "f".repeat(64) +
    // "to" field
    "0".repeat(64) +
    // "tokenId" field
    "f".repeat(64) +
    // merkle root
    "0".repeat(64) +
    // merkle proof
    "0".repeat(128) +
    "f".repeat(64).repeat(numMerkleTreeLevels)
  );
};

const REPLACEMENT_PATTERN_SELL = (numTokens: number) => {
  const numMerkleTreeLevels = Math.ceil(Math.log2(numTokens));
  return (
    // "transferFrom" 4byte signature
    "0x00000000" +
    // "from" field
    "0".repeat(64) +
    // "to" field
    "f".repeat(64) +
    // "tokenId" field
    "0".repeat(64) +
    // merkle root
    "f".repeat(64) +
    // merkle proof
    "0".repeat(128) +
    "0".repeat(64).repeat(numMerkleTreeLevels)
  );
};

interface BuildParams extends BaseBuildParams {
  contract: string;
  tokenIds: BigNumberish[];
}

export class TokenListErc721Builder extends BaseBuilder {
  constructor(chainId: number) {
    super(chainId);
  }

  public getMerkleRoot(order: Order): string | undefined {
    try {
      const [merkleRoot] = defaultAbiCoder.decode(
        ["bytes32"],
        "0x" + order.params.calldata.slice(2).substr(200, 64)
      );
      return merkleRoot;
    } catch {
      return undefined;
    }
  }

  public isValid(order: Order) {
    const merkleRoot = this.getMerkleRoot(order);
    if (!merkleRoot) {
      return false;
    }

    if (
      !order.params.calldata.startsWith(
        new Interface(Erc721Abi).getSighash("transferFrom")
      )
    ) {
      return false;
    }

    return true;
  }

  public build(params: BuildParams) {
    this.defaultInitialize(params);

    if (params.side === "buy") {
      const numMerkleTreeLevels = Math.ceil(Math.log2(params.tokenIds.length));
      const merkleTree = generateMerkleTree(params.tokenIds);

      const calldata =
        new Interface(Erc721Abi).encodeFunctionData("transferFrom", [
          AddressZero,
          params.maker,
          0,
        ]) +
        // merkle root
        merkleTree.getHexRoot().slice(2) +
        // merkle proof
        defaultAbiCoder.encode(["uint256"], [64]).slice(2) +
        defaultAbiCoder.encode(["uint256"], [numMerkleTreeLevels]).slice(2) +
        "0".repeat(64).repeat(numMerkleTreeLevels);

      const staticExtradata =
        new Interface(TokenListVerifierAbi as any).getSighash("verifyErc721") +
        defaultAbiCoder.encode(["uint256"], [32]).slice(2) +
        defaultAbiCoder
          .encode(["uint256"], [calldata.slice(2).length / 2])
          .slice(2);

      return new Order(this.chainId, {
        kind: "erc721-token-list",
        exchange: Addresses.Exchange[this.chainId],
        maker: params.maker,
        taker: AddressZero,
        makerRelayerFee: 0,
        takerRelayerFee: params.fee,
        feeRecipient: params.feeRecipient,
        side: Types.OrderSide.BUY,
        // No dutch auctions support for now
        saleKind: Types.OrderSaleKind.FIXED_PRICE,
        target: params.contract,
        howToCall: Types.OrderHowToCall.CALL,
        calldata,
        replacementPattern: REPLACEMENT_PATTERN_BUY(params.tokenIds.length),
        staticTarget: Addresses.TokenRangeVerifier[this.chainId],
        staticExtradata,
        paymentToken: params.paymentToken,
        basePrice: s(params.price),
        extra: "0",
        listingTime: params.listingTime!,
        expirationTime: params.expirationTime!,
        salt: s(params.salt),
        v: params.v,
        r: params.r,
        s: params.s,
      });
    } else if (params.side === "sell") {
      throw new Error("Unsupported order side");
    } else {
      throw new Error("Invalid order side");
    }
  }

  public buildMatching = (
    order: Order,
    taker: string,
    tokenIds: string[],
    tokenId: string
  ) => {
    const merkleRoot = this.getMerkleRoot(order);
    if (!merkleRoot) {
      throw new Error("Invalid order");
    }

    const numMerkleTreeLevels = Math.ceil(Math.log2(tokenIds.length));
    const merkleTree = generateMerkleTree(tokenIds);
    if (merkleTree.getHexRoot() !== merkleRoot) {
      throw new Error("Token ids not matching merkle root");
    }

    const merkleProof = generateMerkleProof(merkleTree, tokenId)
      .map((proof) => proof.slice(2))
      .join("");

    if (order.params.side === Types.OrderSide.BUY) {
      const calldata =
        new Interface(Erc721Abi as any).encodeFunctionData("transferFrom", [
          taker,
          AddressZero,
          tokenId,
        ]) +
        // merkle root
        "0".repeat(64) +
        // merkle proof
        defaultAbiCoder.encode(["uint256"], [64]).slice(2) +
        defaultAbiCoder.encode(["uint256"], [numMerkleTreeLevels]).slice(2) +
        merkleProof;

      return new Order(this.chainId, {
        kind: "erc721-token-list",
        exchange: Addresses.Exchange[this.chainId],
        maker: taker,
        taker: AddressZero,
        makerRelayerFee: 0,
        takerRelayerFee: order.params.takerRelayerFee,
        feeRecipient: AddressZero,
        side: Types.OrderSide.SELL,
        saleKind: Types.OrderSaleKind.FIXED_PRICE,
        target: order.params.target,
        howToCall: Types.OrderHowToCall.CALL,
        calldata,
        replacementPattern: REPLACEMENT_PATTERN_SELL(tokenIds.length),
        staticTarget: AddressZero,
        staticExtradata: "0x",
        paymentToken: order.params.paymentToken,
        basePrice: s(order.params.basePrice),
        extra: "0",
        listingTime: getCurrentTimestamp(-60),
        expirationTime: 0,
        salt: s(getRandomBytes32()),
      });
    } else if (order.params.side === Types.OrderSide.SELL) {
      throw new Error("Unsupported order side");
    } else {
      throw new Error("Invalid order side");
    }
  };
}
