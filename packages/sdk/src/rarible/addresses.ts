import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.Ethereum]: "0x9757f2d2b135150bbeb65308d4a91804107cd8d6",
  [Network.EthereumRinkeby]: "0xd4a57a3bd3657d0d46b4c5bac12b3f156b9b886b",
  [Network.EthereumGoerli]: "0x02afbD43cAD367fcB71305a2dfB9A3928218f0c1",
};

export const NFTTransferProxy: ChainIdToAddress = {
  [Network.Ethereum]: "0x4fee7b061c97c9c496b01dbce9cdb10c02f0a0be",
  [Network.EthereumGoerli]: "0x21B0B84FfAB5A8c48291f5eC9D9FDb9aef574052",
};

export const ERC721LazyTransferProxy: ChainIdToAddress = {
  [Network.Ethereum]: "0xbb7829BFdD4b557EB944349b2E2c965446052497",
  [Network.EthereumGoerli]: "0x96102D9472C0338005cbf12Fb7eA829F242C2809",
};

export const ERC1155LazyTransferProxy: ChainIdToAddress = {
  [Network.Ethereum]: "0x75a8B7c0B22D973E0B46CfBD3e2f6566905AA79f",
  [Network.EthereumGoerli]: "0x1e1B6E13F0eB4C570628589e3c088BC92aD4dB45",
};

export const ERC20TransferProxy: ChainIdToAddress = {
  [Network.Ethereum]: "0xb8e4526e0da700e9ef1f879af713d691f81507d8",
  [Network.EthereumGoerli]: "0x17cEf9a8bf107D58E87c170be1652c06390BD990",
};
