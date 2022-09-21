import { Order } from "../../order";
import * as Types from "../../types";

export abstract class BaseBuilder {
  public chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  protected defaultInitialize(params: Types.BaseBuildParams) {
    // Default listing time is 5 minutes in the past to allow for any
    // time discrepancies when checking the order's validity on-chain
    // params.start = params.start ?? getCurrentTimestamp(-5 * 60);
    // params.end = params.end ?? getCurrentTimestamp(365 * 24 * 60 * 60);
    // params.signature = params.signature ?? "0x";
  }

  public abstract isValid(order: Order): boolean;
  public abstract build(params: Types.BaseBuildParams): Order;
  public abstract buildMatching(
    order: Types.Order,
    taker: string,
    data: any
  ): Types.TakerOrderParams;
}
