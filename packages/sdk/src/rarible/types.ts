// struct AssetType {
//     bytes4 assetClass;
//     bytes data;
// }
type AssetType = {
  assetClass: string;
  data: string;
};

// struct Asset {
//     AssetType assetType;
//     uint value;
// }
type Asset = {
  assetType: AssetType;
  value: string;
};

type OrderKind = "single-token";

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
