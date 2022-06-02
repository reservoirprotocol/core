import { Signer } from "@ethersproject/abstract-signer";
import { AddressZero } from "@ethersproject/constants";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import { TxData, bn } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

// Foundation is slightly different from the other exchanges that
// we support since it's fully on-chain and all actions including
// order creation are done via pure on-chain transactions.

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    if (chainId !== 1) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // --- Create order ---

  public async createOrder(
    maker: Signer,
    order: Order
  ): Promise<ContractTransaction> {
    return this.contract
      .connect(maker)
      .setBuyPrice(
        order.params.contract,
        order.params.tokenId,
        order.params.price
      );
  }

  public createOrderTx(order: Order): TxData {
    return {
      from: order.params.maker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("setBuyPrice", [
        order.params.contract,
        order.params.tokenId,
        order.params.price,
      ]),
    };
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    referrer?: string
  ): Promise<ContractTransaction> {
    return this.contract
      .connect(taker)
      .buyV2(
        order.params.contract,
        order.params.tokenId,
        order.params.price,
        referrer ?? AddressZero,
        {
          value: order.params.price,
        }
      );
  }

  public fillOrderTx(taker: string, order: Order, referrer?: string): TxData {
    return {
      from: taker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("buyV2", [
        order.params.contract,
        order.params.tokenId,
        order.params.price,
        referrer ?? AddressZero,
      ]),
      value: bn(order.params.price).toHexString(),
    };
  }

  // --- Cancel order ---

  public async cancelOrder(
    maker: Signer,
    order: Order
  ): Promise<ContractTransaction> {
    return this.contract
      .connect(maker)
      .cancelBuyPrice(order.params.contract, order.params.tokenId);
  }

  public cancelOrderTx(order: Order): TxData {
    return {
      from: order.params.maker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("cancelBuyPrice", [
        order.params.contract,
        order.params.tokenId,
      ]),
    };
  }
}
