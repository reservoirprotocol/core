import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { SwapList } from "./types";
import { Order } from "./order";
import { TxData, generateReferrerBytes } from "../utils";

import PairRouterAbi from "./abis/RouterPair.json";
import ModuleAbi from "./abis/Module.json";

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
          this.getDeadline(),
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
            this.getDeadline(),
          ]),
        value: value
      };
    }

    getDeadline(): number {
      return Math.floor(Date.now() / 1000) + 10 * 60;
    }
  
    public swapETHForSpecificNFTsTxData(
      addressModule: string, //TODO: remove once 'Module: ChainIdToAddress' is set
      swapList: SwapList[],
      ethListingParams: any,
      fee: any[],
    ): string {

      const module = new Contract(addressModule, ModuleAbi);
      let txnData = module.interface.encodeFunctionData("swapETHForSpecificNFTs", [
        swapList,
        this.getDeadline(),
        ethListingParams,
        fee
      ]);
      return txnData;
    }
}
