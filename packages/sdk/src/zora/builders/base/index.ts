import { Order } from "../../order";
import { TakerOrderParams } from "../../types";

export interface BaseBuildParams {
  // https://github.com/ourzora/v3/blob/main/contracts/modules/Asks/V1.1/AsksV1_1.sol#L117-L131
  _tokenContract: string; // address
  _tokenId: number; // uint256
  _askPrice: string; // uint256
  _askCurrency: string; // address
  _sellerFundsRecipient: string; // address
  _findersFeeBps: number; // uint16
}

export abstract class BaseBuilder {
  public chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  public abstract isValid(order: Order): boolean;
  public abstract build(params: BaseBuildParams): Order;
  public abstract buildMatching(
    order: Order,
    taker: string,
    data: any
  ): TakerOrderParams;
}
