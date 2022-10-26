import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import { TxData, generateReferrerBytes } from "../utils";

import RouterAbi from "./abis/RouterRoyalties.json";

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

    // --- Deposit NFTs ---

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
