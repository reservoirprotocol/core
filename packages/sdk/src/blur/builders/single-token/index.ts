import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { BaseBuildParams, BaseBuilder } from "../base";
import * as Addresses from "../../addresses";
import { Order } from "../../order";
import * as Types from "../../types";
import * as CommonAddresses from "../../../common/addresses";
import { BytesEmpty, lc, s, n } from "../../../utils";

export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

interface BuildParams extends BaseBuildParams {
  tokenId: BigNumberish;
}

export class SingleTokenBuilder extends BaseBuilder {
  public isValid(order: Order): boolean {
    try {
      // const copyOrder = this.build({
      //   ...order.params,
      //   direction:
      //     order.params.direction === Types.TradeDirection.SELL ? "sell" : "buy",
      //   contract: order.params.nft,
      //   maker: order.params.maker,
      //   paymentToken: order.params.erc20Token,
      //   price: order.params.erc20TokenAmount,
      //   amount: order.params.nftAmount,
      //   tokenId: order.params.nftId,
      // });

      // if (!copyOrder) {
      //   return false;
      // }

      // if (copyOrder.hash() !== order.hash()) {
      //   return false;
      // }
    } catch {
      return false;
    }

    return true;
  }

  public build(params: BuildParams) {
    this.defaultInitialize(params);

    return new Order(this.chainId, {
      side:
        params.side === "sell"
          ? Types.TradeDirection.SELL
          : Types.TradeDirection.BUY,
      trader: params.trader,
      collection: params.collection,
      matchingPolicy: params.matchingPolicy,
      tokenId: s(params.tokenId),
      nonce: s(params.nonce),
      amount: s(params.amount)!,
      paymentToken: lc(params.paymentToken)!,
      price: s(params.price),
      listingTime: s(params.listingTime),
      expirationTime: s(params.expirationTime),
      fees: params.fees!.map(({ recipient, rate }) => ({
        recipient: lc(recipient),
        rate: n(rate),
      })),
      salt: s(params.salt),
      extraParams: s(params.extraParams),
      signatureType: params.signatureType,
      v: params.v,
      r: params.r,
      s: params.s,
    });
  }

  public buildMatching(
    order: Order,
    data?: { amount?: BigNumberish }
  ) {
    return {
      order: {
        ...order.params,
        side: order.params.side === Types.TradeDirection.SELL ? Types.TradeDirection.BUY : Types.TradeDirection.SELL,
        amount: data?.amount ? s(data.amount) : "1",
      },
      v: 27,
      r: ZERO_BYTES32,
      s: ZERO_BYTES32,
      extraSignature: "0x",
      signatureVersion: 0,
      blockNumber: 0
    };
  }
}
