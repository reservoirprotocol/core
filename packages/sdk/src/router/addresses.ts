import { ChainIdToAddress, ChainIdToAddressList, Network } from "../utils";

export const Router: ChainIdToAddress = {
  [Network.EthereumGoerli]: "0xb35d22a4553ab9d2b85e2a606cbae55f844df50c", // V6_0_0
};

// Utility modules

export const BalanceAssertModule: ChainIdToAddress = {};

export const UnwrapWETHModule: ChainIdToAddress = {};

// Exchange / marketplace modules

export const FoundationModule: ChainIdToAddress = {};

export const LooksRareModule: ChainIdToAddress = {
  [Network.EthereumGoerli]: "0xe4c1c635f257348205ebca78fc9b342dd7813e2b",
};

export const SeaportModule: ChainIdToAddress = {
  [Network.EthereumGoerli]: "0xa5731736a95a9609cb188baeadb493930fe8dd98",
};

export const X2Y2Module: ChainIdToAddress = {};

export const ZeroExV4Module: ChainIdToAddress = {
  [Network.EthereumGoerli]: "0x0e01862920bd5ef73ed1a5dccd2ecad56c3e051f",
};

// Keep track of all currently or previously used router contracts
export const AllRouters: ChainIdToAddressList = {
  [Network.Ethereum]: [
    "0xc52b521b284792498c1036d4c2ed4b73387b3859", // V1_0_0
    "0x5aa9ca240174a54af6d9bfc69214b2ed948de86d", // V2_0_0
    "0x7c9733b19e14f37aca367fbd78922c098c55c874", // V3_0_0
    "0x8005488ff4f8982d2d8c1d602e6d747b1428dd41", // V4_0_0
    "0x9ebfb53fa8526906738856848a27cb11b0285c3f", // V5_0_0
  ],
  [Network.EthereumGoerli]: [
    "0x4e650642393ac992553b8fdd98be7750e99660cc", // V5_0_0
    "0xb35d22a4553ab9d2b85e2a606cbae55f844df50c", // V6_0_0
  ],
  [Network.EthereumRinkeby]: [
    "0xa5c0c6c024460b039b917a77eb564da5817c55e2", // V1_0_0
    "0x060ef49d2f5d7038cc7397936641feb7c5ae3679", // V2_0_0
    "0xf2418e0c7118df2468fa786606c3e5b68088adbc", // V3_0_0
    "0xc226bb0a5ebb944df0b18e85e9800d463c5afe3f", // V4_0_0
    "0x0857cc569a239c4e2f7abb5168408d92fb8d63ae", // V5_0_0
  ],
  [Network.Polygon]: [
    "0x343621b9e3ee47b6ac5eb3343ca50137e56d8a70", // V5_0_0
  ],
  [Network.Optimism]: [
    "0x41216f11a8481843de3e4986c388f1cc8780b724", // V5_0_0
  ],
};
