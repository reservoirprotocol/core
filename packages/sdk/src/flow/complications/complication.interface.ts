import {
  TypedDataDomain,
  TypedDataField,
  TypedDataSigner,
} from "@ethersproject/abstract-signer";
import { Types } from "..";
import { Provider } from "@ethersproject/providers";
import { OrderParams } from "../order-params";
import { Signature } from "@ethersproject/bytes";

export interface Complication {
  domain: TypedDataDomain;

  address: string;

  sign(signer: TypedDataSigner, params: Types.InternalOrder): Promise<string>;

  verifySignature(sig: string, params: Types.InternalOrder): void;

  getSignatureData(params: Types.InternalOrder): Types.SignatureData;

  checkFillability(provider: Provider, order: OrderParams): Promise<void>;

  checkBaseValid(): void;

  joinSignature(sig: Signature | { v: number; r: string; s: string }): string;
}
