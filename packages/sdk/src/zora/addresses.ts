import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.Ethereum]: "0x6170b3c3a54c3d8c854934cbc314ed479b2b29a3",
  [Network.Polygon]: "0x3634e984ba0373cfa178986fd19f03ba4dd8e469",
  [Network.EthereumRinkeby]: "0xa98d3729265c88c5b3f861a0c501622750ff4806",
  [Network.PolygonMumbai]: "0xce6cef2a9028e1c3b21647ae3b4251038109f42a",
};

export const AuctionHouse: ChainIdToAddress = {
  [Network.Ethereum]: "0xe468ce99444174bd3bbbed09209577d25d1ad673",
};

export const AuctionHouseCoreEth: ChainIdToAddress = {
  [Network.Ethereum]: "0x5f7072e1fa7c01dfac7cf54289621afaad2184d0",
  [Network.EthereumRinkeby]: "0x3feaf4c06211680e5969a86adb1423fc8ad9e994",
};

export const AuctionHouseCoreErc20: ChainIdToAddress = {
  [Network.Ethereum]: "0x53172d999a299198a935f9e424f9f8544e3d4292",
  [Network.EthereumRinkeby]: "0x9eb86b88d13ed0e38348ab951b55a26ca468a262",
};

export const ModuleManager: ChainIdToAddress = {
  [Network.Ethereum]: "0x850a7c6fe2cf48eea1393554c8a3ba23f20cc401",
  [Network.Polygon]: "0xcca379fdf4beda63c4bb0e2a3179ae62c8716794",
  [Network.PolygonMumbai]: "0x850a7c6fe2cf48eea1393554c8a3ba23f20cc401",
};

export const Erc721TransferHelper: ChainIdToAddress = {
  [Network.Ethereum]: "0x909e9efe4d87d1a6018c2065ae642b6d0447bc91",
  [Network.Polygon]: "0xce6cef2a9028e1c3b21647ae3b4251038109f42a",
  [Network.PolygonMumbai]: "0x909e9efe4d87d1a6018c2065ae642b6d0447bc91",
};
export const Erc20TransferHelper: ChainIdToAddress = {
  [Network.Ethereum]: "0xcca379fdf4beda63c4bb0e2a3179ae62c8716794",
  [Network.Polygon]: "0x909e9efe4d87d1a6018c2065ae642b6d0447bc91",
  [Network.PolygonMumbai]: "0xcca379fdf4beda63c4bb0e2a3179ae62c8716794",
};
export const ProtocolFeeSettings: ChainIdToAddress = {
  [Network.Ethereum]: "0x9641169a1374b77e052e1001c5a096c29cd67d35",
  [Network.Polygon]: "0x9641169a1374b77e052e1001c5a096c29cd67d35",
  [Network.PolygonMumbai]: "0x9641169a1374b77e052e1001c5a096c29cd67d35",
};
