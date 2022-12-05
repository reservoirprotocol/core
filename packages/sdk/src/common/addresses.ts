import { AddressZero } from "@ethersproject/constants";

import { ChainIdToAddress, ChainIdToAddressMap, Network } from "../utils";

export const Eth: ChainIdToAddress = {
  [Network.Ethereum]: AddressZero,
  [Network.EthereumGoerli]: AddressZero,
  [Network.Optimism]: AddressZero,
  [Network.Gnosis]: AddressZero,
  [Network.Polygon]: AddressZero,
  [Network.Arbitrum]: AddressZero,
  [Network.AvalancheFuji]: AddressZero,
  [Network.Avalanche]: AddressZero,
  [Network.PolygonMumbai]: AddressZero,
};

export const Weth: ChainIdToAddress = {
  [Network.Ethereum]: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  [Network.EthereumGoerli]: "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
  [Network.Optimism]: "0x4200000000000000000000000000000000000006",
  [Network.Gnosis]: "0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1",
  [Network.Arbitrum]: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  // Polygon: Wrapped MATIC
  [Network.Polygon]: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  [Network.PolygonMumbai]: "0x9c3c9283d3e44854697cd22d3faa240cfb032889",
  // Avalanche: Wrapped AVAX
  [Network.Avalanche]: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
  [Network.AvalancheFuji]: "0x1d308089a2d1ced3f1ce36b1fcaf815b07217be3",
};

// TODO: Include addresses across all supported chains
export const Usdc: ChainIdToAddress = {
  [Network.Ethereum]: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  [Network.Optimism]: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
};

export const Routers: ChainIdToAddressMap = {
  [Network.Ethereum]: {
    // Alphasharks
    "0x552b16d19dbad7af2786fe5a40d96d2a5c09428c": "alphasharks.io",
    // Blur
    "0x39da41747a83aee658334415666f3ef92dd0d541": "blur.io",
    // Element
    "0x69cf8871f61fb03f540bc519dd1f1d4682ea0bf6": "element.market",
    // Gem
    "0x0000000031f7382a812c64b604da4fc520afef4b": "gem.xyz",
    "0xf24629fbb477e10f2cf331c2b7452d8596b5c7a5": "gem.xyz",
    "0x83c8f28c26bf6aaca652df1dbbe0e1b56f8baba2": "gem.xyz",
    "0x0000000035634b55f3d99b071b5a354f48e10bef": "gem.xyz",
    "0x00000000a50bb64b4bbeceb18715748dface08af": "gem.xyz",
    "0xae9c73fd0fd237c1c6f66fe009d24ce969e98704": "gem.xyz",
    "0x539ea5d6ec0093ff6401dbcd14d049c37a77151b": "gem.xyz",
    "0x3963fb8c968a744b7a01b13b9fd5362e189f7e1a": "gem.xyz",
    "0xeda0edeee797f579bdb0d055ae135ecb71709d28": "gem.xyz",
    // Genie
    "0x0a267cf51ef038fc00e71801f5a524aec06e4f07": "genie.xyz",
    "0x2af4b707e1dce8fc345f38cfeeaa2421e54976d5": "genie.xyz",
    "0xcdface5643b90ca4b3160dd2b5de80c1bf1cb088": "genie.xyz",
    "0x31837aaf36961274a04b915697fdfca1af31a0c7": "genie.xyz",
    "0xf97e9727d8e7db7aa8f006d1742d107cf9411412": "genie.xyz",
    // NFTInit
    "0x7f6cdf5869bd780ea351df4d841f68d73cbcc16b": "nftinit.com",
    // OKX
    "0x92701d42e1504ef9fce6d66a2054218b048dda43": "okx.com",
    // Rarible
    "0x2a7251d1e7d708c507b1b0d3ff328007beecce5d": "rarible.com",
    "0x7f19564c35c681099c0c857a7141836cf7edaa53": "rarible.com",
    // Rarity Garden
    "0x603d022611bfe6a101dcdab207d96c527f1d4d8e": "rarity.garden",
    "0x39b6862c4783db2651d64bc160349dc9a15f1fb7": "rarity.garden",
    // Reservoir (routers)
    "0xc52b521b284792498c1036d4c2ed4b73387b3859": "reservoir.tools",
    "0x5aa9ca240174a54af6d9bfc69214b2ed948de86d": "reservoir.tools",
    "0x7c9733b19e14f37aca367fbd78922c098c55c874": "reservoir.tools",
    "0x8005488ff4f8982d2d8c1d602e6d747b1428dd41": "reservoir.tools",
    "0x9ebfb53fa8526906738856848a27cb11b0285c3f": "reservoir.tools",
    "0x178a86d36d89c7fdebea90b739605da7b131ff6a": "reservoir.tools",
    // Reservoir (modules)
    "0x920692834f93258b71221c58edf870ae013e2f9b": "reservoir.tools",
    "0xef21d6b43ac0bb4608ca05628b05403a47310a3b": "reservoir.tools",
    "0xff78f7c6e23187fd4bdb2f7f35359a42d56878dd": "reservoir.tools",
    "0x5c8a351d4ff680203e05af56cb9d748898c7b39a": "reservoir.tools",
    "0x385df8cbc196f5f780367f3cdc96af072a916f7e": "reservoir.tools",
    "0x3729014ef28f01b3ddcf7f980d925e0b71b1f847": "reservoir.tools",
    "0xecd3184bc21172ea96061afeefaa136e5b3761b6": "reservoir.tools",
    "0x613d3c588f6b8f89302b463f8f19f7241b2857e2": "reservoir.tools",
    "0x8162beec776442afd262b672730bb5d0d8af16a1": "reservoir.tools",
    "0x982b49de82a3ea5b8c42895482d9dd9bfefadf82": "reservoir.tools",
    "0xb1096516fc33bb64a77158b10f155846e74bd7fa": "reservoir.tools",
    // Uniswap
    "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b": "uniswap.org",
    // X2Y2
    "0x56dd5bbede9bfdb10a2845c4d70d4a2950163044": "x2y2.io",
  },
  [Network.EthereumGoerli]: {
    // Reservoir (routers)
    "0xf44caa746d184e6fba3071e8adbf9c041620fe44": "reservoir.tools",
    "0xb35d22a4553ab9d2b85e2a606cbae55f844df50c": "reservoir.tools",
    // Reservoir (modules)
    "0xe4c1c635f257348205ebca78fc9b342dd7813e2b": "reservoir.tools",
    "0x037d39e603b803651acc7b36ff25e52f8680aa2f": "reservoir.tools",
    "0x0e01862920bd5ef73ed1a5dccd2ecad56c3e051f": "reservoir.tools",
    "0x532486bb46581b032134159c1d31962cdab1e6a7": "reservoir.tools",
    "0x6c460f133c573c21e7f55900d0c68f6f085b91e7": "reservoir.tools",
    "0x6a789513b2e555f9d3539bf9a053a57d2bfca426": "reservoir.tools",
    "0x29fcac61d9b2a3c55f3e1149d0278126c31abe74": "reservoir.tools",
  },
};

export const RoyaltyRegistry: ChainIdToAddress = {
  [Network.Ethereum]: "0xad2184fb5dbcfc05d8f056542fb25b04fa32a95d",
  [Network.EthereumGoerli]: "0x644611f32769aaecceadec6462c9495b23b40520",
  [Network.Polygon]: "0xe7c9cb6d966f76f3b5142167088927bf34966a1f",
};

export const RoyaltyEngine: ChainIdToAddress = {
  [Network.Ethereum]: "0x0385603ab55642cb4dd5de3ae9e306809991804f",
  [Network.EthereumGoerli]: "0xe7c9cb6d966f76f3b5142167088927bf34966a1f",
  [Network.Polygon]: "0x28edfcf0be7e86b07493466e7631a213bde8eef2",
};
