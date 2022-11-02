export type OrderKind =
  | "erc721-single-token"
  | "erc1155-single-token"
  | "erc721-contract-wide"
  | "erc1155-contract-wide"
  | "erc721-token-range"
  | "erc1155-token-range"
  | "erc721-token-list-bit-vector"
  | "erc1155-token-list-bit-vector"
  | "erc721-token-list-packed-list"
  | "erc1155-token-list-packed-list";

export enum TradeDirection {
  BUY,
  SELL,
}

export type BaseOrder = {
  side: TradeDirection;
  trader: string;
  collection: string;
  matchingPolicy: string;
  tokenId: string;
  amount: string;
  paymentToken: string;
  nonce: string;
  price: string;
  listingTime: string;
  expirationTime: string;
  fees: {
    rate: number;
    recipient: string;
  }[];
  salt: string;
  extraParams: string;

  signatureType?: number;
  v?: number;
  r?: string;
  s?: string;
};


// export type Input = {
//   order: BaseOrder;

// }
// export type MatchParams = {
//   nftId?: string;
//   nftAmount?: string;
//   unwrapNativeToken?: boolean;
// };
