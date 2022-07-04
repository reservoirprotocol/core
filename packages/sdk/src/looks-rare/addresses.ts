import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.Ethereum]: "0x59728544b08ab483533076417fbbb2fd0b17ce3a",
  [Network.EthereumRinkeby]: "0x1aa777972073ff66dcfded85749bdd555c0665da",
};

export const StrategyStandardSaleForFixedPrice: ChainIdToAddress = {
  [Network.Ethereum]: "0x56244bb70cbd3ea9dc8007399f61dfc065190031",
  [Network.EthereumRinkeby]: "0x732319a3590e4fa838c111826f9584a9a2fdea1a",
};

export const StrategyAnyItemFromCollectionForFixedPrice: ChainIdToAddress = {
  [Network.Ethereum]: "0x86f909f70813cdb1bc733f4d97dc6b03b8e7e8f3",
  [Network.EthereumRinkeby]: "0xa6e7decd4e18b510c6b98aa0c8ee2db3879f529d",
};

export const TransferManagerErc721: ChainIdToAddress = {
  [Network.Ethereum]: "0xf42aa99f011a1fa7cda90e5e98b277e306bca83e",
  [Network.EthereumRinkeby]: "0x3f65a762f15d01809cdc6b43d8849ff24949c86a",
};

export const TransferManagerErc1155: ChainIdToAddress = {
  [Network.Ethereum]: "0xfed24ec7e22f573c2e08aef55aa6797ca2b3a051",
  [Network.EthereumRinkeby]: "0xaf3115757a96e9439fe8d5898db820afda15958a",
};
