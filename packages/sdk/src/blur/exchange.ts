import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, ContractTransaction } from "@ethersproject/contracts";
import { Provider } from "@ethersproject/abstract-provider";
import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { BytesEmpty, TxData, bn, generateReferrerBytes } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";


export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    console.log('contract', Addresses.Exchange[this.chainId])
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    matchParams: Types.OrderInput,
    options?: {
      noDirectTransfer?: boolean;
      referrer?: string;
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
    matchOrder: Types.OrderInput,
    options?: {
      noDirectTransfer?: boolean;
      referrer?: string;
    }
  ): TxData {

    let to = this.contract.address;
    let data: string;
    let value: BigNumber | undefined;

    console.log("fillOrderTx", [
      order.getRaw(),
      matchOrder
    ])

    data = this.contract.interface.encodeFunctionData("execute", [
      order.getRaw(),
      matchOrder
    ]);

    value = bn(order.params.price);

    return {
      from: taker,
      to,
      data: data + generateReferrerBytes(options?.referrer),
      value: value && bn(value).toHexString(),
    };
  }

  // // --- Batch fill listings ---

  // public async batchBuy(
  //   taker: Signer,
  //   orders: Order[],
  //   matchParams: Types.MatchParams[],
  //   options?: {
  //     referrer?: string;
  //   }
  // ): Promise<ContractTransaction> {
  //   const tx = this.batchBuyTx(
  //     await taker.getAddress(),
  //     orders,
  //     matchParams,
  //     options
  //   );
  //   return taker.sendTransaction(tx);
  // }

  // public batchBuyTx(
  //   taker: string,
  //   orders: Order[],
  //   matchParams: Types.MatchParams[],
  //   options?: {
  //     referrer?: string;
  //   }
  // ): TxData {
  //   const sellOrders: any[] = [];
  //   const signatures: any[] = [];
  //   const fillAmounts: string[] = [];
  //   const callbackData: string[] = [];

  //   const tokenKind = orders[0].params.kind?.split("-")[0];
  //   if (!tokenKind) {
  //     throw new Error("Could not detect token kind");
  //   }

  //   let value = bn(0);
  //   for (let i = 0; i < Math.min(orders.length, matchParams.length); i++) {
  //     if (orders[i].params.direction !== Types.TradeDirection.SELL) {
  //       throw new Error("Invalid side");
  //     }
  //     if (orders[i].params.kind?.split("-")[0] !== tokenKind) {
  //       throw new Error("Invalid kind");
  //     }

  //     const feeAmount = orders[i].getFeeAmount();
  //     value = value.add(
  //       bn(matchParams[i].nftAmount!)
  //         .mul(orders[i].params.erc20TokenAmount)
  //         .add(orders[i].params.nftAmount!)
  //         .sub(1)
  //         .div(orders[i].params.nftAmount!)
  //         // Buyer pays the fees
  //         .add(
  //           feeAmount
  //             .mul(matchParams[i].nftAmount!)
  //             .div(orders[i].params.nftAmount!)
  //         )
  //     );

  //     sellOrders.push(orders[i].getRaw());
  //     signatures.push(orders[i].getRaw());
  //     fillAmounts.push(matchParams[i].nftAmount!);
  //     callbackData.push(BytesEmpty);
  //   }

  //   return {
  //     from: taker,
  //     to: this.contract.address,
  //     data:
  //       (tokenKind === "erc1155"
  //         ? this.contract.interface.encodeFunctionData("batchBuyERC1155s", [
  //             sellOrders,
  //             signatures,
  //             fillAmounts,
  //             false,
  //           ])
  //         : this.contract.interface.encodeFunctionData("batchBuyERC721s", [
  //             sellOrders,
  //             signatures,
  //             false,
  //           ])) + generateReferrerBytes(options?.referrer),
  //     value: value && bn(value).toHexString(),
  //   };
  // }

  // // --- Cancel order ---

  // public async cancelOrder(
  //   maker: Signer,
  //   order: Order
  // ): Promise<ContractTransaction> {
  //   const tx = this.cancelOrderTx(await maker.getAddress(), order);
  //   return maker.sendTransaction(tx);
  // }

  // public cancelOrderTx(maker: string, order: Order): TxData {
  //   let data: string;
  //   if (order.params.kind?.startsWith("erc721")) {
  //     data = this.contract.interface.encodeFunctionData("cancelERC721Order", [
  //       order.params.nonce,
  //     ]);
  //   } else {
  //     data = this.contract.interface.encodeFunctionData("cancelERC1155Order", [
  //       order.params.nonce,
  //     ]);
  //   }

  //   return {
  //     from: maker,
  //     to: this.contract.address,
  //     data,
  //   };
  // }

  // // --- Get hashNonce ---
  public async getNonce(
    provider: Provider,
    user: string
  ): Promise<BigNumber> {
    return this.contract.connect(provider).nonces(user);
  }
  

  // // --- Increase nonce ---

  // public async incrementHashNonce(
  //   maker: Signer
  // ): Promise<ContractTransaction> {
  //   const tx = this.incrementHashNonceTx(await maker.getAddress());
  //   return maker.sendTransaction(tx);
  // }

  // public incrementHashNonceTx(maker: string): TxData {
  //   const data: string = this.contract.interface.encodeFunctionData("incrementHashNonce", []);
  //   return {
  //     from: maker,
  //     to: this.contract.address,
  //     data,
  //   };
  // }

  // public async getOrderHash(
  //   provider: Provider,
  //   order: Order
  // ): Promise<BigNumber> {
  //   const isSell = order.params.direction === Types.TradeDirection.SELL;
  //   if (!order.params.nftAmount) {
  //     if (isSell) {
  //       return this.contract.connect(provider).getERC721SellOrderHash(order.getRaw());
  //     } else {
  //       return this.contract.connect(provider).getERC721BuyOrderHash(order.getRaw());
  //     }
  //   } else {
  //     if (isSell) {
  //       return this.contract.connect(provider).getERC1155SellOrderHash(order.getRaw());
  //     } else {
  //       return this.contract.connect(provider).getERC1155BuyOrderHash(order.getRaw());
  //     }
  //   }
  // }
}
