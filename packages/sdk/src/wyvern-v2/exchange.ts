import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";

import { Order, Side } from "./types";
import { AddressZero, Bytes32Zero, l } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

export const match = async (
  relayer: Signer,
  buyOrder: Order,
  sellOrder: Order
) => {
  if (buyOrder.side !== Side.BUY) {
    throw new Error("Invalid buy order side");
  }
  if (sellOrder.side !== Side.SELL) {
    throw new Error("Invalid sell order side");
  }

  if (l(buyOrder.exchange) !== l(sellOrder.exchange)) {
    throw new Error("Mismatching exchanges");
  }

  const addrs = [
    buyOrder.exchange,
    buyOrder.maker,
    buyOrder.taker,
    buyOrder.feeRecipient,
    buyOrder.target,
    buyOrder.staticTarget,
    buyOrder.paymentToken,
    sellOrder.exchange,
    sellOrder.maker,
    sellOrder.taker,
    sellOrder.feeRecipient,
    sellOrder.target,
    sellOrder.staticTarget,
    sellOrder.paymentToken,
  ];

  const uints = [
    buyOrder.makerRelayerFee,
    buyOrder.takerRelayerFee,
    0, // makerProtocolFee (always 0)
    0, // takerProtocolFee (always 0)
    buyOrder.basePrice,
    buyOrder.extra,
    buyOrder.listingTime,
    buyOrder.expirationTime,
    buyOrder.salt,
    sellOrder.makerRelayerFee,
    sellOrder.takerRelayerFee,
    0, // makerProtocolFee (always 0)
    0, // takerProtocolFee (always 0)
    sellOrder.basePrice,
    sellOrder.extra,
    sellOrder.listingTime,
    sellOrder.expirationTime,
    sellOrder.salt,
  ];

  const feeMethodsSidesKindsHowToCalls = [
    1, // feeMethod (always 1 - SplitFee)
    buyOrder.side,
    buyOrder.saleKind,
    buyOrder.howToCall,
    1, // feeMethod (always 1 - SplitFee)
    sellOrder.side,
    sellOrder.saleKind,
    sellOrder.howToCall,
  ];

  return new Contract(buyOrder.exchange, ExchangeAbi as any)
    .connect(relayer)
    .atomicMatch_(
      addrs,
      uints,
      feeMethodsSidesKindsHowToCalls,
      buyOrder.calldata,
      sellOrder.calldata,
      buyOrder.replacementPattern,
      sellOrder.replacementPattern,
      buyOrder.staticExtradata,
      sellOrder.staticExtradata,
      [buyOrder.v, sellOrder.v],
      [buyOrder.r, buyOrder.s, sellOrder.r, sellOrder.s, Bytes32Zero],
      {
        value: buyOrder.paymentToken === AddressZero ? buyOrder.basePrice : 0,
      }
    );
};

export const cancel = async (relayer: Signer, order: Order) => {
  if (l(await relayer.getAddress()) !== l(order.maker)) {
    throw new Error("Relayer is not order maker");
  }

  const addrs = [
    order.exchange,
    order.maker,
    order.taker,
    order.feeRecipient,
    order.target,
    order.staticTarget,
    order.paymentToken,
  ];

  const uints = [
    order.makerRelayerFee,
    order.takerRelayerFee,
    0, // makerProtocolFee (always 0)
    0, // takerProtocolFee (always 0)
    order.basePrice,
    order.extra,
    order.listingTime,
    order.expirationTime,
    order.salt,
  ];

  return new Contract(order.exchange, ExchangeAbi as any)
    .connect(relayer)
    .cancelOrder_(
      addrs,
      uints,
      1, // feeMethod (always 1 - SplitFee)
      order.side,
      order.saleKind,
      order.howToCall,
      order.calldata,
      order.replacementPattern,
      order.staticExtradata,
      order.v,
      order.r,
      order.s
    );
};
