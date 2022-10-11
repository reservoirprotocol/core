import {
  Provider,
  TransactionResponse,
} from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { TxData, bn, generateSourceBytes } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    matchParams: Types.MatchParams,
    options?: {
      source?: string;
    }
  ): Promise<TransactionResponse> {
    const tx = this.fillOrderTx(
      await taker.getAddress(),
      order,
      matchParams,
      options
    );
    return taker.sendTransaction({ ...tx, gasLimit: 1000000 });
  }

  public fillOrderTx(
    taker: string,
    order: Order,
    matchParams: Types.MatchParams,
    options?: {
      source?: string;
    }
  ): TxData {
    if (order.params.kind === "single-token") {
      return {
        from: taker,
        to: this.contract.address,
        data:
          this.contract.interface.encodeFunctionData("fill", [
            {
              bid: order.params,
              signature: order.params.signature!,
              fillAmount: matchParams.fillAmount,
            },
          ]) + generateSourceBytes(options?.source),
      };
    } else {
      return {
        from: taker,
        to: this.contract.address,
        data:
          this.contract.interface.encodeFunctionData("fillWithCriteria", [
            {
              bid: order.params,
              signature: order.params.signature!,
              fillAmount: matchParams.fillAmount,
            },
            matchParams.tokenId!,
            matchParams.criteriaProof!,
          ]) + generateSourceBytes(options?.source),
      };
    }
  }

  // --- Create vault ---

  public async createVault(
    maker: Signer,
    conduitKey?: string
  ): Promise<TransactionResponse> {
    const tx = this.createVaultTx(await maker.getAddress(), conduitKey);
    return maker.sendTransaction(tx);
  }

  public createVaultTx(maker: string, conduitKey?: string): TxData {
    return {
      from: maker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("createVault", [
        conduitKey ??
          // OpenSea's conduit key
          "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
      ]),
    };
  }

  // --- Cancel order ---

  public async cancelOrder(
    maker: Signer,
    order: Order
  ): Promise<TransactionResponse> {
    const tx = this.cancelOrderTx(await maker.getAddress(), order);
    return maker.sendTransaction(tx);
  }

  public cancelOrderTx(maker: string, order: Order): TxData {
    return {
      from: maker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("cancel", [
        [order.params],
      ]),
    };
  }

  // --- Get counter (eg. nonce) ---

  public async getCounter(
    provider: Provider,
    user: string
  ): Promise<BigNumberish> {
    return this.contract.connect(provider).counters(user);
  }

  // --- Get vault ---

  public async getVault(provider: Provider, user: string): Promise<string> {
    return this.contract.connect(provider).vaults(user);
  }
}
