import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "ethers";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";

import ExchangeAbi from "./abis/Exchange.json";

export class Exchange {
  public chainId: number;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  public async match(
    taker: Signer,
    makerOrder: Order,
    takerOrderParams: Types.TakerOrderParams
  ): Promise<ContractTransaction> {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any
    ).connect(taker);

    if (makerOrder.params.isOrderAsk) {
      return exchange.matchAskWithTakerBidUsingETHAndWETH(
        takerOrderParams,
        makerOrder.params,
        {
          value: makerOrder.params.price,
        }
      );
    } else {
      return exchange.matchBidWithTakerAsk(takerOrderParams, makerOrder.params);
    }
  }

  public async getNonce(
    provider: Provider,
    user: string
  ): Promise<BigNumberish> {
    return new Contract(Addresses.Exchange[this.chainId], ExchangeAbi as any)
      .connect(provider)
      .userMinOrderNonce(user);
  }
}
