import { AddressZero } from "@ethersproject/constants";

import { ChainIdToAddress } from "../utils";

export const Eth: ChainIdToAddress = {
  1: AddressZero,
  4: AddressZero,
  10: AddressZero,
};

export const Weth: ChainIdToAddress = {
  1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  4: "0xc778417e063141139fce010982780140aa0cd5ab",
  10: "0x4200000000000000000000000000000000000006",
};

export const Usdc: ChainIdToAddress = {
  1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  10: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
  42: "0xb7a4f3e9097c08da09517b5ab877f7a917224ede",
};
