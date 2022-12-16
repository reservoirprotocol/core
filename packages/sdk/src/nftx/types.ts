export type OrderParams = {
  vaultId: string;
  collection: string;
  specificIds?: string[];
  ids?: string[];
  amounts?: string[];
  minEthOut?: string;
  amount?: string;
  path?:  string[];
  price?: string;
  currency?: string;
};
