import { constants } from "ethers";
import { Order, Types } from "../..";
import { BaseBuilder } from "../base";
import { getComplication } from "../../complications";

export type ComplexOrderParams = Omit<
  Types.OrderInput,
  "complication" | "extraParams" | "trustedExecution"
>;

export class ComplexBuilder extends BaseBuilder<ComplexOrderParams> {
  public isValid(order: Order): boolean {
    try {
      order.checkBaseValid();
      return true;
    } catch (err) {
      return false;
    }
  }

  public build(params: ComplexOrderParams): Order {
    const order = new Order(this.chainId, {
      ...params,
      trustedExecution: "0",
      extraParams: constants.HashZero,
      complication: getComplication(this.chainId).address,
    });

    return order;
  }
}
