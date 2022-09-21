import { BaseBuilder } from "../base";
import { Order } from "../../order";
import * as Types from "../../types";
import { lc, n, s } from "../../../utils";
import { BigNumber, constants } from "ethers/lib/ethers";
import { AssetClass } from "../../types";
import { Constants } from "../..";

export class SingleTokenBuilder extends BaseBuilder {
  public isValid(order: Order): boolean {
    //TODO: Add more validations (used by indexer)
    try {
      const nftInfo =
        order.params.side === 0 ? order.params.take : order.params.make;
      const paymentInfo =
        order.params.side === 0 ? order.params.make : order.params.take;

      const copyOrder = this.build({
        maker: order.params.maker,
        side: order.params.side === 0 ? "buy" : "sell",
        tokenKind:
          nftInfo.assetType.assetClass === AssetClass.ERC721
            ? "erc721"
            : "erc1155",
        contract: lc(nftInfo.assetType.contract!),
        tokenId: nftInfo.assetType.tokenId!,
        price: paymentInfo.value,
        paymentToken:
          paymentInfo.assetType.assetClass === AssetClass.ETH
            ? constants.AddressZero
            : lc(paymentInfo.assetType.contract!),
        salt: n(order.params.salt),
        startTime: order.params.start,
        endTime: order.params.end,
        signature: order.params.signature,
        tokenAmount: n(nftInfo.value),
        revenueSplits: order.params.data.revenueSplits || [],
      });

      if (!copyOrder) {
        return false;
      }

      if (copyOrder.hashOrderKey() !== order.hashOrderKey()) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public build(params: Types.BaseBuildParams) {
    this.defaultInitialize(params);
    const nftInfo = {
      assetType: {
        assetClass: params.tokenKind.toUpperCase(),
        contract: lc(params.contract),
        tokenId: params.tokenId,
      },
      value: s(params.tokenAmount || 1),
    };

    const paymentInfo = {
      assetType: {
        ...(params.paymentToken && params.paymentToken !== constants.AddressZero
          ? {
              assetClass: AssetClass.ERC20,
              contract: lc(params.paymentToken),
            }
          : {
              assetClass: AssetClass.ETH,
            }),
      },
      value: params.price,
    };
    return new Order(this.chainId, {
      kind: "single-token",
      //TODO: Extract this to a constant
      type: "UNIVERSE_V1",
      side: params.side === "buy" ? 0 : 1,
      maker: params.maker,
      make: params.side === "buy" ? paymentInfo : nftInfo,
      taker: constants.AddressZero,
      take: params.side === "buy" ? nftInfo : paymentInfo,
      salt: s(params.salt),
      start: params.startTime,
      end: params.endTime!,
      data: {
        dataType: params.revenueSplits?.length
          ? Constants.ORDER_DATA
          : Constants.DATA_TYPE_0X,
        revenueSplits: params.revenueSplits || [],
      },
      signature: params?.signature,
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
        dataType: order.data.revenueSplits?.length
          ? Constants.ORDER_DATA
          : Constants.DATA_TYPE_0X,
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
        oldValue - rightOrder.make.value || "1"
      );
    }

    return rightOrder;
  }
}
