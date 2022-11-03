import { ChainIdToAddress, Network } from "../utils";

export const PairFactory: ChainIdToAddress = {
  [Network.Ethereum]: "0xb16c1342e617a5b6e4b631eb114483fdb289c0a4",
};

export const RouterWithRoyalties: ChainIdToAddress = {
  [Network.Ethereum]: "0x844d04f79d2c58dcebf8fff1e389fccb1401aa49",
};

export const PairRouter: ChainIdToAddress = {
  [Network.Ethereum]: "0x2B2e8cDA09bBA9660dCA5cB6233787738Ad68329",
};

//TODO: populate once deployed
export const Module: ChainIdToAddress = {
  [Network.Ethereum]: "0x0000000000000000000000000000000000000000",
};

