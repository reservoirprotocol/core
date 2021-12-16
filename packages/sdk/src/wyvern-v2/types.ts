export enum OrderHowToCall {
  CALL,
  DELEGATE_CALL,
}

export enum OrderSaleKind {
  FIXED_PRICE,
  DUTCH_AUCTION,
}

export enum OrderSide {
  BUY,
  SELL,
}

export type OrderKind =
  | "erc721-single-token"
  | "erc721-token-range"
  | "erc1155-single-token";

export type OrderParams = {
  kind?: OrderKind;
  exchange: string;
  maker: string;
  taker: string;
  makerRelayerFee: number;
  takerRelayerFee: number;
  feeRecipient: string;
  side: OrderSide;
  saleKind: OrderSaleKind;
  target: string;
  howToCall: OrderHowToCall;
  calldata: string;
  replacementPattern: string;
  staticTarget: string;
  staticExtradata: string;
  paymentToken: string;
  basePrice: string;
  extra: string;
  listingTime: number;
  expirationTime: number;
  salt: string;
  v?: number;
  r?: string;
  s?: string;
};
