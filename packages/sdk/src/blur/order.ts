import { Provider } from "@ethersproject/abstract-provider";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { splitSignature } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { verifyTypedData } from "@ethersproject/wallet";

import * as Addresses from "./addresses";
import { Builders } from "./builders";
import { BaseBuilder, BaseOrderInfo } from "./builders/base";
import * as Types from "./types";
import * as Common from "../common";
import { bn, lc, n, s, BytesEmpty } from "../utils";
import ExchangeAbi from "./abis/Exchange.json";

export class Order {
  public chainId: number;
  public params: Types.BaseOrder;

  constructor(chainId: number, params: Types.BaseOrder) {
    this.chainId = chainId;

    try {
      this.params = normalize(params);
    } catch {
      throw new Error("Invalid params");
    }

    // Detect kind
    if (!params.kind) {
      this.params.kind = this.detectKind();
    }
  }

  public getRaw() {
    return {
      order: this.params,
      v: this.params.v,
      r: this.params.r ?? "",
      s: this.params.s ?? "",
      extraSignature: BytesEmpty,
      signatureVersion: 0,
      blockNumber: 0
    }
  }

  public hash() {
    const [types, value, structName] = this.getEip712TypesAndValue();
    return _TypedDataEncoder.hashStruct(structName, types, value);
  }

  public async sign(signer: TypedDataSigner) {
    const [types, value] = this.getEip712TypesAndValue();

    const { v, r, s } = splitSignature(
      await signer._signTypedData(EIP712_DOMAIN(this.chainId), types, value)
    );

    this.params = {
      ...this.params,
      signatureType: 2,
      v,
      r,
      s,
    };
  }

  public getSignatureData() {
    const [types, value] = this.getEip712TypesAndValue();
    return {
      signatureKind: "eip712",
      domain: EIP712_DOMAIN(this.chainId),
      types,
      value,
    };
  }

  public checkSignature() {
    const [types, value] = this.getEip712TypesAndValue();

    const signer = verifyTypedData(EIP712_DOMAIN(this.chainId), types, value, {
      v: this.params.v,
      r: this.params.r ?? "",
      s: this.params.s ?? "",
    });

    if (lc(this.params.trader) !== lc(signer)) {
      throw new Error("Invalid signature");
    }
  }

  public checkValidity() {
    if (!this.getBuilder().isValid(this)) {
      throw new Error("Invalid order");
    }
  }

  // public getInfo(): BaseOrderInfo | undefined {
  //   return this.getBuilder().getInfo(this);
  // }

  public async checkFillability(provider: Provider) {
    const chainId = await provider.getNetwork().then((n) => n.chainId);

    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any,
      provider
    );

    let status: boolean = await exchange.cancelledOrFilled(this.hash());
    if (status) {
      throw new Error("not-fillable");
    }

    // Determine the order's fees (which are to be payed by the buyer)
    // let feeAmount = this.getFeeAmount();

    if (this.params.side === Types.TradeDirection.BUY) {
      // Check that maker has enough balance to cover the payment
      // and the approval to the token transfer proxy is set
      const erc20 = new Common.Helpers.Erc20(provider, this.params.paymentToken);
      const balance = await erc20.getBalance(this.params.trader);
      if (bn(balance).lt(bn(this.params.price))) {
        throw new Error("no-balance");
      }

      // Check allowance
      const allowance = await erc20.getAllowance(
        this.params.trader,
        Addresses.ExecutionDelegate[chainId]
      );
      if (bn(allowance).lt(bn(this.params.paymentToken))) {
        throw new Error("no-approval");
      }
    } else {
      if (this.params.kind?.startsWith("erc721")) {
        const erc721 = new Common.Helpers.Erc721(provider, this.params.collection);

        // Check ownership
        const owner = await erc721.getOwner(this.params.tokenId);
        if (lc(owner) !== lc(this.params.trader)) {
          throw new Error("no-balance");
        }

        // Check approval
        const isApproved = await erc721.isApproved(
          this.params.trader,
          Addresses.ExecutionDelegate[this.chainId]
        );
        if (!isApproved) {
          throw new Error("no-approval");
        }
      } else {
        const erc1155 = new Common.Helpers.Erc1155(provider, this.params.collection);

        // Check balance
        const balance = await erc1155.getBalance(
          this.params.trader,
          this.params.tokenId
        );

        if (bn(balance).lt(this.params.amount!)) {
          throw new Error("no-balance");
        }

        // Check approval
        const isApproved = await erc1155.isApproved(
          this.params.trader,
          Addresses.ExecutionDelegate[this.chainId]
        );
        if (!isApproved) {
          throw new Error("no-approval");
        }
      }
    }
  }

  public buildMatching(data?: any) {
    return this.getBuilder().buildMatching(this, data);
  }

  private getEip712TypesAndValue() {
    return [ORDER_EIP712_TYPES, toRawOrder(this), "Order"];
  }

  private getBuilder(): BaseBuilder {
    return new Builders.SingleToken(this.chainId);
  }

  private detectKind(): Types.OrderKind {
    if (this.params.matchingPolicy === Addresses.StandardPolicyERC721[this.chainId]) {
      return 'erc721-single-token'
    }

    throw new Error(
      "Could not detect order kind (order might have unsupported params/calldata)"
    );
  }
}

const EIP712_DOMAIN = (chainId: number) => ({
  name: "Blur Exchange",
  version: "1.0",
  chainId,
  verifyingContract: Addresses.Exchange[chainId],
});

const ORDER_EIP712_TYPES = {
  Order: [
    { name: 'trader', type: 'address' },
    { name: 'side', type: 'uint8' },
    { name: 'matchingPolicy', type: 'address' },
    { name: 'collection', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'paymentToken', type: 'address' },
    { name: 'price', type: 'uint256' },
    { name: 'listingTime', type: 'uint256' },
    { name: 'expirationTime', type: 'uint256' },
    { name: 'fees', type: 'Fee[]' },
    { name: 'salt', type: 'uint256' },
    { name: 'extraParams', type: 'bytes' },
    { name: 'nonce', type: 'uint256' },
  ],
  Fee: [
    { name: 'rate', type: 'uint16' },
    { name: 'recipient', type: 'address' },
  ]
};

const toRawOrder = (order: Order): any => ({
  ...order.params
});

const normalize = (order: Types.BaseOrder): Types.BaseOrder => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    side: order.side,
    trader: lc(order.trader),
    matchingPolicy: lc(order.matchingPolicy),
    collection: lc(order.collection),
    tokenId: n(order.tokenId),
    nonce: s(order.nonce),
    amount: s(order.amount),
    paymentToken: lc(order.paymentToken),
    price: s(order.price),
    listingTime: s(order.listingTime),
    fees: order.fees.map(({ recipient, rate }) => ({
      recipient: lc(recipient),
      rate: n(rate),
    })),
    expirationTime: s(order.expirationTime),
    extraParams: order.extraParams,
    salt: s(order.salt),
    signatureType: order.signatureType ?? 1,
    v: order.v ?? 0,
    r: order.r ?? HashZero,
    s: order.s ?? HashZero,
  };
};
