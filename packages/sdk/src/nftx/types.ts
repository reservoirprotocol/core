export type OrderParams = {
  vaultId: string;
  collection: string;
  specificIds?: string[];
  amounts?: string[];
  amount?: string;
  path:  string[];
  price: string;
  currency: string;
};
