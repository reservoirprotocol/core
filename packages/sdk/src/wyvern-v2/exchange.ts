import { Signer } from "@ethersproject/abstract-signer";
import { HashZero } from "@ethersproject/constants";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import { Order } from "./order";
import * as Types from "./types";
import * as CommonAddresses from "../common/addresses";
import { lc } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

/**
 * The Exchange interface provides partial functionality to interact with the Wyvern Exchange Ethereum Smart Contract.
 */
export class Exchange {
  /**
   * The chain ID for the Ethereum network to be used. For example, 1 for Ethereum Mainnet and 4 for Rinkeby Testnet.
   */
  public chainId: number;

  /**
   *
   * @param chainId The chain ID for the Ethereum network to be used. For example, 1 for Ethereum Mainnet and 4 for Rinkeby Testnet.
   */
  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  /**
   * Execute a Wyvern v2 order match
   * @param taker Abstracted Ethereum Account, usually as a JsonRpcSigner
   * @param buyOrder Wyvern v2 buy order
   * @param sellOrder Wyvern v2 buy order
   * @returns The Wyvern v2 contract transaction
   */
  public async match(
    taker: Signer,
    buyOrder: Order,
    sellOrder: Order
  ): Promise<ContractTransaction> {
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
      .connect(taker)
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
          // Uncomment to debug via Tenderly (eg. skip gas estimation and execute failing transaction):
          // gasLimit: 15000000,
        }
      );
  }

  /**
   * Cancel a Wyvern v2 order
   * @param maker Abstracted Ethereum Account, usually as a JsonRpcSigner
   * @param order Wyvern v2 order to be cancelled
   * @returns The contract transaction
   */
  public async cancel(
    maker: Signer,
    order: Order
  ): Promise<ContractTransaction> {
    // Validate maker
    if (lc(order.params.maker) !== lc(await maker.getAddress())) {
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
      .connect(maker)
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
