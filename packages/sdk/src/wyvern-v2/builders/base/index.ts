import { BigNumberish } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";

import { Order } from "../../order";
import { getCurrentTimestamp, getRandomBytes32 } from "../../../utils";

export interface BaseBuildParams {
  maker: string;
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
    params.listingTime = params.listingTime ?? getCurrentTimestamp(-60);
    params.expirationTime = params.expirationTime ?? 0;
    params.salt = params.salt ?? getRandomBytes32();
    params.v = params.v ?? 0;
    params.r = params.r ?? HashZero;
    params.s = params.s ?? HashZero;
  }

  public abstract isValid(order: Order): boolean;
  public abstract build(params: BaseBuildParams): Order;
  public abstract buildMatching(
    order: Order,
    taker: string,
    ...data: any[]
  ): Order;
}
