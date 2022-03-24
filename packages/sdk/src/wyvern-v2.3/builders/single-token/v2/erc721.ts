import { Interface } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";

import { BaseBuilder, BaseBuildParams, BaseOrderInfo } from "../../base";
import * as Addresses from "../../../addresses";
import { Order } from "../../../order";
import * as Types from "../../../types";
import {
  BytesEmpty,
  getCurrentTimestamp,
  getRandomBytes32,
  s,
} from "../../../../utils";

import OpenSeaMerkleValidatorAbi from "../../../abis/OpenSeaMerkleValidator.json";

// Wyvern V2 calldata:
// `matchERC721UsingCriteria(
//    address from,
//    address to,
//    address token,
//    uint256 tokenId,
//    bytes32 root,
//    bytes32[] calldata proof
// )`
// OR
// `matchERC721WithSafeTransferUsingCriteria(
//    address from,
//    address to,
//    address token,
//    uint256 tokenId,
//    bytes32 root,
//    bytes32[] calldata proof
// )`

const REPLACEMENT_PATTERN_BUY =
  // `matchERC721UsingCriteria`/`matchERC721WithSafeTransferUsingCriteria` 4byte selector
  "0x00000000" +
  // `from` (empty)
  "f".repeat(64) +
  // `to` (required)
  "0".repeat(64) +
  // `token` (required)
  "0".repeat(64) +
  // `tokenId` (required)
  "0".repeat(64) +
  // `root` (required)
  "0".repeat(64) +
  // `proof` (required)
  "0".repeat(128);

const REPLACEMENT_PATTERN_SELL =
  // `matchERC721UsingCriteria`/`matchERC721WithSafeTransferUsingCriteria` 4byte selector
  "0x00000000" +
  // `from` (required)
  "0".repeat(64) +
  // `to` (empty)
  "f".repeat(64) +
  // `token` (required)
  "0".repeat(64) +
  // `tokenId` (required)
  "0".repeat(64) +
  // `root` (required)
  "0".repeat(64) +
  // `proof` (required)
  "0".repeat(128);

interface BuildParams extends BaseBuildParams {
  contract: string;
  tokenId: BigNumberish;
  useSafeTransfer?: boolean;
}

interface OrderInfo extends BaseOrderInfo {
  tokenId: BigNumberish;
  useSafeTransfer: boolean;
}

export class SingleTokenErc721BuilderV2 extends BaseBuilder {
  constructor(chainId: number) {
    super(chainId);
  }

  public getInfo(order: Order): OrderInfo | undefined {
    try {
      const iface = new Interface(OpenSeaMerkleValidatorAbi);

      const regularTransferSighash = iface.getSighash(
        "matchERC721UsingCriteria"
      );
      const safeTransferSighash = iface.getSighash(
        "matchERC721WithSafeTransferUsingCriteria"
      );

      let method: string;
      if (order.params.calldata.startsWith(regularTransferSighash)) {
        method = "matchERC721UsingCriteria";
      } else if (order.params.calldata.startsWith(safeTransferSighash)) {
        method = "matchERC721WithSafeTransferUsingCriteria";
      } else {
        throw new Error("Unrecognized calldata");
      }

      const result = iface.decodeFunctionData(method, order.params.calldata);
      const contract = result.token.toString().toLowerCase();
      const tokenId = result.tokenId.toString().toLowerCase();

      return {
        contract,
        tokenId,
        useSafeTransfer: method === "matchERC721WithSafeTransferUsingCriteria",
      };
    } catch {
      return undefined;
    }
  }

  public isValid(order: Order) {
    const info = this.getInfo(order);
    if (!info) {
      return false;
    }

    try {
      const copyOrder = this.build({
        ...order.params,
        contract: info.contract,
        tokenId: info.tokenId,
        useSafeTransfer: info.useSafeTransfer,
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

  public build(params: BuildParams) {
    const saleKind = this.defaultInitialize(params);

    if (params.side === "buy") {
      return new Order(this.chainId, {
        kind: "erc721-single-token-v2",
        exchange: Addresses.Exchange[this.chainId],
        maker: params.maker,
        taker: AddressZero,
        makerRelayerFee: 0,
        takerRelayerFee: params.fee,
        feeRecipient: params.feeRecipient,
        side: Types.OrderSide.BUY,
        saleKind,
        target: Addresses.OpenSeaMekleValidator[this.chainId],
        howToCall: Types.OrderHowToCall.DELEGATE_CALL,
        calldata: new Interface(OpenSeaMerkleValidatorAbi).encodeFunctionData(
          params.useSafeTransfer
            ? "matchERC721WithSafeTransferUsingCriteria"
            : "matchERC721UsingCriteria",
          [
            AddressZero,
            params.maker,
            params.contract,
            params.tokenId,
            HashZero,
            [],
          ]
        ),
        replacementPattern: REPLACEMENT_PATTERN_BUY,
        staticTarget: AddressZero,
        staticExtradata: BytesEmpty,
        paymentToken: params.paymentToken,
        basePrice: s(params.price),
        extra: s(params.extra),
        listingTime: params.listingTime!,
        expirationTime: params.expirationTime!,
        salt: s(params.salt),
        nonce: s(params.nonce),
        v: params.v,
        r: params.r,
        s: params.s,
      });
    } else if (params.side === "sell") {
      return new Order(this.chainId, {
        kind: "erc721-single-token-v2",
        exchange: Addresses.Exchange[this.chainId],
        maker: params.maker,
        taker: AddressZero,
        makerRelayerFee: params.fee,
        takerRelayerFee: 0,
        feeRecipient: params.feeRecipient,
        side: Types.OrderSide.SELL,
        saleKind,
        target: Addresses.OpenSeaMekleValidator[this.chainId],
        howToCall: Types.OrderHowToCall.DELEGATE_CALL,
        calldata: new Interface(OpenSeaMerkleValidatorAbi).encodeFunctionData(
          params.useSafeTransfer
            ? "matchERC721WithSafeTransferUsingCriteria"
            : "matchERC721UsingCriteria",
          [
            params.maker,
            AddressZero,
            params.contract,
            params.tokenId,
            HashZero,
            [],
          ]
        ),
        replacementPattern: REPLACEMENT_PATTERN_SELL,
        staticTarget: AddressZero,
        staticExtradata: BytesEmpty,
        paymentToken: params.paymentToken,
        basePrice: s(params.price),
        extra: s(params.extra),
        listingTime: params.listingTime!,
        expirationTime: params.expirationTime!,
        salt: s(params.salt),
        nonce: s(params.nonce),
        v: params.v,
        r: params.r,
        s: params.s,
      });
    } else {
      throw new Error("Invalid order side");
    }
  }

  public buildMatching(order: Order, taker: string, data: { nonce: string }) {
    const info = this.getInfo(order);
    if (!info) {
      throw new Error("Invalid order");
    }

    if (order.params.side === Types.OrderSide.BUY) {
      const matchingOrder = this.build({
        maker: taker,
        contract: info.contract,
        tokenId: info.tokenId,
        useSafeTransfer: info.useSafeTransfer,
        side: "sell",
        price: order.getMatchingPrice(),
        paymentToken: order.params.paymentToken,
        fee: 0,
        feeRecipient: AddressZero,
        listingTime: getCurrentTimestamp(-60),
        expirationTime: 0,
        salt: getRandomBytes32(),
        nonce: data.nonce,
      });
      matchingOrder.params.takerRelayerFee = order.params.takerRelayerFee;

      return matchingOrder;
    } else if (order.params.side === Types.OrderSide.SELL) {
      const matchingOrder = this.build({
        maker: taker,
        contract: info.contract,
        tokenId: info.tokenId,
        useSafeTransfer: info.useSafeTransfer,
        side: "buy",
        price: order.getMatchingPrice(),
        paymentToken: order.params.paymentToken,
        fee: 0,
        feeRecipient: AddressZero,
        listingTime: getCurrentTimestamp(-60),
        expirationTime: 0,
        salt: getRandomBytes32(),
        nonce: data.nonce,
      });
      matchingOrder.params.makerRelayerFee = order.params.makerRelayerFee;

      return matchingOrder;
    } else {
      throw new Error("Invalid order side");
    }
  }
}
