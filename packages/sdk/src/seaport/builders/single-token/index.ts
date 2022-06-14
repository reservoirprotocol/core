import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";

import { BaseBuildParams, BaseBuilder, BaseOrderInfo } from "../base";
import { Order } from "../../order";
import * as Types from "../../types";
import * as CommonAddresses from "../../../common/addresses";
import { bn, s } from "../../../utils";

interface BuildParams extends BaseBuildParams {
  tokenId: BigNumberish;
  amount?: BigNumberish;
}

export class SingleTokenBuilder extends BaseBuilder {
  public getInfo(order: Order): BaseOrderInfo | undefined {
    try {
      // Offer should always consists of a single item
      if (order.params.offer.length !== 1) {
        throw new Error("Invalid offer");
      }
      if (order.params.consideration.length < 1) {
        throw new Error("Invalid consideration");
      }

      const offerItem = order.params.offer[0];

      let side: "sell" | "buy";
      if (
        offerItem.itemType === Types.ItemType.ERC721 ||
        offerItem.itemType === Types.ItemType.ERC1155
      ) {
        side = "sell";
      } else if (offerItem.itemType === Types.ItemType.ERC20) {
        side = "buy";
      } else {
        throw new Error("Invalid item");
      }

      if (side === "sell") {
        // The offer item is the sold token
        const tokenKind =
          offerItem.itemType === Types.ItemType.ERC721 ? "erc721" : "erc1155";
        const contract = offerItem.token;
        const tokenId = offerItem.identifierOrCriteria;
        const amount = offerItem.startAmount;

        // Ensure all consideration items match
        const fees: {
          recipient: string;
          amount: BigNumberish;
        }[] = [];
        const paymentToken = order.params.consideration[0].token;
        let price = bn(order.params.consideration[0].startAmount);
        for (let i = 1; i < order.params.consideration.length; i++) {
          const consideration = order.params.consideration[i];
          if (consideration.token !== paymentToken) {
            throw new Error("Invalid consideration");
          }
          fees.push({
            recipient: consideration.recipient,
            amount: consideration.startAmount,
          });
        }

        return {
          tokenKind,
          side,
          contract,
          tokenId,
          amount,
          paymentToken,
          price: s(price),
          fees,
        };
      } else {
        const paymentToken = offerItem.token;
        const price = offerItem.startAmount;

        // The first consideration item is the bought token
        const item = order.params.consideration[0];

        // The other items in the consideration are the fees
        const fees: {
          recipient: string;
          amount: BigNumberish;
        }[] = [];
        for (let i = 1; i < order.params.consideration.length; i++) {
          const consideration = order.params.consideration[i];
          if (i > 1 && consideration.token !== paymentToken) {
            throw new Error("Invalid consideration");
          }
          fees.push({
            recipient: consideration.recipient,
            amount: consideration.startAmount,
          });
        }

        const tokenKind =
          item.itemType === Types.ItemType.ERC721 ? "erc721" : "erc1155";
        const contract = item.token;
        const tokenId = item.identifierOrCriteria;
        const amount = item.startAmount;

        return {
          tokenKind,
          side,
          contract,
          tokenId,
          amount,
          paymentToken,
          price,
          fees,
        };
      }
    } catch {
      return undefined;
    }
  }

  public isValid(order: Order): boolean {
    try {
      const copyOrder = this.build({
        ...order.params,
        ...this.getInfo(order)!,
      });
      if (!copyOrder) {
        return false;
      }

      if (copyOrder.hash() !== order.hash()) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public build(params: BuildParams) {
    this.defaultInitialize(params);

    if (params.side === "sell") {
      return new Order(this.chainId, {
        kind: "single-token",
        offerer: params.offerer,
        zone: params.zone!,
        offer: [
          {
            itemType:
              params.tokenKind === "erc721"
                ? Types.ItemType.ERC721
                : Types.ItemType.ERC1155,
            token: params.contract,
            identifierOrCriteria: s(params.tokenId),
            startAmount: s(
              params.tokenKind === "erc1155" ? params.amount ?? 1 : 1
            ),
            endAmount: s(
              params.tokenKind === "erc1155" ? params.amount ?? 1 : 1
            ),
          },
        ],
        consideration: [
          {
            itemType: Types.ItemType.NATIVE,
            token: CommonAddresses.Eth[this.chainId],
            identifierOrCriteria: "0",
            startAmount: s(params.price),
            endAmount: s(params.price),
            recipient: params.offerer,
          },
          ...(params.fees || []).map(({ amount, recipient }) => ({
            itemType: Types.ItemType.NATIVE,
            token: CommonAddresses.Eth[this.chainId],
            identifierOrCriteria: "0",
            startAmount: s(amount),
            endAmount: s(amount),
            recipient,
          })),
        ],
        orderType:
          params.tokenKind === "erc1155" && bn(params.amount ?? 1).gt(1)
            ? Types.OrderType.PARTIAL_OPEN
            : Types.OrderType.FULL_OPEN,
        startTime: params.startTime!,
        endTime: params.endTime!,
        zoneHash: HashZero,
        salt: s(params.salt!),
        conduitKey: HashZero,
        counter: s(params.counter),
        signature: params.signature,
      });
    } else {
      return new Order(this.chainId, {
        kind: "single-token",
        offerer: params.offerer,
        zone: params.zone!,
        offer: [
          {
            itemType: Types.ItemType.ERC20,
            token: params.paymentToken,
            identifierOrCriteria: "0",
            startAmount: s(params.price),
            endAmount: s(params.price),
          },
        ],
        consideration: [
          {
            itemType:
              params.tokenKind === "erc721"
                ? Types.ItemType.ERC721
                : Types.ItemType.ERC1155,
            token: params.contract,
            identifierOrCriteria: s(params.tokenId),
            startAmount: s(
              params.tokenKind === "erc1155" ? params.amount ?? 1 : 1
            ),
            endAmount: s(
              params.tokenKind === "erc1155" ? params.amount ?? 1 : 1
            ),
            recipient: params.offerer,
          },
          ...(params.fees || []).map(({ amount, recipient }) => ({
            itemType: Types.ItemType.ERC20,
            token: params.paymentToken,
            identifierOrCriteria: "0",
            startAmount: s(amount),
            endAmount: s(amount),
            recipient,
          })),
        ],
        orderType:
          params.tokenKind === "erc1155" && bn(params.amount ?? 1).gt(1)
            ? Types.OrderType.PARTIAL_OPEN
            : Types.OrderType.FULL_OPEN,
        startTime: params.startTime!,
        endTime: params.endTime!,
        zoneHash: HashZero,
        salt: s(params.salt!),
        conduitKey: HashZero,
        counter: s(params.counter),
        signature: params.signature,
      });
    }
  }

  public buildMatching(_order: Order, data?: { amount?: BigNumberish }) {
    return {
      amount: data?.amount ? s(data.amount) : undefined,
    };
  }
}
