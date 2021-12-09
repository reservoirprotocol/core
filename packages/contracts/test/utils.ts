import { Provider } from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";

export const maxUint256 = BigNumber.from("0x" + "f".repeat(64));

export const getCurrentTimestamp = async (provider: Provider) =>
  provider.getBlock("latest").then((b) => b.timestamp);
