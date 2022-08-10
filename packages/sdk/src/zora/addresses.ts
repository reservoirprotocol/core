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
