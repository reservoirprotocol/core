import { BigNumberish } from "@ethersproject/bignumber";

export type ExecutionInfo = {
  market: string;
  data: string;
  value: BigNumberish;
};
