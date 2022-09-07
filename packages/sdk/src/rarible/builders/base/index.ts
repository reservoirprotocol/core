import { BigNumberish } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";

import { Order } from "../../order";
import * as Types from "../../types";
import { getCurrentTimestamp, getRandomBytes } from "../../../utils";

export abstract class BaseBuilder {
  public chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  protected defaultInitialize(params: Types.Order) {
    // Default listing time is 5 minutes in the past to allow for any
    // time discrepancies when checking the order's validity on-chain
    params.start = params.start ?? getCurrentTimestamp(-5 * 60);
    params.end = params.end ?? getCurrentTimestamp(365 * 24 * 60 * 60);
    params.signature = params.signature ?? "0x";
  }

  public abstract isValid(order: Order): boolean;
  public abstract build(params: Types.Order): Order;
  public abstract buildMatching(
    order: Types.Order,
    taker: string,
    data: any
  ): Types.Order;
}
