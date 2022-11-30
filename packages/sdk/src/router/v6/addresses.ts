import { ChainIdToAddress, Network } from "../../utils";

export const Router: ChainIdToAddress = {
  [Network.Ethereum]: "0x178a86d36d89c7fdebea90b739605da7b131ff6a", // V6_0_0
  [Network.EthereumGoerli]: "0xb35d22a4553ab9d2b85e2a606cbae55f844df50c", // V6_0_0
};

// Utility modules

export const BalanceAssertModule: ChainIdToAddress = {};

export const UnwrapWETHModule: ChainIdToAddress = {};

// Exchange modules

export const BlurModule: ChainIdToAddress = {};

export const FoundationModule: ChainIdToAddress = {
  [Network.Ethereum]: "0x5c8a351d4ff680203e05af56cb9d748898c7b39a",
};

export const LooksRareModule: ChainIdToAddress = {
  [Network.Ethereum]: "0x385df8cbc196f5f780367f3cdc96af072a916f7e",
  [Network.EthereumGoerli]: "0x532486bb46581b032134159c1d31962cdab1e6a7",
};

export const SeaportModule: ChainIdToAddress = {
  [Network.Ethereum]: "0x3729014ef28f01b3ddcf7f980d925e0b71b1f847",
  [Network.EthereumGoerli]: "0x6c460f133c573c21e7f55900d0c68f6f085b91e7",
};

export const SudoswapModule: ChainIdToAddress = {
  [Network.Ethereum]: "0xecd3184bc21172ea96061afeefaa136e5b3761b6",
};

export const UniswapV3Module: ChainIdToAddress = {};

export const X2Y2Module: ChainIdToAddress = {
  [Network.Ethereum]: "0x613d3c588f6b8f89302b463f8f19f7241b2857e2",
  [Network.EthereumGoerli]: "0x6a789513b2e555f9d3539bf9a053a57d2bfca426",
};

export const ZeroExV4Module: ChainIdToAddress = {
  [Network.Ethereum]: "0x8162beec776442afd262b672730bb5d0d8af16a1",
  [Network.EthereumGoerli]: "0x29fcac61d9b2a3c55f3e1149d0278126c31abe74",
};

export const ZoraModule: ChainIdToAddress = {
  [Network.Ethereum]: "0x982b49de82a3ea5b8c42895482d9dd9bfefadf82",
};
