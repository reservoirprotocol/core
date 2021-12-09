import { Interface } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";

import { hash, normalize, verify } from "../../order";
import { HowToCall, Order, Side, SaleKind } from "../../types";
import {
  AddressZero,
  Bytes32Zero,
  BytesEmpty,
  getCurrentTimestamp,
  getRandomBytes32,
  s,
} from "../../../utils";

import Erc721Abi from "../../../abis/Erc721.json";

// Wyvern V2 calldata:
// `transferFrom(address from, address to, uint256 tokenId)`

const REPLACEMENT_PATTERN_BUY =
  // `transferFrom` 4byte selector
  "0x00000000" +
  // `from` (empty)
  "f".repeat(64) +
  // `to` (required)
  "0".repeat(64) +
  // `tokenId` (required)
  "0".repeat(64);

const REPLACEMENT_PATTERN_SELL =
  // `transferFrom` 4byte selector
  "0x00000000" +
  // `from` (required)
  "0".repeat(64) +
  // `to` (empty)
  "f".repeat(64) +
  // `tokenId` (required)
  "0".repeat(64);

type OrderParams = {
  exchange: string;
  maker: string;
  target: string;
  tokenId: BigNumberish;
  side: Side;
  paymentToken: string;
  basePrice: BigNumberish;
  fee: number;
  feeRecipient: string;
  listingTime?: number;
  expirationTime?: number;
  salt?: BigNumberish;
  v?: number;
  r?: string;
  s?: string;
};

export const getTokenId = (order: Order): string | null => {
  try {
    const result = new Interface(Erc721Abi).decodeFunctionData(
      "transferFrom",
      order.calldata
    );
    return result.tokenId.toString();
  } catch {
    return null;
  }
};

export const build = (params: OrderParams): Order | null => {
  try {
    // Defaults
    params.listingTime = params.listingTime ?? getCurrentTimestamp(-60);
    params.expirationTime = params.expirationTime ?? 0;
    params.salt = params.salt ?? getRandomBytes32();
    params.v = params.v ?? 0;
    params.r = params.r ?? Bytes32Zero;
    params.s = params.s ?? Bytes32Zero;

    if (params.side === Side.BUY) {
      return normalize({
        exchange: params.exchange,
        maker: params.maker,
        taker: AddressZero,
        makerRelayerFee: 0,
        takerRelayerFee: params.fee,
        feeRecipient: params.feeRecipient,
        side: Side.BUY,
        // No dutch auctions support for now
        saleKind: SaleKind.FIXED_PRICE,
        target: params.target,
        howToCall: HowToCall.CALL,
        calldata: new Interface(Erc721Abi).encodeFunctionData("transferFrom", [
          AddressZero,
          params.maker,
          params.tokenId,
        ]),
        replacementPattern: REPLACEMENT_PATTERN_BUY,
        staticTarget: AddressZero,
        staticExtradata: BytesEmpty,
        paymentToken: params.paymentToken,
        basePrice: s(params.basePrice),
        extra: "0",
        listingTime: params.listingTime,
        expirationTime: params.expirationTime,
        salt: s(params.salt),
        v: params.v,
        r: params.r,
        s: params.s,
      });
    } else if (params.side === Side.SELL) {
      return normalize({
        exchange: params.exchange,
        maker: params.maker,
        taker: AddressZero,
        makerRelayerFee: params.fee,
        takerRelayerFee: 0,
        feeRecipient: params.feeRecipient,
        side: Side.SELL,
        // No dutch auctions support for now
        saleKind: SaleKind.FIXED_PRICE,
        target: params.target,
        howToCall: HowToCall.CALL,
        calldata: new Interface(Erc721Abi).encodeFunctionData("transferFrom", [
          params.maker,
          AddressZero,
          params.tokenId,
        ]),
        replacementPattern: REPLACEMENT_PATTERN_SELL,
        staticTarget: AddressZero,
        staticExtradata: BytesEmpty,
        paymentToken: params.paymentToken,
        basePrice: s(params.basePrice),
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
    return null;
  }
};

export const buildMatching = (order: Order, taker: string): Order | null => {
  try {
    const tokenId = getTokenId(order);
    if (!tokenId) {
      return null;
    }

    if (order.side === Side.BUY) {
      const matching = build({
        exchange: order.exchange,
        maker: taker,
        target: order.target,
        tokenId,
        side: Side.SELL,
        paymentToken: order.paymentToken,
        basePrice: order.basePrice,
        fee: 0,
        feeRecipient: AddressZero,
        listingTime: getCurrentTimestamp(-60),
        expirationTime: 0,
        salt: getRandomBytes32(),
      })!;
      matching.takerRelayerFee = order.takerRelayerFee;

      return matching;
    } else if (order.side === Side.SELL) {
      const matching = build({
        exchange: order.exchange,
        maker: taker,
        target: order.target,
        tokenId,
        side: Side.BUY,
        paymentToken: order.paymentToken,
        basePrice: order.basePrice,
        fee: 0,
        feeRecipient: AddressZero,
        listingTime: getCurrentTimestamp(-60),
        expirationTime: 0,
        salt: getRandomBytes32(),
      })!;
      matching.makerRelayerFee = order.makerRelayerFee;

      return matching;
    } else {
      throw new Error("Invalid side");
    }
  } catch {
    return null;
  }
};

export const check = (order: Order): boolean => {
  if (!verify(order)) {
    return false;
  }

  const tokenId = getTokenId(order);
  if (!tokenId) {
    return false;
  }

  try {
    const copy = build({
      ...order,
      tokenId,
      fee: 0,
    });

    if (!copy) {
      throw new Error("Invalid order");
    }

    copy.taker = order.taker;
    copy.makerRelayerFee = order.makerRelayerFee;
    copy.takerRelayerFee = order.takerRelayerFee;

    if (hash(copy) !== hash(order)) {
      throw new Error("Invalid order");
    }
  } catch {
    return false;
  }

  return true;
};
