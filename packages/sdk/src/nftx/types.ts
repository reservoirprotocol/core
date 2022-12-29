export type OrderParams = {
  vaultId: string;
  collection: string;
  specificIds?: string[];
  amounts?: string[];
  amount?: string;
  path:  string[];
  currency?: string;
  price: string;
  extra: {
    prices: string[];
  }
};
