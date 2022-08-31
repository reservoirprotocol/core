import { Provider } from "@ethersproject/abstract-provider";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { splitSignature } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { verifyTypedData } from "@ethersproject/wallet";
import * as Addresses from "./addresses";
import { Builders } from "./builders";
import { BaseBuilder } from "./builders/base";
import * as Types from "./types";
import * as Common from "../common";
import { bn, lc, n, s } from "../utils";
import ExchangeAbi from "./abis/Exchange.json";

export class Order {
  public chainId: number;
  public params: Types.MakerOrderParams;

  constructor(chainId: number, params: Types.MakerOrderParams) {
    this.chainId = chainId;

    try {
      this.params = normalize(params);
    } catch {
      throw new Error("Invalid params");
    }
  }

  public hash() {
    return _TypedDataEncoder.hashStruct(
      "MakerOrder",
      EIP712_TYPES,
      this.params
    );
  }

  public async sign(signer: TypedDataSigner) {
    const { v, r, s } = splitSignature(
      await signer._signTypedData(
        EIP712_DOMAIN(this.chainId),
        EIP712_TYPES,
        this.params
      )
    );

    this.params = {
      ...this.params,
      v,
      r,
      s,
    };
  }

  public getSignatureData() {
    return {
      signatureKind: "eip712",
      domain: EIP712_DOMAIN(this.chainId),
      types: EIP712_TYPES,
      value: toRawOrder(this),
    };
  }

  public checkSignature() {
    const signer = verifyTypedData(
      EIP712_DOMAIN(this.chainId),
      EIP712_TYPES,
      this.params,
      this.params.signature!
    );

    if (lc(this.params.signer) !== lc(signer)) {
      throw new Error("Invalid signature");
    }
  }

  public checkValidity() {
    if (!this.getBuilder().isValid(this)) {
      throw new Error("Invalid order");
    }
  }

  public async checkFillability(provider: Provider) {
    const chainId = await provider.getNetwork().then((n) => n.chainId);

    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any,
      provider
    );

    const executedOrCancelled =
      await exchange.isUserOrderNonceExecutedOrCancelled(
        this.params.signer,
        this.params.nonce
      );
    if (executedOrCancelled) {
      throw new Error("executed-or-cancelled");
    }

    const erc721 = new Common.Helpers.Erc721(
      provider,
      this.params._tokenContract
    );

    // Check ownership
    const owner = await erc721.getOwner(this.params._tokenId);
    if (lc(owner) !== lc(this.params.signer)) {
      throw new Error("no-balance");
    }

    // Check approval
    const isApproved = await erc721.isApproved(
      this.params.signer,
      Addresses.Erc721TransferHelper[this.chainId]
    );
    if (!isApproved) {
      throw new Error("no-approval");
    }
  }

  public buildMatching(taker: string, data?: any) {
    return this.getBuilder().buildMatching(this, taker, data);
  }

  private getBuilder(): BaseBuilder {
    return new Builders.SingleToken(this.chainId);
  }
}

const EIP712_DOMAIN = (chainId: number) => ({
  name: "ZoraExchange",
  version: "1",
  chainId,
  verifyingContract: Addresses.Exchange[chainId],
});

const EIP712_TYPES = {
  MakerOrder: [
    // https://github.com/ourzora/v3/blob/main/contracts/modules/Asks/V1.1/AsksV1_1.sol#L117-L131
    { name: "_tokenContract", type: "address" },
    { name: "_tokenId", type: "uint256" },
    { name: "_askPrice", type: "uint256" },
    { name: "_askCurrency", type: "address" },
    { name: "_sellerFundsRecipient", type: "address" },
    { name: "_findersFeeBps", type: "uint16" },
  ],
};

const toRawOrder = (order: Order): any => ({
  ...order.params,
});

const normalize = (order: Types.MakerOrderParams): Types.MakerOrderParams => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    _askCurrency: order._askCurrency,
    _askPrice: order._askPrice,
    _findersFeeBps: order._findersFeeBps,
    _sellerFundsRecipient: order._sellerFundsRecipient,
    _tokenContract: order._tokenContract,
    _tokenId: order._tokenId,
  };
};
