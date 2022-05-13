import { Provider } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";

import RouterV2Abi from "../abis/RouterV2.json";

export enum ROUTER_EXCHANGE_KIND {
  WYVERN_V23,
  LOOKS_RARE,
  ZEROEX_V4,
  FOUNDATION,
  X2Y2,
}

export class RouterV1 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, RouterV2Abi as any, provider);
  }
}
