import { Interface } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";

import { SingleTokenErc721Builder } from "../single-token/erc721";
import * as Addresses from "../../addresses";
import { Order } from "../../order";
import * as Types from "../../types";
import {
  AddressZero,
  Bytes32Zero,
  bn,
  getCurrentTimestamp,
  getRandomBytes32,
  s,
} from "../../../utils";

import TokenRangeVerifierAbi from "../../abis/TokenRangeVerifier.json";
import Erc721Abi from "../../../common/abis/Erc721.json";

// Wyvern V2 calldata:
// `transferFrom(address from, address to, uint256 tokenId)`

const REPLACEMENT_PATTERN_BUY =
  // `transferFrom` 4byte selector
  "0x00000000" +
  // `from` (empty)
  "f".repeat(64) +
  // `to` (required)
  "0".repeat(64) +
  // `tokenId` (empty)
  "f".repeat(64);

type BuildParams = {
  maker: string;
  contract: string;
  startTokenId: BigNumberish;
  endTokenId: BigNumberish;
  side: "buy" | "sell";
  price: BigNumberish;
  paymentToken: string;
  fee: number;
  feeRecipient: string;
  listingTime?: number;
  expirationTime?: number;
  salt?: BigNumberish;
  v?: number;
  r?: string;
  s?: string;
};

export class TokenRangeErc721Builder {
  public chainId: number;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  public getTokenIdRange(order: Order): [string, string] | undefined {
    try {
      const result = new Interface(TokenRangeVerifierAbi).decodeFunctionData(
        "verify",
        order.params.staticExtradata
      );
      return [result.startTokenId.toString(), result.endTokenId.toString()];
    } catch {
      return undefined;
    }
  }

  public isValid(order: Order) {
    const tokenIdRange = this.getTokenIdRange(order);
    if (!tokenIdRange) {
      return false;
    }

    try {
      const copyOrder = this.build({
        ...order.params,
        contract: order.params.target,
        startTokenId: tokenIdRange[0],
        endTokenId: tokenIdRange[1],
        side: order.params.side === Types.OrderSide.BUY ? "buy" : "sell",
        price: order.params.basePrice,
        fee: 0,
      });

      if (!copyOrder) {
        return false;
      }

      copyOrder.params.taker = order.params.taker;
      copyOrder.params.makerRelayerFee = order.params.makerRelayerFee;
      copyOrder.params.takerRelayerFee = order.params.takerRelayerFee;

      if (copyOrder.hash() !== order.hash()) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public build(params: BuildParams): Order | undefined {
    try {
      // Defaults
      params.listingTime = params.listingTime ?? getCurrentTimestamp(-60);
      params.expirationTime = params.expirationTime ?? 0;
      params.salt = params.salt ?? getRandomBytes32();
      params.v = params.v ?? 0;
      params.r = params.r ?? Bytes32Zero;
      params.s = params.s ?? Bytes32Zero;

      if (params.side === "buy") {
        return new Order(this.chainId, {
          kind: "erc721-token-range",
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
          calldata: new Interface(Erc721Abi).encodeFunctionData(
            "transferFrom",
            [AddressZero, params.maker, 0]
          ),
          replacementPattern: REPLACEMENT_PATTERN_BUY,
          staticTarget: Addresses.TokenRangeVerifier[this.chainId],
          staticExtradata: new Interface(
            TokenRangeVerifierAbi
          ).encodeFunctionData("verify", [
            params.startTokenId,
            params.endTokenId,
          ]),
          paymentToken: params.paymentToken,
          basePrice: s(params.price),
          extra: "0",
          listingTime: params.listingTime,
          expirationTime: params.expirationTime,
          salt: s(params.salt),
          v: params.v,
          r: params.r,
          s: params.s,
        });
      } else {
        throw new Error("Invalid side");
      }
    } catch {
      return undefined;
    }
  }

  public buildMatching = (options: {
    tokenId: BigNumberish;
    taker: string;
    order: Order;
  }): Order | undefined => {
    try {
      const { tokenId, taker, order } = options;

      const tokenIdRange = this.getTokenIdRange(order);
      if (!tokenIdRange) {
        return undefined;
      }

      if (
        !(bn(tokenIdRange[0]).lte(tokenId) && bn(tokenId).lte(tokenIdRange[1]))
      ) {
        return undefined;
      }

      if (order.params.side === Types.OrderSide.BUY) {
        const singleTokenBuilder = new SingleTokenErc721Builder(this.chainId);
        const matchingOrder = singleTokenBuilder.build({
          maker: taker,
          contract: order.params.target,
          tokenId,
          side: "sell",
          price: order.params.basePrice,
          paymentToken: order.params.paymentToken,
          fee: 0,
          feeRecipient: AddressZero,
          listingTime: getCurrentTimestamp(-60),
          expirationTime: 0,
          salt: getRandomBytes32(),
        })!;
        matchingOrder.params.takerRelayerFee = order.params.takerRelayerFee;

        return matchingOrder;
      } else {
        throw new Error("Invalid side");
      }
    } catch {
      return undefined;
    }
  };
}
