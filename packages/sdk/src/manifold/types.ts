export type OrderParams = {
  maker: string;
  contract: string;
  tokenId: string;
  price: string;
};

export enum ListingType {
  INVALID,
  INDIVIDUAL_AUCTION,
  FIXED_PRICE,
  DYNAMIC_PRICE,
  RANKED_AUCTION,
}

export enum Spec {
  NONE,
  ERC721,
  ERC1155,
}

export enum Flags {
  FLAG_MASK_HAS_BID = "0x1",
  FLAG_MASK_FINALIZED = "0x2",
  FLAG_MASK_TOKEN_CREATOR = "0x4",
}

export type Listing = {
  address: string;
  flags: Flags;
  totalSold: number;
  marketplaceBPS: number;
  referrerBPS: number;
  listingDetails: ListingDetails;
  tokenDetails: TokenDetails;
  listingReceivers: ListingReceiver[];
  bid: Bid | null;
  deliveryFees: DeliveryFees | [];
};

export type ListingDetails = {
  initialAmount: string;
  type_: ListingType;
  totalAvailable: number;
  totalPerSale: number;
  extensionInterval: number;
  minIncrementBPS: number;
  erc20: string;
  identityVerifier: string;
  startTime: number;
  endTime: number;
};

export type ListingReceiver = {
  receiver: string;
  receiverBPS: number;
};

export type Bid = {
  amount: number;
  bidder: string;
  delivered: boolean;
  settled: boolean;
  refunded: boolean;
  timestamp: number;
  referrer: string;
};

export type DeliveryFees = {
  deliverBPS: number;
  deliverFixed: number;
};

export type TokenDetails = {
  id: number;
  address_: string;
  spec: Spec;
  lazy: boolean;
};

export type PurchaseDetails = {
  referrer: string;
  listingId: number;
  amount: number | 1;
};
