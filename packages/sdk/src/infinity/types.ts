import { Order } from "./order";

export type OrderNFTs = {
  collection: string;
  tokens: { tokenId: string; numTokens: number }[];
};

export interface OrderInput {
  isSellOrder: boolean;
  signer: string;
  numItems: number;
  startPrice: string;
  endPrice: string;
  startTime: number;
  endTime: number;
  nonce: string;
  maxGasPrice: string;
  nfts: OrderNFTs[];
  complication: string;
  extraParams: string;
  currency: string;
}

export type InternalOrder = {
  isSellOrder: boolean;
  signer: string;
  constraints: string[];
  nfts: OrderNFTs[];
  execParams: string[];
  extraParams: string;
};

export type SignedOrder = InternalOrder & {
  sig: string;
};

export type TakeOrderParams = {
  order: Order;
  tokens: OrderNFTs[];
};
