import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";

import { Order } from "../../order";
import * as Types from "../../types";
import * as CommonAddresses from "../../../common/addresses";
import { bn, getCurrentTimestamp, getRandomBytes, s } from "../../../utils";

interface BuildParams {
  offerer: string;
  side: "sell";
  items: {
    tokenKind: "erc721" | "erc1155";
    contract: string;
    tokenId: string;
    amount?: string;
  }[];
  price: BigNumberish;
  paymentToken: string;
  counter: BigNumberish;
  fees?: {
    recipient: string;
    amount: BigNumberish;
  }[];
  taker?: string;
  orderType?: number;
  zone?: string;
  zoneHash?: string;
  conduitKey?: string;
  salt?: BigNumberish;
  startTime?: number;
  endTime?: number;
  signature?: string;
}

export interface BundleOrderInfo {
  items: {
    tokenKind: "erc721" | "erc1155";
    contract: string;
    tokenId: string;
    amount: string;
  }[];
  amount: 1;
  side: "sell" | "buy";
  taker: string;
  paymentToken: string;
  price: string;
  fees: {
    recipient: string;
    amount: BigNumberish;
  }[];
}

export class BundleBuilder {
  public chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  private defaultInitialize(params: BuildParams) {
    // Default listing time is 5 minutes in the past to allow for any
    // time discrepancies when checking the order's validity on-chain
    params.startTime = params.startTime ?? getCurrentTimestamp(-5 * 60);
    params.endTime = params.endTime ?? 0;
    params.conduitKey = params.conduitKey ?? HashZero;
    params.zone = params.zone ?? AddressZero;
    params.zoneHash = params.zoneHash ?? HashZero;
    params.salt = params.salt ?? getRandomBytes();
    params.signature = params.signature ?? HashZero;
    params.taker = params.taker ?? AddressZero;
  }

  public getInfo(order: Order): BundleOrderInfo {
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
      items: o.map((o) => ({
        tokenKind: o.itemType === Types.ItemType.ERC721 ? "erc721" : "erc1155",
        contract: o.token,
        tokenId: o.identifierOrCriteria,
        amount: o.endAmount,
      })),
      amount: 1,
      side: "sell",
      paymentToken,
      price: s(price),
      fees,
      taker,
    };
  }

  public isValid(order: Order): boolean {
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

  public build(params: BuildParams) {
    this.defaultInitialize(params);

    if (params.side === "sell") {
      return new Order(this.chainId, {
        kind: "bundle",
        offerer: params.offerer,
        zone: params.zone!,
        offer: params.items.map((item) => ({
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
          ...(params.taker && params.taker !== AddressZero
            ? params.items.map((item) => ({
                itemType:
                  item.tokenKind === "erc721"
                    ? Types.ItemType.ERC721
                    : Types.ItemType.ERC1155,
                token: item.contract,
                identifierOrCriteria: s(item.tokenId),
                startAmount: s(
                  item.tokenKind === "erc1155" ? item.amount ?? 1 : 1
                ),
                endAmount: s(
                  item.tokenKind === "erc1155" ? item.amount ?? 1 : 1
                ),
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
    } else {
      throw new Error("Invalid side");
    }
  }

  public buildMatching(_order: Order, _data: any) {
    return {};
  }
}
