import { Signer } from "@ethersproject/abstract-signer";
import { HashZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";

import { Order } from "./order";
import * as Types from "./types";
import * as CommonAddresses from "../common/addresses";
import { lc } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

export class Exchange {
  public chainId: number;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  public async match(relayer: Signer, buyOrder: Order, sellOrder: Order) {
    // Validate orders side
    if (
      buyOrder.params.side !== Types.OrderSide.BUY ||
      sellOrder.params.side !== Types.OrderSide.SELL
    ) {
      throw new Error("Invalid order side");
    }

    const addrs = [
      buyOrder.params.exchange,
      buyOrder.params.maker,
      buyOrder.params.taker,
      buyOrder.params.feeRecipient,
      buyOrder.params.target,
      buyOrder.params.staticTarget,
      buyOrder.params.paymentToken,
      sellOrder.params.exchange,
      sellOrder.params.maker,
      sellOrder.params.taker,
      sellOrder.params.feeRecipient,
      sellOrder.params.target,
      sellOrder.params.staticTarget,
      sellOrder.params.paymentToken,
    ];

    const uints = [
      buyOrder.params.makerRelayerFee,
      buyOrder.params.takerRelayerFee,
      0, // makerProtocolFee (always 0)
      0, // takerProtocolFee (always 0)
      buyOrder.params.basePrice,
      buyOrder.params.extra,
      buyOrder.params.listingTime,
      buyOrder.params.expirationTime,
      buyOrder.params.salt,
      sellOrder.params.makerRelayerFee,
      sellOrder.params.takerRelayerFee,
      0, // makerProtocolFee (always 0)
      0, // takerProtocolFee (always 0)
      sellOrder.params.basePrice,
      sellOrder.params.extra,
      sellOrder.params.listingTime,
      sellOrder.params.expirationTime,
      sellOrder.params.salt,
    ];

    const feeMethodsSidesKindsHowToCalls = [
      1, // feeMethod (always 1 - SplitFee)
      buyOrder.params.side,
      buyOrder.params.saleKind,
      buyOrder.params.howToCall,
      1, // feeMethod (always 1 - SplitFee)
      sellOrder.params.side,
      sellOrder.params.saleKind,
      sellOrder.params.howToCall,
    ];

    return new Contract(buyOrder.params.exchange, ExchangeAbi as any)
      .connect(relayer)
      .atomicMatch_(
        addrs,
        uints,
        feeMethodsSidesKindsHowToCalls,
        buyOrder.params.calldata,
        sellOrder.params.calldata,
        buyOrder.params.replacementPattern,
        sellOrder.params.replacementPattern,
        buyOrder.params.staticExtradata,
        sellOrder.params.staticExtradata,
        [buyOrder.params.v, sellOrder.params.v],
        [
          buyOrder.params.r,
          buyOrder.params.s,
          sellOrder.params.r,
          sellOrder.params.s,
          HashZero,
        ],
        {
          value:
            buyOrder.params.paymentToken === CommonAddresses.Eth[this.chainId]
              ? buyOrder.params.basePrice
              : 0,
          gasLimit: 15000000,
        }
      );
  }

  public async cancel(relayer: Signer, order: Order) {
    // Validate relayer
    if (lc(order.params.maker) !== lc(await relayer.getAddress())) {
      throw new Error("Invalid relayer");
    }

    const addrs = [
      order.params.exchange,
      order.params.maker,
      order.params.taker,
      order.params.feeRecipient,
      order.params.target,
      order.params.staticTarget,
      order.params.paymentToken,
    ];

    const uints = [
      order.params.makerRelayerFee,
      order.params.takerRelayerFee,
      0, // makerProtocolFee (always 0)
      0, // takerProtocolFee (always 0)
      order.params.basePrice,
      order.params.extra,
      order.params.listingTime,
      order.params.expirationTime,
      order.params.salt,
    ];

    return new Contract(order.params.exchange, ExchangeAbi as any)
      .connect(relayer)
      .cancelOrder_(
        addrs,
        uints,
        1, // feeMethod (always 1 - SplitFee)
        order.params.side,
        order.params.saleKind,
        order.params.howToCall,
        order.params.calldata,
        order.params.replacementPattern,
        order.params.staticExtradata,
        order.params.v,
        order.params.r,
        order.params.s
      );
  }
}
