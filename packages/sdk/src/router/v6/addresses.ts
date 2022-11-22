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
  [Network.EthereumGoerli]: "0xe4c1c635f257348205ebca78fc9b342dd7813e2b",
};

export const SeaportModule: ChainIdToAddress = {
  [Network.Ethereum]: "0xef21d6b43ac0bb4608ca05628b05403a47310a3b",
  [Network.EthereumGoerli]: "0x037d39e603b803651acc7b36ff25e52f8680aa2f",
};

export const SudoswapModule: ChainIdToAddress = {};

export const X2Y2Module: ChainIdToAddress = {
  [Network.Ethereum]: "0xff78f7c6e23187fd4bdb2f7f35359a42d56878dd",
  [Network.EthereumGoerli]: "0x3b74ec4005617ce2adf46d812039ea3562a4eaf5",
};

export const ZeroExV4Module: ChainIdToAddress = {
  [Network.Ethereum]: "0xca0aedd0dde85d059e41e2c4aed711732b5df844",
  [Network.EthereumGoerli]: "0x0e01862920bd5ef73ed1a5dccd2ecad56c3e051f",
};

export const ZoraModule: ChainIdToAddress = {};
