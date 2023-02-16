import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { Addresses, Types } from "..";
import { Complication } from "./complication.interface";
import { ORDER_EIP712_TYPES } from "./constants";
import { joinSignature, verifyTypedData } from "ethers/lib/utils";
import { lc } from "../../utils";
import { OrderParams } from "../order-params";
import { Contract, Signature } from "ethers";
import { Provider } from "@ethersproject/abstract-provider";
import ComplicationV2Abi from "../abis/ComplicationV2.json";
import * as CommonAddresses from "../../common/addresses";

export class ComplicationV2 implements Complication {
  static supportsAddress(address: string): boolean {
    return Object.values(Addresses.ComplicationV2).includes(address);
  }

  public get domain() {
    return {
      name: "FlowComplication",
      version: "1",
      chainId: this.chainId,
      verifyingContract: this.address,
    };
  }

  public readonly address: string;
  constructor(public readonly chainId: number) {
    this.address = Addresses.ComplicationV2[chainId] || "";
  }

  async sign(
    signer: TypedDataSigner,
    params: Types.InternalOrder
  ): Promise<string> {
    const { type, value, domain } = this.getSignatureData(params);
    const sig = await signer._signTypedData(domain, type, value);

    return sig;
  }

  verifySignature(sig: string, params: Types.InternalOrder): void {
    const { type, value, domain } = this.getSignatureData(params);

    const signer = verifyTypedData(domain, type, value, sig);

    if (lc(signer) !== lc(params.signer)) {
      throw new Error("Invalid signature");
    }
  }

  getSignatureData(params: Types.InternalOrder): Types.SignatureData {
    return {
      signatureKind: "eip712",
      domain: this.domain,
      type: ORDER_EIP712_TYPES,
      value: params,
    };
  }

  joinSignature(sig: Signature | { v: number; r: string; s: string }): string {
    return joinSignature(sig);
  }

  async checkFillability(
    provider: Provider,
    order: OrderParams
  ): Promise<void> {
    const complication = new Contract(
      this.address,
      ComplicationV2Abi,
      provider
    );

    if (order.currency !== CommonAddresses.Eth[this.chainId]) {
      const isCurrencyValid = await complication.isValidCurrency(
        order.currency
      );
      if (!isCurrencyValid) {
        throw new Error("not-fillable");
      }
    }
  }

  checkBaseValid() {
    if (!this.address) {
      throw new Error("Invalid chainId for complication");
    }
  }
}
