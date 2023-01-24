import { Interface } from "@ethersproject/abi";

import * as Sdk from "../../index";
import { TxData } from "../../utils";

export const isETH = (chainId: number, address: string) =>
  address.toLowerCase() === Sdk.Common.Addresses.Eth[chainId];

export const isWETH = (chainId: number, address: string) =>
  address.toLowerCase() === Sdk.Common.Addresses.Weth[chainId];

export const generateApprovalTxData = (
  contract: string,
  owner: string,
  operator: string
): TxData => ({
  from: owner,
  to: contract,
  data: new Interface([
    "function setApprovalForAll(address operator, bool isApproved)",
  ]).encodeFunctionData("setApprovalForAll", [operator, true]),
});
