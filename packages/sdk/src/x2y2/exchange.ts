import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { arrayify } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";
import { keccak256 } from "@ethersproject/keccak256";
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
    const tx = await this.fillOrderTx(await taker.getAddress(), order, options);
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

  // --- Cancel order ---

  public async cancelOrder(maker: Signer, order: Order) {
    const tx = await this.cancelOrderTx(maker, order);
    return maker.sendTransaction(tx);
  }

  public async cancelOrderTx(maker: Signer, order: Order): Promise<TxData> {
    const signMessage = keccak256("0x");
    const sign = await maker.signMessage(arrayify(signMessage));

    const response = await axios.post(
      "https://api.x2y2.org/api/orders/cancel",
      {
        caller: maker,
        // CANCEL_OFFER
        op: 3,
        items: [{ orderId: order.params.id }],
        sign_message: signMessage,
        sign,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
      }
    );

    const input = defaultAbiCoder.decode(
      [
        "(bytes32[] itemHashes, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
      ],
      response.data.input
    )[0];

    return {
      from: await maker.getAddress(),
      data: this.contract.interface.encodeFunctionData("cancel", [
        input.itemHashes,
        input.deadline,
        input.v,
        input.r,
        input.s,
      ]),
      to: this.contract.address,
    };
  }
}
