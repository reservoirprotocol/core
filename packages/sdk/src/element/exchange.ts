import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { BytesEmpty, TxData, bn, generateSourceBytes } from "../utils";

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
      noDirectTransfer?: boolean;
      source?: string;
    }
  ): Promise<ContractTransaction> {
    const tx = this.fillOrderTx(
      await taker.getAddress(),
      order,
      matchParams,
      options
    );
    return taker.sendTransaction(tx);
  }

  public fillOrderTx(
    taker: string,
    order: Order,
    matchParams: Types.MatchParams,
    options?: {
      noDirectTransfer?: boolean;
      source?: string;
    }
  ): TxData {
    const feeAmount = order.getFeeAmount();

    let to = this.contract.address;
    let data: string;
    let value: BigNumber | undefined;

    if (order.params.kind?.startsWith("erc721")) {
      if (order.params.direction === Types.TradeDirection.BUY) {
        data = this.contract.interface.encodeFunctionData("sellERC721", [
          order.getRaw(),
          order.getRaw(),
          matchParams.nftId!,
          matchParams.unwrapNativeToken ?? true,
          BytesEmpty,
        ]);
      } else {
        data = this.contract.interface.encodeFunctionData("buyERC721", [
          order.getRaw(),
          order.getRaw(),
        ]);
        value = bn(order.params.erc20TokenAmount).add(feeAmount);
      }
    } else {
      if (order.params.direction === Types.TradeDirection.BUY) {
        data = this.contract.interface.encodeFunctionData("sellERC1155", [
          order.getRaw(),
          order.getRaw(),
          matchParams.nftId!,
          matchParams.nftAmount!,
          matchParams.unwrapNativeToken ?? true,
          BytesEmpty,
        ]);
      } else {
        data = this.contract.interface.encodeFunctionData("buyERC1155", [
          order.getRaw(),
          order.getRaw(),
          matchParams.nftAmount!,
        ]);
        value = bn(matchParams.nftAmount!)
          .mul(order.params.erc20TokenAmount)
          .add(order.params.nftAmount!)
          .sub(1)
          .div(order.params.nftAmount!)
          // Buyer pays the fees
          .add(
            feeAmount.mul(matchParams.nftAmount!).div(order.params.nftAmount!)
          );
      }
    }

    return {
      from: taker,
      to,
      data: data + generateSourceBytes(options?.source),
      value: value && bn(value).toHexString(),
    };
  }

  // --- Batch fill listings ---

  public async batchBuy(
    taker: Signer,
    orders: Order[],
    matchParams: Types.MatchParams[],
    options?: {
      source?: string;
    }
  ): Promise<ContractTransaction> {
    const tx = this.batchBuyTx(
      await taker.getAddress(),
      orders,
      matchParams,
      options
    );
    return taker.sendTransaction(tx);
  }

  public batchBuyTx(
    taker: string,
    orders: Order[],
    matchParams: Types.MatchParams[],
    options?: {
      source?: string;
    }
  ): TxData {
    const sellOrders: any[] = [];
    const signatures: any[] = [];
    const fillAmounts: string[] = [];
    const callbackData: string[] = [];

    const tokenKind = orders[0].params.kind?.split("-")[0];
    if (!tokenKind) {
      throw new Error("Could not detect token kind");
    }

    let value = bn(0);
    for (let i = 0; i < Math.min(orders.length, matchParams.length); i++) {
      if (orders[i].params.direction !== Types.TradeDirection.SELL) {
        throw new Error("Invalid side");
      }
      if (orders[i].params.kind?.split("-")[0] !== tokenKind) {
        throw new Error("Invalid kind");
      }

      const feeAmount = orders[i].getFeeAmount();
      value = value.add(
        bn(matchParams[i].nftAmount!)
          .mul(orders[i].params.erc20TokenAmount)
          .add(orders[i].params.nftAmount!)
          .sub(1)
          .div(orders[i].params.nftAmount!)
          // Buyer pays the fees
          .add(
            feeAmount
              .mul(matchParams[i].nftAmount!)
              .div(orders[i].params.nftAmount!)
          )
      );

      sellOrders.push(orders[i].getRaw());
      signatures.push(orders[i].getRaw());
      fillAmounts.push(matchParams[i].nftAmount!);
      callbackData.push(BytesEmpty);
    }

    return {
      from: taker,
      to: this.contract.address,
      data:
        (tokenKind === "erc1155"
          ? this.contract.interface.encodeFunctionData("batchBuyERC1155s", [
              sellOrders,
              signatures,
              fillAmounts,
              false,
            ])
          : this.contract.interface.encodeFunctionData("batchBuyERC721s", [
              sellOrders,
              signatures,
              false,
            ])) + generateSourceBytes(options?.source),
      value: value && bn(value).toHexString(),
    };
  }

  // --- Cancel order ---

  public async cancelOrder(
    maker: Signer,
    order: Order
  ): Promise<ContractTransaction> {
    const tx = this.cancelOrderTx(await maker.getAddress(), order);
    return maker.sendTransaction(tx);
  }

  public cancelOrderTx(maker: string, order: Order): TxData {
    let data: string;
    if (order.params.kind?.startsWith("erc721")) {
      data = this.contract.interface.encodeFunctionData("cancelERC721Order", [
        order.params.nonce,
      ]);
    } else {
      data = this.contract.interface.encodeFunctionData("cancelERC1155Order", [
        order.params.nonce,
      ]);
    }

    return {
      from: maker,
      to: this.contract.address,
      data,
    };
  }
}
