import {
  Provider,
  TransactionResponse,
} from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";

import * as Addresses from "./addresses";

import ProxyRegistryAbi from "./abis/ProxyRegistry.json";

export class ProxyRegistry {
  public contract: Contract;

  constructor(provider: Provider, chainId: number) {
    this.contract = new Contract(
      Addresses.ProxyRegistry[chainId],
      ProxyRegistryAbi as any,
      provider
    );
  }

  public async getProxy(owner: string): Promise<string> {
    return this.contract.proxies(owner);
  }

  public async registerProxy(registerer: Signer): Promise<TransactionResponse> {
    return this.contract.connect(registerer).registerProxy();
  }
}
