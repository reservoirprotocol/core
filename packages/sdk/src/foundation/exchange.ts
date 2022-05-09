import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { TxData, bn } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

// Foundation is slightly different from the other exchanges that
// we support since it's fully on-chain and all actions including
// order creation are done via pure on-chain transactions.

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // --- Create order ---

  public async createOrder(
    maker: Signer,
    contract: string,
    tokenId: BigNumberish,
    price: BigNumberish
  ): Promise<ContractTransaction> {
    return this.contract.connect(maker).setBuyPrice(contract, tokenId, price);
  }

  public createOrderTx(
    maker: string,
    contract: string,
    tokenId: BigNumberish,
    price: BigNumberish
  ): TxData {
    return {
      from: maker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("setBuyPrice", [
        contract,
        tokenId,
        price,
      ]),
    };
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    contract: string,
    tokenId: BigNumberish,
    price: BigNumberish,
    referrer?: string
  ): Promise<ContractTransaction> {
    return this.contract
      .connect(taker)
      .buyV2(contract, tokenId, price, referrer ?? AddressZero, {
        value: price,
      });
  }

  public fillOrderTx(
    taker: string,
    contract: string,
    tokenId: BigNumberish,
    price: BigNumberish,
    referrer?: string
  ): TxData {
    return {
      from: taker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("buyV2", [
        contract,
        tokenId,
        price,
        referrer ?? AddressZero,
      ]),
      value: bn(price).toHexString(),
    };
  }

  // --- Cancel order ---

  public async cancelOrder(
    maker: Signer,
    contract: string,
    tokenId: BigNumberish
  ): Promise<ContractTransaction> {
    return this.contract.connect(maker).cancelBuyPrice(contract, tokenId);
  }

  public cancelOrderTx(
    maker: string,
    contract: string,
    tokenId: BigNumberish
  ): TxData {
    return {
      from: maker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("cancelBuyPrice", [
        contract,
        tokenId,
      ]),
    };
  }
}
