import { BaseBuilder, BaseOrderInfo } from "../base";
import { Order } from "../../order";
import * as Types from "../../types";
import { lc, n, s } from "../../../utils";
import { BigNumber, constants } from "ethers/lib/ethers";
import { AssetClass } from "../../types";
import { Constants } from "../..";
import { ORDER_DATA_TYPES } from "../../constants";

export class SingleTokenBuilder extends BaseBuilder {
  public getInfo(order: Order): BaseOrderInfo {
    let side: "sell" | "buy";
    const makeAssetClass = order.params.make.assetType.assetClass;
    const takeAssetClass = order.params.take.assetType.assetClass;
    if (
      (makeAssetClass === Types.AssetClass.ERC721 ||
        makeAssetClass === Types.AssetClass.ERC1155) &&
      (takeAssetClass === Types.AssetClass.ERC20 ||
        takeAssetClass === Types.AssetClass.ETH)
    ) {
      side = "sell";
    } else if (
      makeAssetClass === Types.AssetClass.ERC20 &&
      (takeAssetClass === Types.AssetClass.ERC721 ||
        takeAssetClass === Types.AssetClass.ERC1155)
    ) {
      side = "buy";
    } else {
      throw new Error("Invalid asset class");
    }
    return {
      side,
    };
  }

  public isValid(order: Order): boolean {
    //TODO: Add more validations (used by indexer)
    const { side } = this.getInfo(order);
    try {
      const nftInfo = side === "buy" ? order.params.take : order.params.make;
      const paymentInfo =
        side === "buy" ? order.params.make : order.params.take;

      const copyOrder = this.build({
        maker: order.params.maker,
        side,
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
        salt: order.params.salt,
        startTime: order.params.start,
        endTime: order.params.end,
        tokenAmount: n(nftInfo.value),
        orderType: order.params.type,
        dataType: order.params.data.dataType,
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

    let data:
      | Types.ILegacyOrderData
      | Types.IV1OrderData
      | Types.IV2OrderData
      | Types.IV3OrderBuyData
      | Types.IV3OrderSellData;

    switch (params.dataType) {
      // Can't find info about Legacy type in the contract but it's found in V1 orders that Rarible's API returns
      case ORDER_DATA_TYPES.LEGACY:
        const legacyData: Types.ILegacyOrderData = {
          dataType: ORDER_DATA_TYPES.LEGACY,
          fee: params.fee!,
        };
        data = legacyData;
        break;
      case ORDER_DATA_TYPES.V1:
        const v1Data: Types.IV1OrderData = {
          dataType: ORDER_DATA_TYPES.V1,
          payouts: params.payouts!,
          originFees: params.originFees!,
        };
        data = v1Data;
        break;
      case ORDER_DATA_TYPES.V2:
        const v2Data: Types.IV2OrderData = {
          dataType: ORDER_DATA_TYPES.V2,
          payouts: params.payouts!,
          originFees: params.originFees!,
          isMakeFill: params.isMakeFill!,
        };
        data = v2Data;
        break;
      case ORDER_DATA_TYPES.V3_SELL:
        const v3SellData: Types.IV3OrderSellData = {
          dataType: ORDER_DATA_TYPES.V3_SELL,
          payouts: params.payouts![0]!,
          originFeeFirst: params.originFeeFirst!,
          originFeeSecond: params.originFeeSecond!,
          maxFeesBasePoint: params.maxFeesBasePoint!,
          marketplaceMarker: params.marketplaceMarker!,
        };
        data = v3SellData;
        break;
      case ORDER_DATA_TYPES.V3_BUY:
        const v3BuyData: Types.IV3OrderBuyData = {
          dataType: ORDER_DATA_TYPES.V3_BUY,
          payouts: params.payouts![0]!,
          originFeeFirst: params.originFeeFirst!,
          originFeeSecond: params.originFeeSecond!,
          marketplaceMarker: params.marketplaceMarker!,
        };
        data = v3BuyData;
        break;
      default:
        throw Error("Unknown order data type");
    }

    return new Order(this.chainId, {
      kind: "single-token",
      type: params.orderType,
      maker: params.maker,
      make: params.side === "buy" ? paymentInfo : nftInfo,
      taker: constants.AddressZero,
      take: params.side === "buy" ? nftInfo : paymentInfo,
      salt: s(params.salt),
      start: params.startTime,
      end: params.endTime!,
      data,
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
      data: JSON.parse(JSON.stringify(order.data)),
    };

    // `V3` orders can only be matched if buy-order is `V3_BUY` and the sell-order is `V3_SELL`
    if (order.data.dataType === ORDER_DATA_TYPES.V3_SELL) {
      rightOrder.data.dataType = ORDER_DATA_TYPES.V3_BUY;
    } else if (order.data.dataType === ORDER_DATA_TYPES.V3_BUY) {
      rightOrder.data.dataType = ORDER_DATA_TYPES.V3_SELL;
    }

    // for erc1155 we need to take the value from request (the amount parameter)
    if (AssetClass.ERC1155 == order.make.assetType.assetClass) {
      rightOrder.take.value = Math.floor(Number(data.amount)).toString();
    }

    if (AssetClass.ERC1155 == order.take.assetType.assetClass) {
      const oldValue = rightOrder.make.value;

      rightOrder.make.value = Math.floor(Number(data.amount)).toString();
      rightOrder.take.value = BigNumber.from(rightOrder.take.value).div(
        oldValue - rightOrder.make.value || "1"
      );
    }

    return rightOrder;
  }
}
