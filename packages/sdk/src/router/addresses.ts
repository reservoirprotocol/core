import { ChainIdToAddress, ChainIdToAddressList } from "../utils";

export const Router: ChainIdToAddress = {
  1: "0xc52b521b284792498c1036d4c2ed4b73387b3859",
  4: "0x7031e6f51a02d2377802e4cf6f7d6641ccced78e",
};

// Keep track of all used or previously used router contracts
export const AllRouters: ChainIdToAddressList = {
  1: ["0xc52b521b284792498c1036d4c2ed4b73387b3859"],
  4: [
    "0xa5c0c6c024460b039b917a77eb564da5817c55e2",
    "0x7031e6f51a02d2377802e4cf6f7d6641ccced78e",
  ],
};
