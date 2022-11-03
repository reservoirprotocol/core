import { BigNumberish } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";

import { Order } from "../../order";
import { BaseOrder, OrderInput } from "../../types";
import { getCurrentTimestamp, getRandomBytes } from "../../../utils";

export interface BaseBuildParams {
  side: "sell" | "buy";
  trader: string;
  collection: string;
  matchingPolicy: string;
  tokenId: BigNumberish;
  amount?: BigNumberish;
  nonce: BigNumberish;
  paymentToken: string;
  price: BigNumberish;
  listingTime?: BigNumberish;
  expirationTime?: BigNumberish;
  fees?: {
    recipient: string;
    rate: number;
  }[];
  salt?: BigNumberish;
  extraParams?: string;

  signatureType?: number;
  v?: number;
  r?: string;
  s?: string;
}

export interface BaseOrderInfo {}

export abstract class BaseBuilder {
  public chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  protected defaultInitialize(params: BaseBuildParams) {
    params.fees = params.fees ?? [];
    params.signatureType = params.signatureType ?? 2;
    params.v = params.v ?? 0;
    params.r = params.r ?? HashZero;
    params.s = params.s ?? HashZero;
  }

  public getInfo(_order: Order): BaseOrderInfo {
    return {};
  }

  public abstract isValid(order: Order): boolean;
  public abstract build(params: BaseBuildParams): Order;
  public abstract buildMatching(order: Order, data: any): OrderInput;
}
