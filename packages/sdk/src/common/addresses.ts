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

export const Router: ChainIdToAddress = {
  1: "0xc52b521b284792498c1036d4c2ed4b73387b3859",
  4: "0xa5c0c6c024460b039b917a77eb564da5817c55e2",
};
