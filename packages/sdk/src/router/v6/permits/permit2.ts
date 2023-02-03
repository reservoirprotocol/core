import { AllowanceTransfer, PermitBatch, PermitDetails } from "@uniswap/permit2-sdk";
import * as Sdk from "@reservoir0x/sdk/src";

import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { verifyTypedData } from "@ethersproject/wallet";
import { TxData, getCurrentTimestamp, bn } from "../../../utils";

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

export type Data = {
  owner: string;
  permitBatch: PermitBatch;
  signature?: string;
  transferDetails: TransferDetail[];
};

export class Handler {
  public chainId: number;
  public provider: Provider;
  public permit2: Contract
  public address: string;
  public module: string

  constructor(chainId: number, provider: Provider, module?: string) {
    this.chainId = chainId;
    this.provider = provider;
    this.address = Sdk.Common.Addresses.Permit2[this.chainId];
    this.module = module ?? Sdk.RouterV6.Addresses.Permit2Module[this.chainId];
    this.permit2 = new Contract(this.address, Permit2ABI, provider);
  }

  public async generate(
    transferDetails: TransferDetail[],
    expiresIn = 10 * 60
  ): Promise<Data> {

    if (transferDetails.length === 0)  throw new Error("transferDetails empty")
   
    const now = getCurrentTimestamp();
    const owner = transferDetails[0].from;
    const rawDetails: PermitDetails[] = [];
    const details: PermitDetails[] = [];
    
    await Promise.all(
      transferDetails.map(async ({ from, token, amount }) => {
        try {
          const packedAllowance = await this.permit2.allowance(from, token, this.module);
          rawDetails.push( 
            {
              token,
              amount,
              expiration: now + expiresIn,
              nonce: packedAllowance.nonce
            }
          )
        } catch (error) {
          // error
        }
      })
    );

    // Aggregate same token amount
    for (let index = 0; index < rawDetails.length; index++) {
      const detail = rawDetails[index];
      const existsPermit = details.find(_ => _.token === detail.token);
      if (!existsPermit) {
        details.push(detail);
      } else {
        existsPermit.amount = bn(existsPermit.amount).add(bn(detail.amount))
      }
    }

    const permitBatch = {
      details,
      spender: this.module,
      sigDeadline: now + expiresIn,
    };
    
    return {
      owner,
      permitBatch,
      transferDetails,
    }
  }

  public getSignatureData(permit2Approval: Data) {
    const signatureData = AllowanceTransfer.getPermitData(
      permit2Approval.permitBatch,
      Sdk.Common.Addresses.Permit2[this.chainId],
      this.chainId
    );
    return {
      signatureKind: "eip712",
      domain: signatureData.domain,
      types: signatureData.types,
      value: signatureData.values
    }
  }

  public attachAndCheckSignature(
    permit2Approval: Data,
    signature: string
  ) {

    const signatureData = this.getSignatureData(permit2Approval);
    const signer = verifyTypedData(
      signatureData.domain,
      signatureData.types,
      signatureData.value,
      signature
    );

    if(signer.toLowerCase() != permit2Approval.owner.toLowerCase()) {
      throw new Error('invalid signature')
    }

    permit2Approval.signature = signature;
  }

  public attachToRouterExecution(
    txData: TxData,
    permitApprovals: Data[]
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
              module: this.module,
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