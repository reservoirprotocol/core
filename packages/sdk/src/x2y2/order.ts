import { AddressZero } from "@ethersproject/constants";

import * as Types from "./types";
import { lc, n, s } from "../utils";

export class Order {
  public chainId: number;
  public params: Types.Order;

  constructor(chainId: number, params: Types.Order) {
    if (chainId !== 1) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;

    try {
      this.params = normalize(params);
    } catch {
      throw new Error("Invalid params");
    }
  }
}

const normalize = (order: Types.Order): Types.Order => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    kind: order.kind,
    id: order.id,
    type: s(order.type),
    currency: lc(order.currency),
    price: s(order.price),
    maker: lc(order.maker),
    taker: order.taker ? lc(order.taker) : AddressZero,
    deadline: n(order.deadline),
    itemHash: lc(order.itemHash),
    nft: {
      token: lc(order.nft.token),
      tokenId: s(order.nft.tokenId),
    },
  };
};
