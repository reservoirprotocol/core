import { BigNumberish } from "ethers";
import { ORDER_DATA_TYPES, ORDER_TYPES } from "./constants";

export enum AssetClass {
  ERC20 = "ERC20",
  ETH = "ETH",
  ERC721 = "ERC721",
  ERC1155 = "ERC1155",
}

export enum OrderSide {
  BUY,
  SELL,
}

export type AssetType = {
  assetClass: string;
  data: string;
};

export type Asset = {
  assetType: AssetType;
  value: string;
};

export type LocalAssetType = {
  assetClass: string;
  contract?: string;
  tokenId?: string;
};

export type LocalAsset = {
  assetType: LocalAssetType;
  value: string;
};

export type OrderKind = "single-token";

export type Order = {
  kind?: OrderKind;
  type: ORDER_TYPES;
  maker: string;
  make: LocalAsset;
  taker: string;
  take: LocalAsset;
  salt: string;
  start: number;
  end: number;
  data:
    | ILegacyOrderData
    | IV1OrderData
    | IV2OrderData
    | IV3OrderSellData
    | IV3OrderBuyData;
  signature?: string;
};

export interface IPart {
  account: string;
  value: string;
}
export interface ILegacyOrderData {
  dataType: ORDER_DATA_TYPES;
  fee: number;
}
export interface IV1OrderData {
  dataType: ORDER_DATA_TYPES;
  payouts: IPart[];
  originFees: IPart[];
}
export interface IV2OrderData {
  dataType: ORDER_DATA_TYPES;
  payouts: IPart[];
  originFees: IPart[];
  isMakeFill: boolean;
}
export interface IV3OrderSellData {
  dataType: ORDER_DATA_TYPES;
  payouts: IPart;
  originFeeFirst: IPart;
  originFeeSecond: IPart;
  maxFeesBasePoint: number;
  marketplaceMarker: string;
}

export interface IV3OrderBuyData {
  dataType: ORDER_DATA_TYPES;
  payouts: IPart;
  originFeeFirst: IPart;
  originFeeSecond: IPart;
  marketplaceMarker: string;
}

export type TakerOrderParams = {
  type: string;
  maker: string;
  taker: string;
  make: Asset;
  take: Asset;
  salt: number;
  start: number;
  end: number;
  data:
    | ILegacyOrderData
    | IV1OrderData
    | IV2OrderData
    | IV3OrderSellData
    | IV3OrderBuyData;
};

export interface BaseBuildParams {
  orderType: ORDER_TYPES;
  maker: string;
  side: "buy" | "sell";
  tokenKind: "erc721" | "erc1155";
  contract: string;
  tokenId: string;
  tokenAmount?: number;
  price: string;
  paymentToken: string;
  salt?: BigNumberish;
  startTime: number;
  endTime: number;
  dataType: ORDER_DATA_TYPES;
  // Fields below should be based on the data type of the order
  // They are optional currently and we assume they're passed correctly
  // TODO: Validation should be added to ensure correct all params exist and are passed correctly
  originFees?: IPart[];
  payouts?: IPart[];
  originFeeFirst?: IPart;
  originFeeSecond?: IPart;
  isMakeFill?: boolean;
  marketplaceMarker?: string;
  fee?: number;
  maxFeesBasePoint?: number;
}
