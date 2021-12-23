import { Interface } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";

import { BaseBuilder, BaseBuildParams } from "../base";
import { SingleTokenErc1155Builder } from "../single-token/erc1155";
import * as Addresses from "../../addresses";
import { Order } from "../../order";
import * as Types from "../../types";
import {
  AddressZero,
  bn,
  getCurrentTimestamp,
  getRandomBytes32,
  s,
} from "../../../utils";

import TokenRangeVerifierAbi from "../../abis/TokenRangeVerifier.json";
import Erc1155Abi from "../../../common/abis/Erc1155.json";

// Wyvern V2 calldata:
// `safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes data)`

const REPLACEMENT_PATTERN_BUY =
  // `safeTransferFrom` 4byte selector
  "0x00000000" +
  // `from` (empty)
  "f".repeat(64) +
  // `to` (required)
  "0".repeat(64) +
  // `tokenId` (empty)
  "f".repeat(64) +
  // `amount` (required)
  "0".repeat(64) +
  // empty `data` (required)
  "0".repeat(128);

interface BuildParams extends BaseBuildParams {
  contract: string;
  startTokenId: BigNumberish;
  endTokenId: BigNumberish;
}

export class TokenRangeErc1155Builder extends BaseBuilder {
  constructor(chainId: number) {
    super(chainId);
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
      this.defaultInitialize(params);

      if (params.side === "buy") {
        return new Order(this.chainId, {
          kind: "erc1155-token-range",
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
          calldata: new Interface(Erc1155Abi).encodeFunctionData(
            "safeTransferFrom",
            [AddressZero, params.maker, 0, 1, "0x"]
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
          listingTime: params.listingTime!,
          expirationTime: params.expirationTime!,
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

  public buildMatching = (
    order: Order,
    taker: string,
    tokenId: string
  ): Order | undefined => {
    try {
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
        const singleTokenBuilder = new SingleTokenErc1155Builder(this.chainId);
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
