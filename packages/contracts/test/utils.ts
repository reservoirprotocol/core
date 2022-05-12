import { Provider } from "@ethersproject/abstract-provider";
import { BigNumberish, BigNumber } from "@ethersproject/bignumber";

export const bn = (value: BigNumberish) => BigNumber.from(value);

export const getCurrentTimestamp = async (provider: Provider) =>
  provider.getBlock("latest").then((b) => b.timestamp);

export const lc = (value: string) => value.toLowerCase();
