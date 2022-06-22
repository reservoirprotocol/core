import { ChainIdToAddress, ChainIdToAddressList } from "../utils";

export const Router: ChainIdToAddress = {
  1: "0x8005488ff4f8982d2d8c1d602e6d747b1428dd41", // V4
  4: "0xc226bb0a5ebb944df0b18e85e9800d463c5afe3f", // V4
};

// Keep track of all used or previously used router contracts
export const AllRouters: ChainIdToAddressList = {
  1: [
    "0xc52b521b284792498c1036d4c2ed4b73387b3859", // V1
    "0x5aa9ca240174a54af6d9bfc69214b2ed948de86d", // V2
    "0x7c9733b19e14f37aca367fbd78922c098c55c874", // V3
    "0x8005488ff4f8982d2d8c1d602e6d747b1428dd41", // V4
  ],
  4: [
    "0xa5c0c6c024460b039b917a77eb564da5817c55e2", // V1
    "0x060ef49d2f5d7038cc7397936641feb7c5ae3679", // V2
    "0xf2418e0c7118df2468fa786606c3e5b68088adbc", // V3
    "0xc226bb0a5ebb944df0b18e85e9800d463c5afe3f", // V4
  ],
};
