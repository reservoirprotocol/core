import { utils } from "ethers";
import { Constants, Types } from "..";
import { lc } from "../../utils";
import { ORDER_DATA_TYPES } from "../constants";
import { Asset, IPart, LocalAssetType } from "../types";

export const encodeAsset = (token?: string, tokenId?: string) => {
  if (tokenId) {
    return utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [token, tokenId]
    );
  } else if (token) {
    return utils.defaultAbiCoder.encode(["address"], [token]);
  } else {
    return "0x";
  }
};

export const encodeBundle = (tokenAddresses: string[], tokenIds: any) => {
  const toEncode = tokenAddresses.map((token, index) => {
    return [token, tokenIds[index]];
  });
  return utils.defaultAbiCoder.encode(
    ["tuple(address,uint256[])[]"],
    [toEncode]
  );
};

export const encodeAssetData = (assetType: LocalAssetType) => {
  return encodeAsset(assetType.contract, assetType.tokenId);
};

export const encodeAssetClass = (assetClass: string) => {
  if (!assetClass) {
    return "0xffffffff";
  }

  return utils.keccak256(utils.toUtf8Bytes(assetClass)).substring(0, 10);
};

export const encodeV2OrderData = (payments: IPart[]) => {
  if (!payments) {
    return [];
  }
  return payments;
};

// V3 Order Data fields are encoded in a special way. From Rarible's docs:
// - `uint payouts`, `uint originFeeFirst`, `uint originFeeSecond`, work the same as in `V1` orders, but there is only 1 value
// and address + amount are encoded into uint (first 12 bytes for amount, last 20 bytes for address), not using `LibPart.Part` struct
export const encodeV3OrderData = (part: IPart) => {
  if (!part) {
    return utils.defaultAbiCoder.encode(["uint"], ["0"]);
  }

  const { account, value } = part;
  const uint96EncodedValue = utils.solidityPack(["uint96"], [value]);
  const encodedData = `${uint96EncodedValue}${account.slice(2)}`;

  // -- DEBUG -- //
  // console.log(part);
  // console.log(encodedValue);
  // const encodedAddress = utils.defaultAbiCoder.encode(["address"], [account]);
  // console.log(encodedAddress);
  // console.log(final);
  // // -- DEBUG -- //
  return encodedData;
};

export const encodeOrderData = (
  order: Types.Order | Types.TakerOrderParams
) => {
  let encodedOrderData = "";

  switch (order.data.dataType) {
    case ORDER_DATA_TYPES.V1:
      const v1Data = order.data as Types.IV1OrderData;

      encodedOrderData = utils.defaultAbiCoder.encode(
        [
          "tuple(address account,uint96 value)[] payouts",
          "tuple(address account,uint96 value)[] originFees",
        ],
        [
          encodeV2OrderData(v1Data.payouts),
          encodeV2OrderData(v1Data.originFees),
        ]
      );
      break;
    case Constants.ORDER_DATA_TYPES.V2:
      const v2Data = order.data as Types.IV2OrderData;

      encodedOrderData = utils.defaultAbiCoder.encode(
        [
          "tuple(address account,uint96 value)[] payouts",
          "tuple(address account,uint96 value)[] originFees",
          "bool isMakeFill",
        ],
        [
          encodeV2OrderData(v2Data.payouts),
          encodeV2OrderData(v2Data.originFees),
          v2Data.isMakeFill,
        ]
      );
      break;
    case Constants.ORDER_DATA_TYPES.V3_SELL:
      const v3SellData = order.data as Types.IV3OrderSellData;

      encodedOrderData = utils.defaultAbiCoder.encode(
        [
          "uint payouts",
          "uint originFeeFirst",
          "uint originFeeSecond",
          "uint maxFeesBasePoint",
          "bytes32 marketplaceMarker",
        ],
        [
          encodeV3OrderData(v3SellData.payouts),
          encodeV3OrderData(v3SellData.originFeeFirst),
          encodeV3OrderData(v3SellData.originFeeSecond),
          // TODO: Think of how to generate when maxFeesBasePoint is not passed in case of buy orders
          v3SellData.maxFeesBasePoint || "1000",
          utils.keccak256(utils.toUtf8Bytes(v3SellData.marketplaceMarker)),
        ]
      );

      break;
    case Constants.ORDER_DATA_TYPES.V3_BUY:
      const v3BuyData = order.data as Types.IV3OrderBuyData;

      encodedOrderData = utils.defaultAbiCoder.encode(
        [
          "uint payouts",
          "uint originFeeFirst",
          "uint originFeeSecond",
          "bytes32 marketplaceMarker",
        ],
        [
          encodeV3OrderData(v3BuyData.payouts),
          encodeV3OrderData(v3BuyData.originFeeFirst),
          encodeV3OrderData(v3BuyData.originFeeSecond),
          utils.keccak256(utils.toUtf8Bytes(v3BuyData.marketplaceMarker)),
        ]
      );
      break;
    default:
      throw Error("Unknown rarible order type");
  }

  return utils.keccak256(encodedOrderData);
};

export const hashAssetType = (assetType: LocalAssetType) => {
  const assetTypeData = encodeAssetData(assetType);
  const encodedAssetType = utils.defaultAbiCoder.encode(
    ["bytes32", "bytes4", "bytes32"],
    [
      utils.keccak256(
        utils.toUtf8Bytes("AssetType(bytes4 assetClass,bytes data)")
      ),
      encodeAssetClass(assetType.assetClass),
      utils.keccak256(assetTypeData),
    ]
  );
  return utils.keccak256(encodedAssetType);
};

export const hashAsset = (asset: Asset) => {
  const encodedAsset = utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32", "uint256"],
    [
      utils.keccak256(
        utils.toUtf8Bytes(
          "Asset(AssetType assetType,uint256 value)AssetType(bytes4 assetClass,bytes data)"
        )
      ),
      hashAssetType(asset.assetType),
      asset.value,
    ]
  );
  return utils.keccak256(encodedAsset);
};

/**
 * Encode Order object for contract calls
 * @param order
 * @returns encoded order which is ready to be signed
 */
export const encodeForContract = (
  order: Types.Order,
  matchingOrder?: Types.TakerOrderParams
) => {
  if (!matchingOrder) {
    return {
      maker: order.maker,
      makeAsset: {
        assetType: {
          assetClass: encodeAssetClass(order.make.assetType.assetClass),
          data: encodeAssetData(order.make.assetType),
        },
        value: order.make.value,
      },
      taker: order.taker,
      takeAsset: {
        assetType: {
          assetClass: encodeAssetClass(order.take.assetType.assetClass),
          data: encodeAssetData(order.take.assetType),
        },
        value: order.take.value,
      },
      salt: order.salt,
      start: order.start,
      end: order.end,
      dataType: encodeAssetClass(order.data?.dataType!),
      data: encodeOrderData(order),
    };
  }

  let encodedOrder: Types.AcceptBid | Types.Purchase;
  switch (order.side) {
    case "buy":
      const bid: Types.AcceptBid = {
        bidMaker: order.maker,
        bidNftAmount: order.take.value,
        nftAssetClass: encodeAssetClass(order.take.assetType.assetClass),
        nftData: encodeAssetData(order.take.assetType),
        bidPaymentAmount: order.make.value,
        paymentToken: order.make.assetType.contract!,
        bidSalt: order.salt,
        bidStart: order.start,
        bidEnd: order.end,
        bidDataType: encodeAssetClass(order.data?.dataType!),
        bidData: encodeOrderData(order),
        bidSignature: order.signature!,
        sellOrderPaymentAmount: matchingOrder.take.value,
        sellOrderNftAmount: Number(matchingOrder.make.value),
        sellOrderData: encodeOrderData(matchingOrder),
      };
      encodedOrder = bid;
      break;
    case "sell":
      const purchase: Types.Purchase = {
        sellOrderMaker: order.maker,
        sellOrderNftAmount: order.make.value,
        nftAssetClass: encodeAssetClass(order.make.assetType.assetClass),
        nftData: encodeAssetData(order.make.assetType),
        sellOrderPaymentAmount: order.take.value,
        paymentToken: order.take.assetType.contract!,
        sellOrderSalt: order.salt,
        sellOrderStart: order.start,
        sellOrderEnd: order.end,
        sellOrderDataType: encodeAssetClass(order.data?.dataType!),
        sellOrderData: encodeOrderData(order),
        sellOrderSignature: order.signature!,
        buyOrderPaymentAmount: matchingOrder.make.value,
        buyOrderNftAmount: Number(matchingOrder.take.value),
        buyOrderData: encodeOrderData(matchingOrder),
      };
      encodedOrder = purchase;
      break;
    default:
      throw Error("Unknown order side");
  }

  return encodedOrder!;
};

/**
 * Encode Order object for contract calls
 * @param order
 * @returns encoded order which is ready to be signed
 */
export const encodeForSigning = (order: Types.Order) => {
  return {
    maker: order.maker,
    makeAsset: {
      assetType: {
        assetClass: encodeAssetClass(order.make.assetType.assetClass),
        data: encodeAssetData(order.make.assetType),
      },
      value: order.make.value,
    },
    taker: order.taker,
    takeAsset: {
      assetType: {
        assetClass: encodeAssetClass(order.take.assetType.assetClass),
        data: encodeAssetData(order.take.assetType),
      },
      value: order.take.value,
    },
    salt: order.salt,
    start: order.start,
    end: order.end,
    dataType: encodeAssetClass(order.data?.dataType!),
    data: encodeOrderData(order),
  };
};
