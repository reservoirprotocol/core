export enum AssetClass {
  ERC20 = "ERC20",
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
  hash: string;
  type: string;
  side: OrderSide;
  maker: string;
  make: LocalAsset;
  taker: string;
  take: LocalAsset;
  salt: string;
  start: string;
  end: string;
  data: IOrderData;
  signature: string;
  fill?: string;
  makeStock: string;
  makeBalance: string;
};

export interface IPart {
  account: string;
  value: string;
}

export interface IOrderData {
  dataType?: string;
  revenueSplits?: IPart[];
}

export type TakerOrderParams = {
  type: string;
  maker: string;
  taker: string;
  make: Asset;
  take: Asset;
  salt: number;
  start: string;
  end: string;
  data: IOrderData;
};
