import * as Addresses from "./addresses";
import { Exchange } from "./exchange";
import * as Helpers from "./helpers";
import { Order } from "./order";
import * as Types from "./types";

import { SingleTokenErc721Builder } from "./builders/single-token/erc721";
import { SingleTokenErc1155Builder } from "./builders/single-token/erc1155";
import { TokenRangeErc721Builder } from "./builders/token-range/erc721";

const Builders = {
  Erc721: {
    SingleToken: SingleTokenErc721Builder,
    TokenRange: TokenRangeErc721Builder,
  },
  Erc1155: {
    SingleToken: SingleTokenErc1155Builder,
  },
};

export { Addresses, Builders, Exchange, Helpers, Order, Types };
