import { Signer } from "@ethersproject/abstract-signer";
import { AddressZero } from "@ethersproject/constants";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import { TxData, bn, generateSourceBytes } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

// Manifold:
// - escrowed orderbook
// - fully on-chain

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // --- Create order ---

  public async createOrder(
    maker: Signer,
    order: Order
  ): Promise<ContractTransaction> {
    const tx = this.createOrderTx(order);
    return maker.sendTransaction(tx);
  }

  public createOrderTx(order: Order): TxData {
    return {
      from: order.params.address,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("createListing", [
        order.params.listingDetails,
        order.params.tokenDetails,
        order.params.deliveryFees,
        order.params.listingReceivers,
        null,
        [],
      ]),
    };
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    listingId: number,
    amount: number,
    price: string,
    options?: {
      source?: string;
      nativeReferrerAddress?: string;
    }
  ): Promise<ContractTransaction> {
    const tx = this.fillOrderTx(
      await taker.getAddress(),
      listingId,
      amount,
      price,
      options
    );
    return taker.sendTransaction(tx);
  }

  public fillOrderTx(
    taker: string,
    listingId: number,
    amount: number,
    price: string,
    options?: {
      source?: string;
      nativeReferrerAddress?: string;
    }
  ): TxData {
    return {
      from: taker,
      to: this.contract.address,
      data:
        this.contract.interface.encodeFunctionData(
          "purchase(address, uint40, uint24)",
          [taker, listingId, amount]
        ) + generateSourceBytes(options?.source),
      value: bn(price).toHexString(),
    };
  }

  // --- Cancel order ---
  //TODO
}
