import {
  Provider,
  TransactionResponse,
} from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import { keccak256 } from "@ethersproject/solidity";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { TxData, bn, lc, n, s } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    matchParams: Types.MatchParams,
    recipient = AddressZero,
    conduitKey = HashZero,
    feesOnTop: {
      amount: string;
      recipient: BigNumberish;
    }[] = []
  ): Promise<TransactionResponse> {
    const tx = this.fillOrderTx(
      await taker.getAddress(),
      order,
      matchParams,
      recipient,
      conduitKey,
      feesOnTop
    );
    return taker.sendTransaction(tx);
  }

  public fillOrderTx(
    taker: string,
    order: Order,
    matchParams: Types.MatchParams,
    recipient = AddressZero,
    conduitKey = HashZero,
    feesOnTop: {
      amount: string;
      recipient: BigNumberish;
    }[] = []
  ): TxData {
    const info = order.getInfo()!;

    if (info.side === "sell") {
      if (
        recipient === AddressZero &&
        (!matchParams.amount || bn(matchParams.amount).eq(1)) &&
        !matchParams.criteriaResolvers
      ) {
        // Use "basic" fulfillment
        return {
          from: taker,
          to: this.contract.address,
          data: this.contract.interface.encodeFunctionData(
            "fulfillBasicOrder",
            [
              {
                considerationToken: info.paymentToken,
                considerationIdentifier: "0",
                considerationAmount: info.price,
                offerer: order.params.offerer,
                zone: order.params.zone,
                offerToken: info.contract,
                offerIdentifier: info.tokenId,
                offerAmount: info.amount,
                basicOrderType:
                  (info.tokenKind === "erc721"
                    ? Types.BasicOrderType.ETH_TO_ERC721_FULL_OPEN
                    : Types.BasicOrderType.ETH_TO_ERC1155_FULL_OPEN) +
                  order.params.orderType,
                startTime: order.params.startTime,
                endTime: order.params.endTime,
                zoneHash: order.params.zoneHash,
                salt: order.params.salt,
                offererConduitKey: order.params.conduitKey,
                fulfillerConduitKey: conduitKey,
                totalOriginalAdditionalRecipients:
                  order.params.consideration.length - 1,
                additionalRecipients: [
                  ...order.params.consideration
                    .slice(1)
                    .map(({ startAmount, recipient }) => ({
                      amount: startAmount,
                      recipient,
                    })),
                  ...feesOnTop,
                ],
                signature: order.params.signature!,
              },
            ]
          ),
          value: bn(order.getMatchingPrice()).toHexString(),
        };
      } else {
        // Use "standard" fullfillment
        return {
          from: taker,
          to: this.contract.address,
          data: this.contract.interface.encodeFunctionData(
            "fulfillAdvancedOrder",
            [
              {
                parameters: {
                  ...order.params,
                  totalOriginalConsiderationItems:
                    order.params.consideration.length,
                },
                numerator: matchParams.amount || "1",
                denominator: info.amount,
                signature: order.params.signature!,
                extraData: "0x",
              },
              matchParams.criteriaResolvers || [],
              conduitKey,
              recipient,
            ]
          ),
          value: bn(order.getMatchingPrice())
            .mul(matchParams.amount || "1")
            .div(info.amount)
            .toHexString(),
        };
      }
    } else {
      if (
        recipient === AddressZero &&
        (!matchParams.amount || bn(matchParams.amount).eq(1)) &&
        !matchParams.criteriaResolvers
      ) {
        // Use "basic" fulfillment
        return {
          from: taker,
          to: this.contract.address,
          data: this.contract.interface.encodeFunctionData(
            "fulfillBasicOrder",
            [
              {
                considerationToken: info.contract,
                considerationIdentifier: info.tokenId,
                considerationAmount: info.amount,
                offerer: order.params.offerer,
                zone: order.params.zone,
                offerToken: info.paymentToken,
                offerIdentifier: "0",
                offerAmount: info.price,
                basicOrderType:
                  (info.tokenKind === "erc721"
                    ? Types.BasicOrderType.ERC721_TO_ERC20_FULL_OPEN
                    : Types.BasicOrderType.ERC1155_TO_ERC20_FULL_OPEN) +
                  order.params.orderType,
                startTime: order.params.startTime,
                endTime: order.params.endTime,
                zoneHash: order.params.zoneHash,
                salt: order.params.salt,
                offererConduitKey: order.params.conduitKey,
                fulfillerConduitKey: conduitKey,
                totalOriginalAdditionalRecipients:
                  order.params.consideration.length - 1,
                additionalRecipients: [
                  ...order.params.consideration
                    .slice(1)
                    .map(({ startAmount, recipient }) => ({
                      amount: startAmount,
                      recipient,
                    })),
                  ...feesOnTop,
                ],
                signature: order.params.signature!,
              },
            ]
          ),
        };
      } else {
        // Use "standard" fulfillment
        return {
          from: taker,
          to: this.contract.address,
          data: this.contract.interface.encodeFunctionData(
            "fulfillAdvancedOrder",
            [
              {
                parameters: {
                  ...order.params,
                  totalOriginalConsiderationItems:
                    order.params.consideration.length,
                },
                numerator: matchParams.amount || "1",
                denominator: info.amount,
                signature: order.params.signature!,
                extraData: "0x",
              },
              matchParams.criteriaResolvers || [],
              conduitKey,
              recipient,
            ]
          ),
        };
      }
    }
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
    return this.contract.connect(provider).getCounter(user);
  }

  // --- Derive conduit from key ---

  public deriveConduit(conduitKey: string) {
    return conduitKey === HashZero
      ? Addresses.Exchange[this.chainId]
      : "0x" +
          keccak256(
            ["bytes1", "address", "bytes32", "bytes32"],
            [
              "0xff",
              Addresses.ConduitController[this.chainId],
              conduitKey,
              // https://github.com/ProjectOpenSea/seaport/blob/0a8e82ce7262b5ce0e67fa98a2131fd4c47c84e9/contracts/conduit/ConduitController.sol#L493
              "0x023d904f2503c37127200ca07b976c3a53cc562623f67023115bf311f5805059",
            ]
          ).slice(-40);
  }

  // --- Derive basic sale information ---

  public deriveBasicSale(
    spentItems: Types.SpentItem[],
    receivedItems: Types.ReceivedItem[]
  ) {
    // Normalize
    const nSpentItems: Types.SpentItem[] = [];
    for (const spentItem of spentItems) {
      nSpentItems.push({
        itemType: n(spentItem.itemType),
        token: lc(spentItem.token),
        identifier: s(spentItem.identifier),
        amount: s(spentItem.amount),
      });
    }
    const nReceivedItems: Types.ReceivedItem[] = [];
    for (const receivedItem of receivedItems) {
      nReceivedItems.push({
        itemType: n(receivedItem.itemType),
        token: lc(receivedItem.token),
        identifier: s(receivedItem.identifier),
        amount: s(receivedItem.amount),
        recipient: lc(receivedItem.recipient),
      });
    }

    try {
      if (nSpentItems.length === 1) {
        if (nSpentItems[0].itemType >= 2) {
          // Listing got filled

          const mainConsideration = nReceivedItems[0];
          if (mainConsideration.itemType >= 2) {
            throw new Error("Not a basic sale");
          }

          for (let i = 1; i < nReceivedItems.length; i++) {
            if (
              nReceivedItems[i].itemType !== mainConsideration.itemType ||
              nReceivedItems[i].token !== mainConsideration.token
            ) {
              throw new Error("Not a basic sale");
            }
          }

          return {
            contract: nSpentItems[0].token,
            tokenId: nSpentItems[0].identifier,
            amount: nSpentItems[0].amount,
            paymentToken: mainConsideration.token,
            price: nReceivedItems
              .map((c) => bn(c.amount))
              .reduce((a, b) => a.add(b))
              .toString(),
          };
        } else {
          // Bid got filled

          const mainConsideration = nReceivedItems[0];
          if (mainConsideration.itemType < 2) {
            throw new Error("Not a basic sale");
          }

          for (let i = 1; i < nReceivedItems.length; i++) {
            if (
              nReceivedItems[i].itemType !== nSpentItems[0].itemType ||
              nReceivedItems[i].token !== nSpentItems[0].token
            ) {
              throw new Error("Not a basic sale");
            }
          }

          return {
            contract: mainConsideration.token,
            tokenId: mainConsideration.identifier,
            amount: mainConsideration.amount,
            paymentToken: nSpentItems[0].token,
            price: nSpentItems[0].amount,
          };
        }
      }
    } catch {
      return undefined;
    }
  }
}
