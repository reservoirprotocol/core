import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "ethers";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { TxData, bn, generateReferrerBytes, lc } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";
import { BigNumber } from "ethers/lib";
import { encodeForContract } from "./utils";

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.contract = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any
    );
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    makerOrder: Order,
    options?: {
      referrer?: string;
      amount?: number;
    }
  ): Promise<ContractTransaction> {
    const tx = await this.fillOrderTx(
      await taker.getAddress(),
      makerOrder,
      options
    );
    return taker.sendTransaction(tx);
  }

  /**
   * Calculate transaction value in case its a ETH order
   */
  public calculateTxValue(takeClass: string, takeAmount: string) {
    let value = BigNumber.from(0);
    // "ETH" can only be TAKE'a asset class in case it is a direct buy from a listing.
    // In this case transaction value is the ETH value from order.take.amount.
    // There can't be situations when ETH is a MAKE's asset class
    if (takeClass === "ETH") {
      value = BigNumber.from(takeAmount);
    }

    return value;
  }

  public async fillOrderTx(
    taker: string,
    makerOrder: Order,
    options?: {
      referrer?: string;
      amount?: number;
    }
  ): Promise<TxData> {
    const takerOrderParams = makerOrder.buildMatching(taker, options);
    // 3. generate the match tx
    const value = this.calculateTxValue(
      makerOrder.params.take.assetType.assetClass,
      makerOrder.params.take.value
    );
    const encodedOrder = encodeForContract(makerOrder.params, takerOrderParams);

    // Switch is better here
    const side = makerOrder.getInfo()?.side;
    if (side === "buy") {
      const {
        from,
        to,
        data,
        value: matchedValue,
      } = await this.contract.populateTransaction.directAcceptBid(
        encodedOrder,
        {
          from: taker,
          value: value.toString(),
        }
      );

      return {
        from: from!,
        to: to!,
        data: data + generateReferrerBytes(options?.referrer),
        value: matchedValue && matchedValue.toHexString(),
      };
    } else if (side === "sell") {
      const {
        from,
        to,
        data,
        value: matchedValue,
      } = await this.contract.populateTransaction.directPurchase(encodedOrder, {
        from: taker,
        value: value.toString(),
      });
      return {
        from: from!,
        to: to!,
        data: data + generateReferrerBytes(options?.referrer),
        value: matchedValue && matchedValue.toHexString(),
      };
    } else {
      throw Error("Unknown order side");
    }
  }

  // --- Cancel order ---

  public async cancelOrder(
    maker: Signer,
    order: Order
  ): Promise<ContractTransaction> {
    const tx = await this.cancelOrderTx(order.params);
    return maker.sendTransaction(tx);
  }

  public async cancelOrderTx(orderParams: Types.Order): Promise<TxData> {
    const { from, to, data, value } =
      await this.contract.populateTransaction.cancel(
        encodeForContract(orderParams)
      );

    return {
      from: from!,
      to: to!,
      data: data!,
      value: value && value.toHexString(),
    };
  }

  /**
   * Get the fill amount of a specifc order
   * @returns uint256 order fill
   */
  public async getOrderFill(
    provider: Provider,
    order: Order
  ): Promise<BigNumberish> {
    const hash = order.hashOrderKey();
    return this.contract.connect(provider).fills(hash);
  }
}
