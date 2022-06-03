import { AddressZero } from "@ethersproject/constants";

import { ChainIdToAddress } from "../utils";

export const Eth: ChainIdToAddress = {
  1: AddressZero,
  4: AddressZero,
};

export const Weth: ChainIdToAddress = {
  1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  4: "0xc778417e063141139fce010982780140aa0cd5ab",
};
