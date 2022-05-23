import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";
import axios from "axios";

import * as Addresses from "./addresses";
import { Order } from "./order";
import { TxData, bn } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

export class Exchange {
  public chainId: number;
  public contract: Contract;
  public apiKey: string;

  constructor(chainId: number, apiKey: string) {
    if (chainId !== 1) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
    this.apiKey = apiKey;
  }

  // --- Fill order ---

  public async fillOrder(taker: Signer, order: Order) {
    const response = await axios.post(
      "https://api.x2y2.org/api/orders/sign",
      {
        caller: await taker.getAddress(),
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

    return taker.sendTransaction({
      data:
        this.contract.interface.getSighash("run") +
        response.data.data[0].input.slice(2),
      to: this.contract.address,
      value: bn(order.params.price).toHexString(),
    });
  }

  public async fillOrderTx(taker: string, order: Order): Promise<TxData> {
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
        response.data.data[0].input.slice(2),
      to: this.contract.address,
      value: bn(order.params.price).toHexString(),
    };
  }
}
