import * as Sdk from "../index";

export enum ExchangeKind {
  WYVERN_V23,
  LOOKS_RARE,
  ZEROEX_V4,
  FOUNDATION,
  X2Y2,
  SEAPORT,
}

export type GenericOrder =
  | {
      kind: "foundation";
      order: Sdk.Foundation.Order;
    }
  | {
      kind: "looks-rare";
      order: Sdk.LooksRare.Order;
    }
  | {
      kind: "opendao";
      order: Sdk.OpenDao.Order;
    }
  | {
      kind: "wyvern-v2.3";
      order: Sdk.WyvernV23.Order;
    }
  | {
      kind: "x2y2";
      order: Sdk.X2Y2.Order;
    }
  | {
      kind: "zeroex-v4";
      order: Sdk.ZeroExV4.Order;
    }
  | {
      kind: "seaport";
      order: Sdk.Seaport.Order;
    };

export type ListingFillDetails = {
  contractKind: "erc721" | "erc1155";
  contract: string;
  tokenId: string;
  // Relevant for partially-fillable orders
  amount?: number | string;
};

export type BidFillDetails = {
  contractKind: "erc721" | "erc1155";
  contract: string;
  tokenId: string;
  // Relevant for merkle orders
  extraArgs?: any;
};

export type ListingDetails = GenericOrder & ListingFillDetails;
export type BidDetails = GenericOrder & BidFillDetails;
