import * as Addresses from "./addresses";
import { Exchange } from "./exchange";
import * as Helpers from "./helpers";
import { Order } from "./order";
import * as Types from "./types";

import { ContractWideErc721Builder } from "./builders/contract-wide/erc721";
import { ContractWideErc1155Builder } from "./builders/contract-wide/erc1155";
import { SingleTokenErc721Builder } from "./builders/single-token/erc721";
import { SingleTokenErc1155Builder } from "./builders/single-token/erc1155";
import { TokenRangeErc721Builder } from "./builders/token-range/erc721";
import { TokenRangeErc1155Builder } from "./builders/token-range/erc1155";

const Builders = {
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

export { Addresses, Builders, Exchange, Helpers, Order, Types };
