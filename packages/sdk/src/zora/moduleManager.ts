import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";
import * as Addresses from "./addresses";
import { TxData } from "../utils";
import ModuleManagerAbi from "./abis/ModuleManager.json";

export class ModuleManager {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.contract = new Contract(
      Addresses.ModuleManager[this.chainId],
      ModuleManagerAbi as any
    );
  }

  // --- Set approval for module ---

  public async setApprovalForModule(
    maker: Signer,
    approved: boolean
  ): Promise<ContractTransaction> {
    const tx = this.setApprovalForModuleTx(await maker.getAddress(), approved);
    return maker.sendTransaction(tx);
  }

  public setApprovalForModuleTx(maker: string, approved: boolean): TxData {
    return {
      from: maker,
      to: this.contract.address,
      data: this.contract.interface.encodeFunctionData("setApprovalForModule", [
        maker,
        approved,
      ]),
    };
  }
}
