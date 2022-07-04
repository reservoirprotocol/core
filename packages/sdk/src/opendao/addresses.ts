import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.EthereumRinkeby]: "0xb446f2fddf9f2d7c0ad2a5c061f8a62223976ecc",
};

export const Eth: ChainIdToAddress = {
  [Network.EthereumRinkeby]: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
};

export const TokenRangeValidator: ChainIdToAddress = {
  [Network.EthereumRinkeby]: "0x807220b2722cB6b084c533f40dd67C05E3E188aF",
};

export const BitVectorValidator: ChainIdToAddress = {
  [Network.EthereumRinkeby]: "0x267aaf14c981216409386123b0a062d915381933",
};

export const PackedListValidator: ChainIdToAddress = {
  [Network.EthereumRinkeby]: "0x7c177cccacc77a6561b07c678ba5a9e9e7e5e10a",
};
