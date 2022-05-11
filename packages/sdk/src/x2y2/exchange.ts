import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";
import { keccak256 } from "@ethersproject/solidity";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { getCurrentTimestamp } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

type Signature = {
  v: number;
  r: string;
  s: string;
};

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    if (chainId !== 1) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    detail: Types.SettleDetail,
    shared: Types.SettleShared,
    signerSignature: Signature
  ): Promise<ContractTransaction> {
    return this.contract.connect(taker).run(
      {
        orders: [order.params],
        details: [detail],
        shared,
        ...signerSignature,
      },
      { value: detail.price }
    );
  }

  // --- Cancel order ---

  public async cancelOrder(
    maker: Signer,
    order: Order,
    signerSignature: Signature
  ): Promise<ContractTransaction> {
    return this.contract.connect(maker).cancel(
      order.params.items.map((_, i) => order.itemHash(i)),
      getCurrentTimestamp() + 5 * 60,
      signerSignature.v,
      signerSignature.r,
      signerSignature.s
    );
  }

  // --- Get run input hash ---

  public getRunInputHash(
    detail: Types.SettleDetail,
    shared: Types.SettleShared
  ): string {
    return keccak256(
      ["bytes"],
      [
        defaultAbiCoder.encode(
          [
            `
              (
                uint256 salt,
                uint256 deadline,
                uint256 amountToEth,
                uint256 amountToWeth,
                address user,
                bool canFail
              )
            `,
            "uint256",
            `
              (
                uint8 op,
                uint256 orderIdx,
                uint256 itemIdx,
                uint256 price,
                bytes32 itemHash,
                address executionDelegate,
                bytes dataReplacement,
                uint256 bidIncentivePct,
                uint256 aucMinIncrementPct,
                uint256 aucIncDurationSecs,
                (uint256 percentage,address to)[] fees
              )[]
            `,
          ],
          [shared, 1, [detail]]
        ),
      ]
    );
  }
}
