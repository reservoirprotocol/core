import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { TxData } from "../utils";

import PairFactoryAbi from "./abis/FactoryPair.json";

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.contract = new Contract(
      Addresses.PairFactory[this.chainId],
      // @ts-ignore
      PairFactoryAbi
    );
  }

    // --- Deposit NFTs ---

    public async depositNFTs(
        maker: Signer,
        nft: string, //contract
        ids: number[], //tokenId
        recipient: string //pool
      ): Promise<ContractTransaction> {
        const tx = this.depositNFTsTx(
          await maker.getAddress(),
          nft,
          ids,
          recipient
        );
        return maker.sendTransaction(tx);
      }
  
      public depositNFTsTx(
        maker: string,
        nft: string,
        ids: number[],
        recipient: string
      ): TxData {
        return {
          from: maker,
          to: this.contract.address,
          data:
            this.contract.interface.encodeFunctionData("depositNFTs", [
                nft,
                ids,
                recipient,
            ])
        };
      }
}
