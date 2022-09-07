// struct AssetType {
//     bytes4 assetClass;
//     bytes data;
// }

// struct Asset {
//     AssetType assetType;
//     uint value;
// }

// struct Order {
//     address maker;
//     LibAsset.Asset makeAsset;
//     address taker;
//     LibAsset.Asset takeAsset;
//     uint salt;
//     uint start;
//     uint end;
//     bytes4 dataType;
//     bytes data;
// }

// function matchOrders(
//     LibOrder.Order memory orderLeft,
//     bytes memory signatureLeft,
//     LibOrder.Order memory orderRight,
//     bytes memory signatureRight
// )

// function cancel(LibOrder.Order memory order)

type AssetType = {
  assetClass: string;
  data: string;
};

type Asset = {
  assetType: AssetType;
  value: string;
};

type OrderKind = "single-token";

export type Order = {
  kind?: OrderKind;
  maker: string;
  makeAsset: Asset;
  taker: string;
  takeAsset: Asset;
  salt: string;
  start: string;
  end: string;
  dataType: string;
  data: string;
  signature?: string;
};
