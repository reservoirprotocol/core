import { BaseBuildParams, BaseBuilder } from "../base";
import { Order } from "../../order";
import { n, s } from "../../../utils";

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

  public build(params: BaseBuildParams) {
    return new Order(this.chainId, {
      _tokenContract: params._tokenContract,
      _tokenId: s(params._tokenId),
      _askPrice: s(params._askPrice),
      _askCurrency: params._askCurrency,
      _sellerFundsRecipient: params._sellerFundsRecipient,
      _findersFeeBps: n(params._findersFeeBps),
    });
  }

  public buildMatching(order: Order, finder: string) {
    return {
      _tokenContract: order.params._tokenContract,
      _tokenId: order.params._tokenId,
      _fillCurrency: order.params._askCurrency,
      _fillAmount: order.params._askPrice,
      _finder: finder,
    };
  }
}
