import { BigNumberish } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";

import { Order } from "../../order";
import { bn, getCurrentTimestamp, getRandomBytes32 } from "../../../utils";
import { OrderSaleKind } from "../../types";

export interface BaseBuildParams {
  maker: string;
  side: "buy" | "sell";
  price: BigNumberish;
  paymentToken: string;
  fee: number;
  feeRecipient: string;
  nonce: BigNumberish;
  listingTime?: number;
  expirationTime?: number;
  salt?: BigNumberish;
  extra?: BigNumberish;
  v?: number;
  r?: string;
  s?: string;
}

export interface BaseOrderInfo {
  contract: string;
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
    params.listingTime = params.listingTime ?? getCurrentTimestamp(-5 * 60);
    params.expirationTime = params.expirationTime ?? 0;
    params.salt = params.salt ?? getRandomBytes32();
    params.extra = params.extra ?? "0";
    params.v = params.v ?? 0;
    params.r = params.r ?? HashZero;
    params.s = params.s ?? HashZero;

    if (this.isDutchAuction(params)) {
      this.validateDutchAuction(params);
      return OrderSaleKind.DUTCH_AUCTION;
    } else {
      return OrderSaleKind.FIXED_PRICE;
    }
  }

  protected isDutchAuction(params: BaseBuildParams) {
    // The order's `extra` parameters specifies dutch auction details
    return bn(params?.extra || 0).gt(0);
  }

  protected validateDutchAuction(params: BaseBuildParams) {
    if (this.isDutchAuction(params)) {
      // Make sure the expiration time is valid
      if (bn(params.listingTime!).gte(bn(params.expirationTime!))) {
        throw new Error("Invalid listing/expiration time");
      }

      // We don't support dutch auctions for buy orders
      if (params.side === "buy") {
        throw new Error("Unsupported side");
      }
    }
  }

  public getMatchingPrice(order: Order): BigNumberish {
    // https://github.com/ProjectWyvern/wyvern-ethereum/blob/bfca101b2407e4938398fccd8d1c485394db7e01/contracts/exchange/SaleKindInterface.sol#L70-L87
    if (order.params.saleKind === OrderSaleKind.FIXED_PRICE) {
      return bn(order.params.basePrice);
    } else {
      // Set a delay of 1 minute to allow for any timestamp discrepancies
      const diff = bn(order.params.extra)
        .mul(bn(getCurrentTimestamp(-60)).sub(order.params.listingTime))
        .div(bn(order.params.expirationTime).sub(order.params.listingTime));
      return bn(order.params.basePrice).sub(diff);
    }
  }

  public abstract getInfo(order: Order): BaseOrderInfo | undefined;
  public abstract isValid(order: Order): boolean;
  public abstract build(params: BaseBuildParams): Order;
  public abstract buildMatching(order: Order, taker: string, data: any): Order;
}
