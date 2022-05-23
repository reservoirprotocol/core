export type OrderKind = "single-token";

// Since X2Y2 is fully centralized, we depend on their APIs
// for everything (eg. filling/cancelling). Also, they only
// make available part of the order information.
export type Order = {
  kind?: OrderKind;
  id: number;
  type: string;
  currency: string;
  price: string;
  maker: string;
  taker: string;
  deadline: number;
  itemHash: string;
  nft: {
    token: string;
    tokenId: string;
  };
};
