import { AddressZero } from "@ethersproject/constants";

import { ChainIdToAddress, ChainIdToAddressMap, Network } from "../utils";

export const Eth: ChainIdToAddress = {
  [Network.Ethereum]: AddressZero,
  [Network.EthereumRinkeby]: AddressZero,
  [Network.EthereumGoerli]: AddressZero,
  [Network.Optimism]: AddressZero,
  [Network.EthereumKovan]: AddressZero,
  [Network.OptimismKovan]: AddressZero,
  [Network.Gnosis]: AddressZero,
  [Network.Polygon]: AddressZero,
  [Network.Arbitrum]: AddressZero,
  [Network.AvalancheFuji]: AddressZero,
  [Network.Avalanche]: AddressZero,
  [Network.PolygonMumbai]: AddressZero,
};

export const Weth: ChainIdToAddress = {
  [Network.Ethereum]: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  [Network.EthereumRinkeby]: "0xc778417e063141139fce010982780140aa0cd5ab",
  [Network.EthereumGoerli]: "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
  [Network.EthereumKovan]: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
  [Network.Optimism]: "0x4200000000000000000000000000000000000006",
  [Network.OptimismKovan]: "0x4200000000000000000000000000000000000006",
  [Network.Gnosis]: "0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1",
  [Network.Arbitrum]: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  // Polygon: Wrapped MATIC
  [Network.Polygon]: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  [Network.PolygonMumbai]: "0x9c3c9283d3e44854697cd22d3faa240cfb032889",
  // Avalanche: Wrapped AVAX
  [Network.Avalanche]: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
  [Network.AvalancheFuji]: "0x1d308089a2d1ced3f1ce36b1fcaf815b07217be3",
};

export const Routers: ChainIdToAddressMap = {
  [Network.Ethereum]: {
    // Gem
    "0x0000000031f7382a812c64b604da4fc520afef4b": true,
    "0xf24629fbb477e10f2cf331c2b7452d8596b5c7a5": true,
    "0x83c8f28c26bf6aaca652df1dbbe0e1b56f8baba2": true,
    "0x0000000035634b55f3d99b071b5a354f48e10bef": true,
    "0x00000000a50bb64b4bbeceb18715748dface08af": true,
    // Genie
    "0x0a267cf51ef038fc00e71801f5a524aec06e4f07": true,
    "0x2af4b707e1dce8fc345f38cfeeaa2421e54976d5": true,
    // Reservoir
    "0xc52b521b284792498c1036d4c2ed4b73387b3859": true,
    "0x5aa9ca240174a54af6d9bfc69214b2ed948de86d": true,
    "0x7c9733b19e14f37aca367fbd78922c098c55c874": true,
    "0x8005488ff4f8982d2d8c1d602e6d747b1428dd41": true,
  },
  [Network.EthereumRinkeby]: {
    // Reservoir
    "0xa5c0c6c024460b039b917a77eb564da5817c55e2": true,
    "0x060ef49d2f5d7038cc7397936641feb7c5ae3679": true,
    "0xf2418e0c7118df2468fa786606c3e5b68088adbc": true,
    "0xc226bb0a5ebb944df0b18e85e9800d463c5afe3f": true,
  },
};

// TODO: Include addresses across all supported chains
export const Usdc: ChainIdToAddress = {
  1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  10: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
  42: "0xb7a4f3e9097c08da09517b5ab877f7a917224ede",
};
