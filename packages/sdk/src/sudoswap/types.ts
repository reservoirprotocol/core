export type OrderParams = {
  swapList: SwapList;
  deadline: number;
};

export type SwapList = {
  pair: string;
  nftIds: number[];
};