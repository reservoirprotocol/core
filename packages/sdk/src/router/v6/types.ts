import { BigNumberish } from "@ethersproject/bignumber";

import * as Sdk from "../../index";

export type Fee = {
  recipient: string;
  amount: BigNumberish;
};

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
    }
  | {
      kind: "seaport-partial";
      order: Sdk.Seaport.Types.PartialOrder;
    }
  | {
      kind: "cryptopunks";
      order: Sdk.CryptoPunks.Order;
    }
  | {
      kind: "sudoswap";
      order: Sdk.Sudoswap.Order;
    }
  | {
      kind: "zora";
      order: Sdk.Zora.Order;
    }
  | {
      kind: "universe";
      order: Sdk.Universe.Order;
    }
  | {
      kind: "element";
      order: Sdk.Element.Order;
    }
  | {
      kind: "rarible";
      order: Sdk.Rarible.Order;
    };

export type ListingFillDetails = {
  contractKind: "erc721" | "erc1155";
  contract: string;
  tokenId: string;
  currency: string;
  // Relevant for partially-fillable orders
  amount?: number | string;
  fees?: Fee[];
};

export type BidFillDetails = {
  contractKind: "erc721" | "erc1155";
  contract: string;
  tokenId: string;
  // Relevant for partially-fillable orders
  amount?: number | string;
  // Relevant for merkle orders
  extraArgs?: any;
};

export type ListingDetails = GenericOrder & ListingFillDetails;
export type BidDetails = GenericOrder & BidFillDetails;
