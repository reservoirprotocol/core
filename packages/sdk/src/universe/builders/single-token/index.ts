import { BaseBuilder } from "../base";
import { Order } from "../../order";
import * as Types from "../../types";
import { BytesEmpty, lc, s } from "../../../utils";
import { BigNumber, constants, utils } from "ethers/lib/ethers";
import { REPL_MODE_STRICT } from "repl";
import { AssetClass } from "../../types";

export class SingleTokenBuilder extends BaseBuilder {
  public isValid(order: Order): boolean {
    try {
      const copyOrder = this.build({
        ...order.params,
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

  public build(params: Types.Order) {
    this.defaultInitialize(params);
    //TODO: Add partial filling logic in the future

    return new Order(this.chainId, {
      kind: "single-token",
      side: params.side,
      hash: params.hash,
      maker: lc(params.maker),
      make: {
        assetType: {
          assetClass: params.make.assetType.assetClass,
          ...(params.make.assetType.contract && {
            contract: lc(params.make.assetType.contract),
          }),
          ...(params.make.assetType.tokenId && {
            tokenId: params.make.assetType.tokenId,
          }),
        },
        value: params.make.value,
      },
      taker: lc(params.taker),
      take: {
        assetType: {
          assetClass: params.take.assetType.assetClass,
          ...(params.take.assetType.contract && {
            contract: lc(params.take.assetType.contract),
          }),
          ...(params.take.assetType.tokenId && {
            tokenId: params.take.assetType.tokenId,
          }),
        },
        value: params.take.value,
      },
      salt: params.salt,
      start: params.start!,
      end: params.end!,
      type: params.type,
      data: params.data,
      signature: params?.signature,
      makeBalance: params.makeBalance,
      makeStock: params.makeStock,
    });
  }

  public buildMatching(
    order: Types.Order,
    taker: string,
    data: { amount?: string }
  ) {
    const rightOrder = {
      type: order.type,
      maker: taker,
      taker: constants.AddressZero,
      make: JSON.parse(JSON.stringify(order.take)),
      take: JSON.parse(JSON.stringify(order.make)),
      salt: 0,
      start: order.start,
      end: order.end,
      data: {
        dataType: order.data.revenueSplits?.length ? "ORDER_DATA" : "0x",
        revenueSplits: order.data.revenueSplits || [],
      },
    };

    // for erc1155 we need to take the value from request (the amount parameter)
    if (AssetClass.ERC1155 == order.make.assetType.assetClass) {
      const availableAmount = Number(order.make.value) - Number(order.fill);
      if (
        Math.floor(Number(data.amount)) < 1 ||
        Math.floor(Number(data.amount)) > availableAmount
      ) {
        throw new Error("invalid-fill-amount");
      }

      rightOrder.take.value = Math.floor(Number(data.amount)).toString();
    }

    if (AssetClass.ERC1155 == order.take.assetType.assetClass) {
      const availableAmount = Number(order.take.value) - Number(order.fill);
      if (
        Math.floor(Number(data.amount)) < 1 ||
        Math.floor(Number(data.amount)) > availableAmount
      ) {
        throw new Error("invalid-fill-amount");
      }
      const oldValue = rightOrder.make.value;

      rightOrder.make.value = Math.floor(Number(data.amount)).toString();
      rightOrder.take.value = BigNumber.from(rightOrder.take.value).div(
        oldValue - rightOrder.make.value
      );
    }

    return rightOrder;
  }
}
