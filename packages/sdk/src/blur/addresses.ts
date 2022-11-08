import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.Ethereum]: "0x000000000000ad05ccc4f10045630fb830b95127",
};

export const StandardPolicyERC721: ChainIdToAddress = {
  [Network.Ethereum]: "0x00000000006411739da1c40b106f8511de5d1fac",
};

export const ExecutionDelegate: ChainIdToAddress = {
  [Network.Ethereum]: "0x00000000000111abe46ff893f3b2fdf1f759a8a8",
};
