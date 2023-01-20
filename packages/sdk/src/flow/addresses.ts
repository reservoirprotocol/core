import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.Ethereum]: "0xf1000068a40b93318312c67677825c7c9671a4e9",
  [Network.EthereumGoerli]: "0xa79c18bcdd5c45d4f58317609fe1b6c6a5b623b2",
  [Network.Polygon]: "0xf1000068a40b93318312c67677825c7c9671a4e9",
};

export const Complication: ChainIdToAddress = {
  [Network.Ethereum]: "0xf10003fcf6e1215f5a579bcfe9b2614d1badaef8",
  [Network.EthereumGoerli]: "0xb9ef3e81f83201f8a8c0d59c4ab392526661899e",
  [Network.Polygon]: "0xf10003fcf6e1215f5a579bcfe9b2614d1badaef8",
};
