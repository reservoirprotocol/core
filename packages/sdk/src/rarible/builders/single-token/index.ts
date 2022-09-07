import { BaseBuilder } from "../base";
import { Order } from "../../order";
import * as Types from "../../types";
import { BytesEmpty, s } from "../../../utils";

export class SingleTokenBuilder extends BaseBuilder {
  public isValid(order: Order): boolean {
    try {
      const copyOrder = this.build({
        ...order.params,
      });

      if (!copyOrder) {
        return false;
      }

      if (copyOrder.hash() !== order.hash()) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public build(params: Types.Order) {
    this.defaultInitialize(params);

    return new Order(this.chainId, {
      kind: "single-token",
      maker: s(params.maker),
      makeAsset: params.makeAsset,
      taker: s(params.taker),
      takeAsset: params.takeAsset,
      salt: params.salt,
      start: params.start!,
      end: params.end!,
      dataType: params.dataType,
      data: params.data,
      signature: params?.signature,
    });
  }

  public buildMatching(order: Types.Order, taker: string) {
    return order;
  }
}
