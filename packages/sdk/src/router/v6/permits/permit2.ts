import { AllowanceTransfer, PermitBatch } from "@uniswap/permit2-sdk";
import * as Sdk from "@reservoir0x/sdk/src";

import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { BigNumberish } from "@ethersproject/bignumber";

import { TxData, getCurrentTimestamp } from "../../../utils";

import RouterAbi from "../abis/ReservoirV6_0_0.json";
import Permit2ABI from "../../../common/abis/Permit2.json";
import Permit2ModuleAbi from "../abis/Permit2Module.json";
import { Contract } from "ethers";

export type TransferDetail = {
  from: string;
  to: string;
  token: string;
  amount: string;
}

export type Permit2Approval = {
  owner: string;
  permitBatch: PermitBatch;
  signature?: string;
  transferDetails: TransferDetail[];
};

export class Permit2Handler {
  public chainId: number;
  public provider: Provider;
  public permit2: Contract
  public address: string;
  public module: string

  constructor(chainId: number, provider: Provider) {
    this.chainId = chainId;
    this.provider = provider;
    this.address = Sdk.RouterV6.Addresses.Permit2Module[this.chainId];
    this.module = Sdk.RouterV6.Addresses.Permit2Module[this.chainId];
    this.permit2 = new Contract(this.address, Permit2ABI, provider);
  }

  public async generate(
    from: string,
    owner: string,
    receiver: string,
    token: string,
    amount: BigNumberish,
    expiresIn = 10 * 60
  ): Promise<Permit2Approval> {
    
    const packedAllowance = await this.permit2.allowance(owner, token, this.module);
    const now = getCurrentTimestamp();
    const permitBatch = {
      details: [
        {
          token,
          amount,
          expiration: now + expiresIn,
          nonce: packedAllowance.nonce
        },
      ],
      spender: this.module,
      sigDeadline: now + expiresIn,
    };

    return {
      owner,
      permitBatch,
      transferDetails: [
        {
          from,
          to: receiver,
          amount: amount.toString(),
          token,
        },
      ],
    }
  }

  public getSignatureData(permit2Approval: Permit2Approval) {
    return AllowanceTransfer.getPermitData(
      permit2Approval.permitBatch,
      Sdk.Common.Addresses.Permit2[this.chainId],
      this.chainId
    );
  }

  // public attachAndCheckSignature(
  //   permit2Approval: Permit2Approval,
  //   signature: string
  // ) {
  // }

  public attachToRouterExecution(
    txData: TxData,
    permitApprovals: Permit2Approval[]
  ): TxData {
    const routerIface = new Interface(RouterAbi);
    const executionInfos = routerIface.decodeFunctionData(
      "execute",
      txData.data
    ).executionInfos;

    const permit2ModuleIface = new Interface(Permit2ModuleAbi);
    return {
      ...txData,
      data: routerIface.encodeFunctionData("execute", [
        [
          ...permitApprovals.map((permit2Approval) => {
            return {
              module: this.address,
              data: permit2ModuleIface.encodeFunctionData("permitTransfer", [
                permit2Approval.owner,
                permit2Approval.permitBatch,
                permit2Approval.transferDetails,
                permit2Approval.signature,
              ]),
              value: 0
            }
          }),
          ...executionInfos,
        ],
      ]),
    };
  }
}