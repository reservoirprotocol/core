import { AllowanceTransfer, PermitBatch } from "@uniswap/permit2-sdk";
import * as Sdk from "@reservoir0x/sdk/src";

import { Interface } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";

import { TxData, getCurrentTimestamp } from "../../../utils";

import RouterAbi from "../abis/ReservoirV6_0_0.json";
import Permit2ModuleAbi from "../abis/Permit2Module.json";

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

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  public generate(
    from: string,
    owner: string,
    receiver: string,
    token: string,
    amount: BigNumberish,
    expiresIn = 10 * 60,
    nonce = 0
  ): Permit2Approval {
    const now = getCurrentTimestamp();
    const permitBatch = {
      details: [
        {
          token,
          amount,
          expiration: now + expiresIn,
          nonce,
        },
      ],
      spender: Sdk.RouterV6.Addresses.Permit2Module[this.chainId],
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

  public attachAndCheckSignature(
    permit2Approval: Permit2Approval,
    signature: string
  ) {
    
  }

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
              module: Sdk.RouterV6.Addresses.Permit2Module[this.chainId],
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