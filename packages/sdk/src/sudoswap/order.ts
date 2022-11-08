import * as Types from "./types";
import { lc, s } from "../utils";

export type SwapList = {
  pair: string;
  nftIds: number[];
};

export class Order {
  public chainId: number;
  public swapList: any;
  public deadline: number;
  public price: string;

  constructor(
    chainId: number, 
    swapList: any,
    deadline: number,
    price: string
  ) {
    this.chainId = chainId;
    this.swapList = swapList;
    this.deadline = deadline;
    this.price = price;
  }
}

// const normalize = (order: Types.OrderParams): Types.OrderParams => {
//   // Perform some normalization operations on the order:
//   // - convert bignumbers to strings where needed
//   // - convert strings to numbers where needed
//   // - lowercase all strings

//   return {
//     pair: lc(order.pair),
//     price: s(order.price),
//   };
// };
