import { Signer } from "@ethersproject/abstract-signer";
import { arrayify, splitSignature } from "@ethersproject/bytes";
import { hashMessage } from "@ethersproject/hash";
import { keccak256 } from "@ethersproject/solidity";
import { verifyMessage } from "@ethersproject/wallet";

import * as Addresses from "./addresses";
import { Builders } from "./index";
import * as Types from "./types";
import { lc, n, s } from "../utils";

export class Order {
  public chainId: number;
  public params: Types.OrderParams;

  constructor(chainId: number, params: Types.OrderParams) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.params = normalize(params);

    // Detect kind
    if (!params.kind) {
      params.kind = this.detectKind();
    }

    // Perform light validations

    // Validate fees
    if (
      this.params.makerRelayerFee > 10000 ||
      this.params.takerRelayerFee > 10000
    ) {
      throw new Error("Invalid fees");
    }

    // Validate side
    if (
      this.params.side !== Types.OrderSide.BUY &&
      this.params.side !== Types.OrderSide.SELL
    ) {
      throw new Error("Invalid side");
    }

    // Validate sale kind
    if (this.params.saleKind !== Types.OrderSaleKind.FIXED_PRICE) {
      // Support for dutch auctions will come later
      throw new Error("Invalid sale kind");
    }

    // Validate call method
    if (
      this.params.howToCall !== Types.OrderHowToCall.CALL &&
      this.params.howToCall !== Types.OrderHowToCall.DELEGATE_CALL
    ) {
      throw new Error("Invalid call method");
    }

    // Validate listing and expiration times
    if (
      this.params.expirationTime !== 0 &&
      this.params.listingTime >= this.params.expirationTime
    ) {
      throw new Error("Invalid listing and/or expiration time");
    }

    // Validate exchange
    if (this.params.exchange !== Addresses.Exchange[this.chainId]) {
      throw new Error("Invalid exchange");
    }
  }

  public hash() {
    // Raw order hash
    return keccak256(RAW_ORDER_FIELDS, toRaw(this.params));
  }

  public prefixHash() {
    // EIP191 prefix hash
    return hashMessage(arrayify(this.hash()));
  }

  public async sign(signer: Signer) {
    const signerChainId = await signer.getChainId();
    if (this.chainId !== signerChainId) {
      throw new Error("Wrong chain id");
    }

    const signerAddress = await signer.getAddress();
    if (lc(this.params.maker) !== lc(signerAddress)) {
      throw new Error("Wrong signer");
    }

    const { v, r, s } = await signer
      .signMessage(arrayify(this.hash()))
      .then(splitSignature);

    this.params = {
      ...this.params,
      v,
      r,
      s,
    };
  }

  public async hasValidSignature() {
    try {
      const signer = verifyMessage(arrayify(this.hash()), {
        v: this.params.v,
        r: this.params.r ?? "",
        s: this.params.s ?? "",
      });

      if (lc(this.params.maker) !== lc(signer)) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public hasValidKind() {
    switch (this.params.kind) {
      case "erc721-single-token": {
        const builder = new Builders.Erc721.SingleToken(this.chainId);
        if (!builder.isValid(this)) {
          return false;
        }

        return true;
      }

      case "erc721-token-range": {
        const builder = new Builders.Erc721.TokenRange(this.chainId);
        if (!builder.isValid(this)) {
          return false;
        }

        return true;
      }

      case "erc1155-single-token": {
        const builder = new Builders.Erc1155.SingleToken(this.chainId);
        if (!builder.isValid(this)) {
          return false;
        }

        return true;
      }

      default: {
        return false;
      }
    }
  }

  public detectKind(): Types.OrderKind | undefined {
    // erc721-single-token
    {
      const builder = new Builders.Erc721.SingleToken(this.chainId);
      if (builder.isValid(this)) {
        return "erc721-single-token";
      }
    }

    // erc721-token-range
    {
      const builder = new Builders.Erc721.TokenRange(this.chainId);
      if (builder.isValid(this)) {
        return "erc721-token-range";
      }
    }

    // erc1155-single-token
    {
      const builder = new Builders.Erc1155.SingleToken(this.chainId);
      if (builder.isValid(this)) {
        return "erc1155-single-token";
      }
    }

    return undefined;
  }
}

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

const toRaw = (order: Types.OrderParams): any[] => [
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

const normalize = (order: Types.OrderParams): Types.OrderParams => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    kind: order.kind,
    exchange: lc(order.exchange),
    maker: lc(order.maker),
    taker: lc(order.taker),
    makerRelayerFee: n(order.makerRelayerFee),
    takerRelayerFee: n(order.takerRelayerFee),
    feeRecipient: lc(order.feeRecipient),
    side: n(order.side),
    saleKind: n(order.saleKind),
    target: lc(order.target),
    howToCall: n(order.howToCall),
    calldata: lc(order.calldata),
    replacementPattern: lc(order.replacementPattern),
    staticTarget: lc(order.staticTarget),
    staticExtradata: lc(order.staticExtradata),
    paymentToken: lc(order.paymentToken),
    basePrice: s(order.basePrice),
    extra: s(order.extra),
    listingTime: n(order.listingTime),
    expirationTime: n(order.expirationTime),
    salt: s(order.salt),
    v: n(order.v),
    r: s(order.r),
    s: s(order.s),
  };
};
