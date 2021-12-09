import { Signer } from "@ethersproject/abstract-signer";
import { arrayify, splitSignature } from "@ethersproject/bytes";
import { hashMessage } from "@ethersproject/hash";
import { keccak256 } from "@ethersproject/solidity";
import { verifyMessage } from "@ethersproject/wallet";

import { HowToCall, Order, SaleKind, Side } from "./types";
import { l, s } from "../utils";

const RAW_ORDER_FIELDS = [
  "address", // exchange
  "address", // maker
  "address", // taker
  "uint256", // makerRelayerFee
  "uint256", // takerRelayerFee
  "uint256", // makerProtocolFee (always 0)
  "uint256", // takerProtocolFee (always 0)
  "address", // feeRecipient
  "uint8", // feeMethod (always 1)
  "uint8", // side
  "uint8", // saleKind
  "address", // target
  "uint8", // howToCall
  "bytes", // calldata
  "bytes", // replacementPattern
  "address", // staticTarget
  "bytes", // staticExtradata
  "address", // paymentToken
  "uint256", // basePrice
  "uint256", // extra
  "uint256", // listingTime
  "uint256", // expirationTime
  "uint256", // salt
];

export const normalize = (order: Order): Order => {
  // Stringify all bignumbers and lowercase all strings
  return {
    exchange: l(order.exchange),
    maker: l(order.maker),
    taker: l(order.taker),
    makerRelayerFee: order.makerRelayerFee,
    takerRelayerFee: order.takerRelayerFee,
    feeRecipient: l(order.feeRecipient),
    side: order.side,
    saleKind: order.saleKind,
    target: l(order.target),
    howToCall: order.howToCall,
    calldata: l(order.calldata),
    replacementPattern: l(order.replacementPattern),
    staticTarget: l(order.staticTarget),
    staticExtradata: l(order.staticExtradata),
    paymentToken: l(order.paymentToken),
    basePrice: s(order.basePrice),
    extra: s(order.extra),
    listingTime: order.listingTime,
    expirationTime: order.expirationTime,
    salt: s(order.salt),
    v: order.v,
    r: s(order.r),
    s: s(order.s),
  };
};

export const hash = (order: Order): string =>
  // Raw order hash
  keccak256(RAW_ORDER_FIELDS, toRaw(order));

export const prefixHash = (order: Order): string =>
  // EIP191 prefix hash
  hashMessage(arrayify(hash(order)));

export const verify = (order: Order): boolean => {
  // Valid fees
  if (order.makerRelayerFee > 10000 || order.takerRelayerFee > 10000) {
    return false;
  }

  // Valid side
  if (order.side !== Side.BUY && order.side !== Side.SELL) {
    return false;
  }

  // Valid sale kind
  if (
    order.saleKind !== SaleKind.DUTCH_AUCTION &&
    order.saleKind !== SaleKind.FIXED_PRICE
  ) {
    return false;
  }

  // Valid call method
  if (
    order.howToCall !== HowToCall.CALL &&
    order.howToCall !== HowToCall.DELEGATE_CALL
  ) {
    return false;
  }

  // Valid listing and expiration times
  if (order.expirationTime !== 0 && order.listingTime >= order.expirationTime) {
    return false;
  }

  // Valid signature
  try {
    const signerAddress = verifyMessage(arrayify(hash(order)), {
      v: order.v,
      r: order.r ?? "",
      s: order.s ?? "",
    });

    if (l(signerAddress) !== l(order.maker)) {
      throw new Error("Invalid signer");
    }
  } catch {
    return false;
  }

  return true;
};

export const sign = async (signer: Signer, order: Order): Promise<Order> =>
  // Sign the order hash and populate the signature fields
  signer
    .signMessage(arrayify(hash(order)))
    .then(splitSignature)
    .then(({ v, r, s }) => ({ ...order, v, r, s }));

export const toRaw = (order: Order): any[] => [
  order.exchange,
  order.maker,
  order.taker,
  order.makerRelayerFee,
  order.takerRelayerFee,
  0, // makerProtocolFee (always 0)
  0, // takerProtocolFee (always 0)
  order.feeRecipient,
  1, // feeMethod (always 1 - SplitFee)
  order.side,
  order.saleKind,
  order.target,
  order.howToCall,
  order.calldata,
  order.replacementPattern,
  order.staticTarget,
  order.staticExtradata,
  order.paymentToken,
  order.basePrice,
  order.extra,
  order.listingTime,
  order.expirationTime,
  order.salt,
];
