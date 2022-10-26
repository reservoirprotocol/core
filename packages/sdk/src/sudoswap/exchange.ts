import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import { TxData, generateReferrerBytes } from "../utils";

import RouterAbi from "./abis/RouterRoyalties.json";

// Sudoswap:
// - fully on-chain
// - pooled liquidity

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.contract = new Contract(
      Addresses.RouterWithRoyalties[this.chainId],
      RouterAbi
    );
  }

  // --- Fill buy order ---

  public async fillBuyOrder(
    taker: Signer,
    order: Order,
    tokenId: string,
    options?: {
      recipient?: string;
      referrer?: string;
    }
  ): Promise<ContractTransaction> {
    const tx = this.fillBuyOrderTx(
      await taker.getAddress(),
      order,
      tokenId,
      options
    );
    return taker.sendTransaction(tx);
  }

  public fillBuyOrderTx(
    taker: string,
    order: Order,
    tokenId: string,
    options?: {
      recipient?: string;
      referrer?: string;
    }
  ): TxData {
    return {
      from: taker,
      to: this.contract.address,
      data:
        this.contract.interface.encodeFunctionData("swapNFTsForToken", [
          [
            {
              pair: order.params.pair,
              nftIds: [tokenId],
            },
          ],
          order.params.price ?? 0,
          options?.recipient ?? taker,
          Math.floor(Date.now() / 1000) + 10 * 60,
        ]) + generateReferrerBytes(options?.referrer),
    };
  }

    // --- Deposit NFTs ---

    public async depositNFTs(
      taker: Signer,
      order: Order,
      tokenId: string,
      options?: {
        recipient?: string;
        referrer?: string;
      }
    ): Promise<ContractTransaction> {
      const tx = this.fillBuyOrderTx(
        await taker.getAddress(),
        order,
        tokenId,
        options
      );
      return taker.sendTransaction(tx);
    }
}
