export enum HowToCall {
  CALL,
  DELEGATE_CALL,
}

export enum SaleKind {
  FIXED_PRICE,
  DUTCH_AUCTION,
}

export enum Side {
  BUY,
  SELL,
}

export type Order = {
  exchange: string;
  maker: string;
  taker: string;
  makerRelayerFee: number;
  takerRelayerFee: number;
  feeRecipient: string;
  side: Side;
  saleKind: SaleKind;
  target: string;
  howToCall: HowToCall;
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
