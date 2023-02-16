import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { Addresses, Types } from "..";
import { Complication } from "./complication.interface";
import { ORDER_EIP712_TYPES } from "./constants";
import { splitSignature } from "@ethersproject/bytes";
import { Contract, Signature } from "ethers";
import { defaultAbiCoder } from "@ethersproject/abi/lib/abi-coder";
import { verifyTypedData } from "ethers/lib/utils";
import { lc } from "../../utils";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider } from "@ethersproject/abstract-provider";
import ComplicationAbi from "../abis/Complication.json";
import { OrderParams } from "../order-params";
import * as CommonAddresses from "../../common/addresses";

export class ComplicationV1 implements Complication {
  static supportsAddress(address: string): boolean {
    return Object.values(Addresses.Complication).includes(address);
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
    this.address = Addresses.Complication[chainId] || "";
  }

  async sign(
    signer: TypedDataSigner,
    params: Types.InternalOrder
  ): Promise<string> {
    const { type, value, domain } = this.getSignatureData(params);
    const sig = splitSignature(
      await signer._signTypedData(domain, type, value)
    );
    const encodedSig = this._getEncodedSig(sig);
    return encodedSig;
  }

  verifySignature(encodedSig: string, params: Types.InternalOrder): void {
    const decodedSig = this._getDecodedSig(encodedSig);
    const { type, value, domain } = this.getSignatureData(params);

    const signer = verifyTypedData(domain, type, value, decodedSig);

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
    return this._getEncodedSig(sig);
  }

  async checkFillability(
    provider: Provider,
    order: OrderParams
  ): Promise<void> {
    const complication = new Contract(this.address, ComplicationAbi, provider);

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

  protected _getEncodedSig(
    signature: Signature | { v: number; r: string; s: string }
  ): string {
    const encodedSig = defaultAbiCoder.encode(
      ["bytes32", "bytes32", "uint8"],
      [signature.r, signature.s, signature.v]
    );

    return encodedSig;
  }

  protected _getDecodedSig(encodedSig: string): SignatureLike {
    const [r, s, v] = defaultAbiCoder.decode(
      ["bytes32", "bytes32", "uint8"],
      encodedSig
    );

    return { r, s, v };
  }
}
