import { Provider } from "@ethersproject/abstract-provider";

export const getCurrentTimestamp = async (provider: Provider) =>
  provider.getBlock("latest").then((b) => b.timestamp);
