import * as Sdk from "../../index";

export const isETH = (chainId: number, address: string) =>
  address.toLowerCase() === Sdk.Common.Addresses.Eth[chainId];

export const isWETH = (chainId: number, address: string) =>
  address.toLowerCase() === Sdk.Common.Addresses.Weth[chainId];
