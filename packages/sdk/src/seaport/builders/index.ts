import { BundleAskBuilder } from "./bundles/bundle-ask";
import { ContractWideBuilder } from "./contract-wide";
import { SingleTokenBuilder } from "./single-token";
import { TokenListBuilder } from "./token-list";

export const Builders = {
  Bundle: {
    BundleAsk: BundleAskBuilder,
  },
  ContractWide: ContractWideBuilder,
  SingleToken: SingleTokenBuilder,
  TokenList: TokenListBuilder,
};
