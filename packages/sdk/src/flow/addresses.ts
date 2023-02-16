import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.Ethereum]: "0xf1000142679a6a57abd2859d18f8002216b0ac2b",
  [Network.EthereumGoerli]: "0xa79c18bcdd5c45d4f58317609fe1b6c6a5b623b2",
  [Network.Polygon]: "0xf1000142679a6a57abd2859d18f8002216b0ac2b",
};

export const Complication: ChainIdToAddress = {
  [Network.Ethereum]: "0xf10003fcf6e1215f5a579bcfe9b2614d1badaef8",
  [Network.EthereumGoerli]: "0xb9ef3e81f83201f8a8c0d59c4ab392526661899e",
  [Network.Polygon]: "0xf10003fcf6e1215f5a579bcfe9b2614d1badaef8",
};

export const ComplicationV2: ChainIdToAddress = {
  [Network.Ethereum]: "0xf10003fcf6e1215f5a579bcfe9b2614d1badaef8",
  [Network.EthereumGoerli]: "0xb9ef3e81f83201f8a8c0d59c4ab392526661899e",
  [Network.Polygon]: "0xf10003fcf6e1215f5a579bcfe9b2614d1badaef8",
};

export const SupportedComplications = {
  [Network.Ethereum]: [
    Complication[Network.Ethereum],
    ComplicationV2[Network.Ethereum],
  ],
  [Network.EthereumGoerli]: [
    Complication[Network.EthereumGoerli],
    ComplicationV2[Network.EthereumGoerli],
  ],
  [Network.Polygon]: [
    Complication[Network.Polygon],
    ComplicationV2[Network.Polygon],
  ],
};

export const DefaultComplication = ComplicationV2;
