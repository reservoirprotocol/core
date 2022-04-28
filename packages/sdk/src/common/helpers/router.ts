import { Provider } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";

import RouterV1Abi from "../abis/RouterV1.json";

export enum ROUTER_EXCHANGE_KIND {
  WYVERN_V23,
  LOOKS_RARE,
  ZEROEX_V4,
}

export class RouterV1 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, RouterV1Abi as any, provider);
  }
}
