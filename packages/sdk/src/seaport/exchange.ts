import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";
import { Contract, ContractTransaction } from "@ethersproject/contracts";
import { keccak256 } from "@ethersproject/solidity";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { bn } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

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

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    matchParams: Types.MatchParams,
    conduitKey = HashZero,
    feesOnTop: {
      amount: string;
      recipient: BigNumberish;
    }[] = []
  ): Promise<ContractTransaction> {
    const info = order.getInfo()!;

    if (info.side === "sell") {
      if (!matchParams.amount || bn(matchParams.amount).eq(1)) {
        // Use "basic" fulfillment
        return this.contract.connect(taker).fulfillBasicOrder(
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
          { value: bn(info.price).add(order.getFeeAmount()) }
        );
      } else {
        // Use "standard" fullfillment
        return this.contract.connect(taker).fulfillAdvancedOrder(
          {
            parameters: {
              ...order.params,
              totalOriginalConsiderationItems:
                order.params.consideration.length,
            },
            numerator: matchParams.amount,
            denominator: info.amount,
            signature: order.params.signature!,
            extraData: "0x",
          },
          [],
          conduitKey,
          {
            value: bn(info.price)
              .add(order.getFeeAmount())
              .mul(matchParams.amount)
              .div(info.amount),
            gasLimit: 1000000,
          }
        );
      }
    } else {
      if (!matchParams.amount || bn(matchParams.amount).eq(1)) {
        // Use "basic" fulfillment
        return this.contract.connect(taker).fulfillBasicOrder({
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
        });
      } else {
        // Use "standard" fulfillment
        return this.contract.connect(taker).fulfillAdvancedOrder(
          {
            parameters: {
              ...order.params,
              totalOriginalConsiderationItems:
                order.params.consideration.length,
            },
            numerator: matchParams.amount,
            denominator: info.amount,
            signature: order.params.signature!,
            extraData: "0x",
          },
          [],
          conduitKey
        );
      }
    }
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
              "0xdd41111aee3f9f5fbd5a2ec5fdd992a682b33f0e9a49bce086cfc12c11d63bcd",
            ]
          ).slice(-40);
  }

  // --- Derive basic sale information ---

  public deriveBasicSale(
    spentItems: Types.SpentItem[],
    receivedItems: Types.ReceivedItem[]
  ) {
    try {
      if (spentItems.length === 1) {
        if (spentItems[0].itemType >= 2) {
          // Listing got filled

          const mainConsideration = receivedItems[0];
          if (mainConsideration.itemType >= 2) {
            throw new Error("Not a basic sale");
          }

          for (let i = 1; i < receivedItems.length; i++) {
            if (
              receivedItems[i].itemType !== mainConsideration.itemType ||
              receivedItems[i].token !== mainConsideration.token
            ) {
              throw new Error("Not a basic sale");
            }
          }

          return {
            contract: spentItems[0].token,
            tokenId: spentItems[0].identifier,
            amount: spentItems[0].amount,
            paymentToken: mainConsideration.token,
            price: receivedItems
              .map((c) => bn(c.amount))
              .reduce((a, b) => a.add(b))
              .toString(),
          };
        } else {
          // Bid got filled

          const mainConsideration = receivedItems[0];
          if (mainConsideration.itemType < 2) {
            throw new Error("Not a basic sale");
          }

          for (let i = 1; i < receivedItems.length; i++) {
            if (
              receivedItems[i].itemType !== spentItems[0].itemType ||
              receivedItems[i].token !== spentItems[0].token
            ) {
              throw new Error("Not a basic sale");
            }
          }

          return {
            contract: mainConsideration.token,
            tokenId: mainConsideration.identifier,
            amount: mainConsideration.amount,
            paymentToken: spentItems[0].token,
            price: spentItems[0].amount,
          };
        }
      }
    } catch {
      return undefined;
    }
  }
}
