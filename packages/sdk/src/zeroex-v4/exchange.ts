import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { TxData, bn, BytesEmpty } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";
import Erc721Abi from "../common/abis/Erc721.json";
import Erc1155Abi from "../common/abis/Erc1155.json";

export class Exchange {
  public chainId: number;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 3) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  public matchTransaction(
    taker: string,
    order: Order,
    matchParams: Types.MatchParams,
    options?: {
      noDirectTransfer?: boolean;
    }
  ): TxData {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi
    );

    const feeAmount = order.getFeeAmount();

    let to = exchange.address;
    let data: string;
    let value: BigNumber | undefined;
    if (order.params.kind?.startsWith("erc721")) {
      const erc721 = new Contract(order.params.nft, Erc721Abi);
      if (order.params.direction === Types.TradeDirection.BUY) {
        if (options?.noDirectTransfer) {
          data = exchange.interface.encodeFunctionData("sellERC721", [
            order.getRaw(),
            order.getRaw(),
            matchParams.nftId!,
            matchParams.unwrapNativeToken ?? true,
            BytesEmpty,
          ]);
        } else {
          to = erc721.address;
          data = erc721.interface.encodeFunctionData(
            "safeTransferFrom(address,address,uint256,bytes)",
            [
              taker,
              exchange.address,
              matchParams.nftId!,
              defaultAbiCoder.encode(
                [Erc721OrderAbiType, SignatureAbiType, "bool"],
                [
                  order.getRaw(),
                  order.getRaw(),
                  matchParams.unwrapNativeToken ?? true,
                ]
              ),
            ]
          );
        }
      } else {
        data = exchange.interface.encodeFunctionData("buyERC721", [
          order.getRaw(),
          order.getRaw(),
          BytesEmpty,
        ]);
        value = bn(order.params.erc20TokenAmount).add(feeAmount);
      }
    } else {
      const erc1155 = new Contract(order.params.nft, Erc1155Abi);
      if (order.params.direction === Types.TradeDirection.BUY) {
        if (options?.noDirectTransfer) {
          data = exchange.interface.encodeFunctionData("sellERC1155", [
            order.getRaw(),
            order.getRaw(),
            matchParams.nftId!,
            matchParams.nftAmount!,
            matchParams.unwrapNativeToken ?? true,
            BytesEmpty,
          ]);
        } else {
          to = erc1155.address;
          data = erc1155.interface.encodeFunctionData("safeTransferFrom", [
            taker,
            exchange.address,
            matchParams.nftId!,
            matchParams.nftAmount!,
            defaultAbiCoder.encode(
              [Erc1155OrderAbiType, SignatureAbiType, "bool"],
              [
                order.getRaw(),
                order.getRaw(),
                matchParams.unwrapNativeToken ?? false,
              ]
            ),
          ]);
        }
      } else {
        data = exchange.interface.encodeFunctionData("buyERC1155", [
          order.getRaw(),
          order.getRaw(),
          matchParams.nftAmount!,
          BytesEmpty,
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
      data,
      value: value && bn(value).toHexString(),
    };
  }

  public async match(
    taker: Signer,
    order: Order,
    matchParams: Types.MatchParams
  ): Promise<ContractTransaction | undefined> {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi,
      taker
    );

    const feeAmount = order.getFeeAmount();

    if (order.params.kind?.startsWith("erc721")) {
      const erc721 = new Contract(order.params.nft, Erc721Abi, taker);
      if (order.params.direction === Types.TradeDirection.BUY) {
        return erc721["safeTransferFrom(address,address,uint256,bytes)"](
          await taker.getAddress(),
          exchange.address,
          matchParams.nftId!,
          defaultAbiCoder.encode(
            [Erc721OrderAbiType, SignatureAbiType, "bool"],
            [
              order.getRaw(),
              order.getRaw(),
              matchParams.unwrapNativeToken ?? true,
            ]
          )
        );
      } else {
        return exchange.buyERC721(order.getRaw(), order.getRaw(), BytesEmpty, {
          // Buyer pays the fees
          value: bn(order.params.erc20TokenAmount).add(feeAmount),
        });
      }
    } else {
      const erc1155 = new Contract(order.params.nft, Erc1155Abi, taker);
      if (order.params.direction === Types.TradeDirection.BUY) {
        return erc1155.safeTransferFrom(
          await taker.getAddress(),
          exchange.address,
          matchParams.nftId!,
          matchParams.nftAmount!,
          defaultAbiCoder.encode(
            [Erc1155OrderAbiType, SignatureAbiType, "bool"],
            [
              order.getRaw(),
              order.getRaw(),
              matchParams.unwrapNativeToken ?? true,
            ]
          )
        );
      } else {
        return exchange.buyERC1155(
          order.getRaw(),
          order.getRaw(),
          matchParams.nftAmount!,
          BytesEmpty,
          {
            value: bn(matchParams.nftAmount!)
              .mul(order.params.erc20TokenAmount)
              .add(order.params.nftAmount!)
              .sub(1)
              .div(order.params.nftAmount!)
              // Buyer pays the fees
              .add(
                feeAmount
                  .mul(matchParams.nftAmount!)
                  .div(order.params.nftAmount!)
              ),
          }
        );
      }
    }
  }

  public batchBuyTransaction(
    taker: string,
    orders: Order[],
    matchParams: Types.MatchParams[]
  ): TxData {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi
    );

    const sellOrders: any[] = [];
    const signatures: any[] = [];
    const erc1155FillAmounts: string[] = [];
    const callbackData: string[] = [];

    let value = bn(0);
    for (let i = 0; i < Math.min(orders.length, matchParams.length); i++) {
      if (orders[i].params.direction !== Types.TradeDirection.SELL) {
        throw new Error("Invalid side");
      }
      if (!orders[i].params.kind?.startsWith("erc1155")) {
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
      erc1155FillAmounts.push(matchParams[i].nftAmount!);
      callbackData.push(BytesEmpty);
    }

    return {
      from: taker,
      to: exchange.address,
      data: exchange.interface.encodeFunctionData("batchBuyERC1155s", [
        sellOrders,
        signatures,
        erc1155FillAmounts,
        callbackData,
        false,
      ]),
      value: value && bn(value).toHexString(),
    };
  }

  public async batchBuy(
    taker: Signer,
    orders: Order[],
    matchParams: Types.MatchParams[]
  ): Promise<ContractTransaction | undefined> {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi,
      taker
    );

    const sellOrders: any[] = [];
    const signatures: any[] = [];
    const erc1155FillAmounts: string[] = [];
    const callbackData: string[] = [];

    let value = bn(0);
    for (let i = 0; i < Math.min(orders.length, matchParams.length); i++) {
      if (orders[i].params.direction !== Types.TradeDirection.SELL) {
        throw new Error("Invalid side");
      }
      if (!orders[i].params.kind?.startsWith("erc1155")) {
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
      erc1155FillAmounts.push(matchParams[i].nftAmount!);
      callbackData.push(BytesEmpty);
    }

    return exchange.batchBuyERC1155s(
      sellOrders,
      signatures,
      erc1155FillAmounts,
      callbackData,
      false,
      { value }
    );
  }

  public cancelTransaction(maker: string, order: Order): TxData {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any
    );

    let data: string;
    if (order.params.kind?.startsWith("erc721")) {
      data = exchange.interface.encodeFunctionData("cancelERC721Order", [
        order.params.nonce,
      ]);
    } else {
      data = exchange.interface.encodeFunctionData("cancelERC1155Order", [
        order.params.nonce,
      ]);
    }

    return {
      from: maker,
      to: exchange.address,
      data,
    };
  }

  public async cancel(
    maker: Signer,
    order: Order
  ): Promise<ContractTransaction> {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any
    ).connect(maker);

    if (order.params.kind?.startsWith("erc721")) {
      return exchange.cancelERC721Order(order.params.nonce);
    } else {
      return exchange.cancelERC1155Order(order.params.nonce);
    }
  }
}

const Erc721OrderAbiType = `(
  uint8 direction,
  address maker,
  address taker,
  uint256 expiry,
  uint256 nonce,
  address erc20Token,
  uint256 erc20TokenAmount,
  (address recipient, uint256 amount, bytes feeData)[] fees,
  address erc721Token,
  uint256 erc721TokenId,
  (address propertyValidator, bytes propertyData)[] erc721TokenProperties
)`;

const Erc1155OrderAbiType = `(
  uint8 direction,
  address maker,
  address taker,
  uint256 expiry,
  uint256 nonce,
  address erc20Token,
  uint256 erc20TokenAmount,
  (address recipient, uint256 amount, bytes feeData)[] fees,
  address erc1155Token,
  uint256 erc1155TokenId,
  (address propertyValidator, bytes propertyData)[] erc1155TokenProperties,
  uint128 erc1155TokenAmount
)`;

const SignatureAbiType = `(
  uint8 signatureType,
  uint8 v,
  bytes32 r,
  bytes32 s
)`;
