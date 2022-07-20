import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";
import axios from "axios";

import * as Addresses from "./addresses";
import { Order } from "./order";
import { TxData, bn, generateReferrerBytes } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

export class Exchange {
  public chainId: number;
  public contract: Contract;
  public apiKey: string;

  constructor(chainId: number, apiKey: string) {
    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
    this.apiKey = apiKey;
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    options?: { referrer?: string }
  ) {
    const tx = await this.fillOrderTx(await taker.getAddress(), order);
    return taker.sendTransaction(tx);
  }

  public async fillOrderTx(
    taker: string,
    order: Order,
    options?: { referrer?: string }
  ): Promise<TxData> {
    const response = await axios.post(
      "https://api.x2y2.org/api/orders/sign",
      {
        caller: taker,
        // COMPLETE_SELL_OFFER
        op: 1,
        amountToEth: "0",
        amountToWeth: "0",
        items: [
          {
            orderId: order.params.id,
            currency: order.params.currency,
            price: order.params.price,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
      }
    );

    return {
      from: taker,
      data:
        this.contract.interface.getSighash("run") +
        response.data.data[0].input.slice(2) +
        generateReferrerBytes(options?.referrer),
      to: this.contract.address,
      value: bn(order.params.price).toHexString(),
    };
  }
}
