import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import {
  BaseBundleBuilder,
  BaseBundleBuildParams,
  BaseBundleOrderInfo,
} from "../base/bundle";
import { BundleOrder } from "../../bundle-order";
import * as Types from "../../types";
import { bn, s } from "../../../utils";

interface BundleAskOrderInfo extends BaseBundleOrderInfo {
  paymentToken: string;
  price: string;
  fees: {
    recipient: string;
    amount: BigNumberish;
  }[];
}

export class BundleAskBuilder extends BaseBundleBuilder {
  constructor(chainId: number) {
    super(chainId);
  }

  public getInfo(order: BundleOrder): BundleAskOrderInfo {
    // By default anyone can fill orders, unless the order is explicitly private
    let taker = AddressZero;

    // Keep track of fees
    const fees: {
      recipient: string;
      amount: BigNumberish;
    }[] = [];

    const o = order.params.offer;
    const c = order.params.consideration;

    // Detect the price and payment token from the first consideration item
    const paymentToken = c[0].token;
    let price = bn(c[0].endAmount);

    // Last `c.length - o.length` consideration items could be reserved for private listings
    const last = c.length - o.length;

    for (let i = 1; i < c.length; i++) {
      // Handle private listings
      if (
        i >= last &&
        c[i].token === o[i - last].token &&
        c[i].identifierOrCriteria === o[i - last].identifierOrCriteria
      ) {
        if (taker !== AddressZero && taker !== c[i].recipient) {
          // Ensure all specified recipients match
          throw new Error("Invalid consideration");
        } else {
          taker = c[i].recipient;
        }
      } else if (c[i].token !== paymentToken) {
        // Ensure all consideration items have the same token
        throw new Error("Invalid consideration");
      } else {
        // Any payment on top of the first consideration is considered a fee
        fees.push({
          recipient: c[i].recipient,
          amount: c[i].startAmount,
        });
      }
    }

    return {
      offerItems: order.params.offer.map((o) => ({
        tokenKind: o.itemType === Types.ItemType.ERC721 ? "erc721" : "erc1155",
        contract: o.token,
        tokenId: o.identifierOrCriteria,
        amount: o.endAmount,
      })),
      considerationItems: order.params.consideration.map((o) => ({
        tokenKind: "erc20",
        contract: o.token,
        tokenId: o.identifierOrCriteria,
        amount: o.endAmount,
      })),
      paymentToken,
      price: s(price),
      fees,
      taker,
    };
  }

  public isValid(order: BundleOrder): boolean {
    try {
      // Extract info from the order
      const info = this.getInfo(order);

      // Build a copy order which is for sure well-formatted
      const copyOrder = this.build({
        ...order.params,
        ...info,
      } as any);

      if (!copyOrder) {
        return false;
      }

      // Ensure the original and the copy orders match
      if (copyOrder.hash() !== order.hash()) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public build(params: BaseBundleBuildParams) {
    this.defaultInitialize(params);

    for (const item of params.offerItems) {
      if (item.tokenKind === "erc20") {
        throw new Error("Unsupported offer item kind");
      }
    }

    const currency = params.considerationItems[0].contract;
    if (currency !== AddressZero) {
      throw new Error("Unsupported currency");
    }

    for (const item of params.considerationItems) {
      if (item.tokenKind !== "erc20") {
        throw new Error("Unsupported consideration item kind");
      }
      if (item.contract !== currency) {
        throw new Error("Non-matching consideration item");
      }
    }

    return new BundleOrder(this.chainId, {
      kind: "bundle-ask",
      offerer: params.offerer,
      zone: params.zone!,
      offer: params.offerItems.map((item) => ({
        itemType:
          item.tokenKind === "erc721"
            ? Types.ItemType.ERC721
            : Types.ItemType.ERC1155,
        token: item.contract,
        identifierOrCriteria: s(item.tokenId),
        startAmount: s(item.tokenKind === "erc1155" ? item.amount ?? 1 : 1),
        endAmount: s(item.tokenKind === "erc1155" ? item.amount ?? 1 : 1),
      })),
      consideration: [
        {
          itemType:
            currency === AddressZero
              ? Types.ItemType.NATIVE
              : Types.ItemType.ERC20,
          token: currency,
          identifierOrCriteria: "0",
          startAmount: s(params.considerationItems[0].amount),
          endAmount: s(params.considerationItems[0].amount),
          recipient: params.offerer,
        },
        ...(params.fees || []).map(({ amount, recipient }) => ({
          itemType:
            currency === AddressZero
              ? Types.ItemType.NATIVE
              : Types.ItemType.ERC20,
          token: currency,
          identifierOrCriteria: "0",
          startAmount: s(amount),
          endAmount: s(amount),
          recipient,
        })),
        ...(params.taker && params.taker !== AddressZero
          ? params.offerItems.map((item) => ({
              itemType:
                item.tokenKind === "erc721"
                  ? Types.ItemType.ERC721
                  : Types.ItemType.ERC1155,
              token: item.contract,
              identifierOrCriteria: s(item.tokenId),
              startAmount: s(
                item.tokenKind === "erc1155" ? item.amount ?? 1 : 1
              ),
              endAmount: s(item.tokenKind === "erc1155" ? item.amount ?? 1 : 1),
              recipient: params.taker!,
            }))
          : []),
      ],
      orderType:
        params.orderType !== undefined
          ? params.orderType
          : (params.zone === AddressZero ? 0 : 2) + Types.OrderType.FULL_OPEN,
      startTime: params.startTime!,
      endTime: params.endTime!,
      zoneHash: params.zoneHash!,
      salt: s(params.salt!),
      conduitKey: params.conduitKey!,
      counter: s(params.counter),
      signature: params.signature,
    });
  }

  public buildMatching(_order: BundleOrder, _data: any) {
    return {};
  }
}
