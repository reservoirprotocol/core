export type OrderParams = {
  price: string;
  swapList: SwapList;
  deadline: number;
};

export type SwapList = {
  pair: string;
  nftIds: number[];
};