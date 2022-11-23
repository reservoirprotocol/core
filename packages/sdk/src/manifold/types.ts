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

export type BNHex = {
  type: string;
  hex: string;
};

type BaseListing = {
  id: string;
  seller: string;
  fees: DeliveryFees;
};

export type DeliveryFees = {
  deliverFixed: number | null;
  deliverBPS?: number;
};

// FROM API
export type ApiListing = BaseListing & {
  details: ApiListingDetails;
  token: ApiListingTokenDetails;
};

// FOR CONTRACT
export type ContractListing = BaseListing & {
  details: ListingDetails;
  token: ListingTokenDetails;
};

type BaseDetails = {
  type_: ListingType;
  extensionInterval: number;
  startTime: number;
  endTime: number;
};

export type ApiListingDetails = BaseDetails & {
  initialAmount: BNHex;
  totalAvailable: string;
  totalPerSale: string;
  minIncrementBPS?: string;
  erc20: string | null;
  identityVerifier: string | null;
};

export type ListingDetails = BaseDetails & {
  initialAmount: string;
  totalAvailable: number;
  totalPerSale: number;
  minIncrementBPS: number;
  erc20: string;
  identityVerifier: string;
};

type BaseTokenDetails = {
  address_: string;
  lazy: boolean;
};

export type ListingTokenDetails = BaseTokenDetails & {
  id: string;
  spec: Spec;
};

export type ApiListingTokenDetails = BaseTokenDetails & {
  id: BNHex;
  spec: string;
};
