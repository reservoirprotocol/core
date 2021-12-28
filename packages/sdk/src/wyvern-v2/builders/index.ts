import { BaseBuilder } from "./base";
import { ContractWideErc721Builder } from "./contract-wide/erc721";
import { ContractWideErc1155Builder } from "./contract-wide/erc1155";
import { SingleTokenErc721Builder } from "./single-token/erc721";
import { SingleTokenErc1155Builder } from "./single-token/erc1155";
import { TokenRangeErc721Builder } from "./token-range/erc721";
import { TokenRangeErc1155Builder } from "./token-range/erc1155";

export const Builders = {
  Base: BaseBuilder,
  Erc721: {
    ContractWide: ContractWideErc721Builder,
    SingleToken: SingleTokenErc721Builder,
    TokenRange: TokenRangeErc721Builder,
  },
  Erc1155: {
    ContractWide: ContractWideErc1155Builder,
    SingleToken: SingleTokenErc1155Builder,
    TokenRange: TokenRangeErc1155Builder,
  },
};
