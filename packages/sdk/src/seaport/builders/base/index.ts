import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";

import { Order } from "../../order";
import { MatchParams } from "../../types";
import { getCurrentTimestamp, getRandomBytes } from "../../../utils";

export interface BaseBuildParams {
  offerer: string;
  side: "buy" | "sell";
  tokenKind: "erc721" | "erc1155";
  contract: string;
  price: BigNumberish;
  paymentToken: string;
  fees?: {
    recipient: string;
    amount: BigNumberish;
  }[];
  counter: BigNumberish;
  zone?: string;
  conduitKey?: string;
  salt?: BigNumberish;
  startTime?: number;
  endTime?: number;
  signature?: string;
}

export interface BaseOrderInfo {
  tokenKind: "erc721" | "erc1155";
  side: "sell" | "buy";
  contract: string;
  tokenId: string;
  amount: string;
  paymentToken: string;
  price: string;
  fees: {
    recipient: string;
    amount: BigNumberish;
  }[];
}

export abstract class BaseBuilder {
  public chainId: number;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  protected defaultInitialize(params: BaseBuildParams) {
    // Default listing time is 5 minutes in the past to allow for any
    // time discrepancies when checking the order's validity on-chain
    params.startTime = params.startTime ?? getCurrentTimestamp(-5 * 60);
    params.endTime = params.endTime ?? 0;
    params.conduitKey = params.conduitKey ?? HashZero;
    params.zone = params.zone ?? AddressZero;
    params.salt = params.salt ?? getRandomBytes();
    params.signature = params.signature ?? HashZero;
  }

  public abstract getInfo(order: Order): BaseOrderInfo | undefined;
  public abstract isValid(order: Order): boolean;
  public abstract build(params: BaseBuildParams): Order;
  public abstract buildMatching(order: Order, data: any): MatchParams;
}
