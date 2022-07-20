import { ChainIdToAddress, ChainIdToAddressList, Network } from "../utils";

export const Router: ChainIdToAddress = {
  [Network.Ethereum]: "0x8005488ff4f8982d2d8c1d602e6d747b1428dd41", // V4_0_0
  [Network.EthereumGoerli]: "0xf44caa746d184e6fba3071e8adbf9c041620fe44", // V5_0_0
  [Network.EthereumRinkeby]: "0x0857cc569a239c4e2f7abb5168408d92fb8d63ae", // V5_0_0
};

// Keep track of all used or previously used router contracts
export const AllRouters: ChainIdToAddressList = {
  [Network.Ethereum]: [
    "0xc52b521b284792498c1036d4c2ed4b73387b3859", // V1_0_0
    "0x5aa9ca240174a54af6d9bfc69214b2ed948de86d", // V2_0_0
    "0x7c9733b19e14f37aca367fbd78922c098c55c874", // V3_0_0
    "0x8005488ff4f8982d2d8c1d602e6d747b1428dd41", // V4_0_0
  ],
  [Network.EthereumGoerli]: [
    "0xf44caa746d184e6fba3071e8adbf9c041620fe44", // V5_0_0
  ],
  [Network.EthereumRinkeby]: [
    "0xa5c0c6c024460b039b917a77eb564da5817c55e2", // V1_0_0
    "0x060ef49d2f5d7038cc7397936641feb7c5ae3679", // V2_0_0
    "0xf2418e0c7118df2468fa786606c3e5b68088adbc", // V3_0_0
    "0xc226bb0a5ebb944df0b18e85e9800d463c5afe3f", // V4_0_0
    "0x0857cc569a239c4e2f7abb5168408d92fb8d63ae", // V5_0_0
  ],
};
