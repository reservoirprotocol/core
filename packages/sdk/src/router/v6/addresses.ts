import { ChainIdToAddress, Network } from "../../utils";

export const Router: ChainIdToAddress = {
  [Network.Ethereum]: "0x178a86d36d89c7fdebea90b739605da7b131ff6a", // V6_0_0
  [Network.EthereumGoerli]: "0xb35d22a4553ab9d2b85e2a606cbae55f844df50c", // V6_0_0
};

// Utility modules

export const BalanceAssertModule: ChainIdToAddress = {};

export const UnwrapWETHModule: ChainIdToAddress = {};

// Exchange modules

export const FoundationModule: ChainIdToAddress = {};

export const LooksRareModule: ChainIdToAddress = {
  [Network.Ethereum]: "0x920692834f93258b71221c58edf870ae013e2f9b",
  [Network.EthereumGoerli]: "0x532486bb46581b032134159c1d31962cdab1e6a7",
};

export const SeaportModule: ChainIdToAddress = {
  [Network.Ethereum]: "0xef21d6b43ac0bb4608ca05628b05403a47310a3b",
  [Network.EthereumGoerli]: "0x6c460f133c573c21e7f55900d0c68f6f085b91e7",
};

export const SudoswapModule: ChainIdToAddress = {};

export const X2Y2Module: ChainIdToAddress = {
  [Network.Ethereum]: "0xff78f7c6e23187fd4bdb2f7f35359a42d56878dd",
  [Network.EthereumGoerli]: "0x6a789513b2e555f9d3539bf9a053a57d2bfca426",
};

export const ZeroExV4Module: ChainIdToAddress = {
  [Network.Ethereum]: "0xca0aedd0dde85d059e41e2c4aed711732b5df844",
  [Network.EthereumGoerli]: "0x29fcac61d9b2a3c55f3e1149d0278126c31abe74",
};

export const ZoraModule: ChainIdToAddress = {};

export const BlurModule: ChainIdToAddress = {
  [Network.Ethereum]: "0x0000000000000000000000000000000000000000",
  [Network.EthereumGoerli]: "0x0000000000000000000000000000000000000000",
};