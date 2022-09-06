export type OrderKind = "single-token" | "contract-wide";

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

export type MakerOrderParams = {
  kind?: OrderKind;
  isOrderAsk: boolean;
  signer: string;
  collection: string;
  price: string;
  tokenId: string;
  amount: string;
  currency: string;
  nonce: string;
  startTime: number;
  endTime: number;
  minPercentageToAsk: number;
  params: string;
  v?: number;
  r?: string;
  s?: string;
};

export type TakerOrderParams = {
  isOrderAsk: boolean;
  taker: string;
  price: string;
  tokenId: string;
  minPercentageToAsk: number;
  params: string;
};
