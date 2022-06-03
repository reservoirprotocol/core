import { ChainIdToAddress, ChainIdToAddressList } from "../utils";

export const Router: ChainIdToAddress = {
  1: "0x5aa9ca240174a54af6d9bfc69214b2ed948de86d",
  4: "0x060ef49d2f5d7038cc7397936641feb7c5ae3679",
};

// Keep track of all used or previously used router contracts
export const AllRouters: ChainIdToAddressList = {
  1: [
    "0xc52b521b284792498c1036d4c2ed4b73387b3859",
    "0x5aa9ca240174a54af6d9bfc69214b2ed948de86d",
  ],
  4: [
    "0xa5c0c6c024460b039b917a77eb564da5817c55e2",
    "0x060ef49d2f5d7038cc7397936641feb7c5ae3679",
  ],
};
