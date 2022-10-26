import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order, SwapList } from "./order";
//import { SwapList } from "./types";
import { TxData, generateReferrerBytes } from "../utils";

import PairRouterAbi from "./abis/RouterPair.json";

// Sudoswap:
// - fully on-chain
// - pooled liquidity

export class Router {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.contract = new Contract(
      Addresses.PairRouter[this.chainId],
      PairRouterAbi
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

    // --- Swap ETH for specific NFTs ---
    
    public async swapETHForSpecificNFTs(
      taker: Signer,
      swapList: SwapList[],
      ethRecipient: string,
      nftRecipient: string,
      value: string
    ): Promise<ContractTransaction> {
      const tx = this.swapETHForSpecificNFTsTx(
        await taker.getAddress(),
        swapList,
        ethRecipient,
        nftRecipient,
        value
      );
      return taker.sendTransaction(tx);
    }

    public swapETHForSpecificNFTsTx(
      taker: string,
      swapList: SwapList[],
      ethRecipient: string,
      nftRecipient: string,
      value: string
    ): TxData {
      return {
        from: taker,
        to: this.contract.address,
        data:
          this.contract.interface.encodeFunctionData("swapETHForSpecificNFTs", [
            swapList,
            ethRecipient,
            nftRecipient,
            Math.floor(Date.now() / 1000) + 10 * 60,
          ]),
        value: value
      };
    }
}
