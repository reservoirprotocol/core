import { Provider } from "@ethersproject/abstract-provider";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { verifyTypedData } from "@ethersproject/wallet";

import * as Addresses from "./addresses";
import { Builders } from "./builders";
import { BaseBundleBuilder, BaseBundleOrderInfo } from "./builders/base/bundle";
import * as Types from "./types";
import * as Common from "../common";
import { bn, lc, n, s } from "../utils";

import ConduitControllerAbi from "./abis/ConduitController.json";
import ExchangeAbi from "./abis/Exchange.json";

export class BundleOrder {
  public chainId: number;
  public params: Types.OrderComponents;

  constructor(chainId: number, params: Types.OrderComponents) {
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

  public hash() {
    return _TypedDataEncoder.hashStruct(
      "OrderComponents",
      ORDER_EIP712_TYPES,
      this.params
    );
  }

  public async sign(signer: TypedDataSigner) {
    const signature = await signer._signTypedData(
      EIP712_DOMAIN(this.chainId),
      ORDER_EIP712_TYPES,
      this.params
    );

    this.params = {
      ...this.params,
      signature,
    };
  }

  public getSignatureData() {
    return {
      signatureKind: "eip712",
      domain: EIP712_DOMAIN(this.chainId),
      types: ORDER_EIP712_TYPES,
      value: this.params,
    };
  }

  public checkSignature() {
    const signer = verifyTypedData(
      EIP712_DOMAIN(this.chainId),
      ORDER_EIP712_TYPES,
      this.params,
      this.params.signature!
    );

    if (lc(this.params.offerer) !== lc(signer)) {
      throw new Error("Invalid signature");
    }
  }

  public checkValidity() {
    if (!this.getBuilder().isValid(this)) {
      throw new Error("Invalid order");
    }
  }

  public getMatchingPrice(): BigNumber {
    const info = this.getInfo();
    if (!info) {
      throw new Error("Could not get order info");
    }

    if (this.params.kind === "bundle-ask") {
      return bn((info as any).price).add(this.getFeeAmount());
    }

    return bn(0);
  }

  public getInfo(): BaseBundleOrderInfo | undefined {
    return this.getBuilder().getInfo(this);
  }

  public getFeeAmount(): BigNumber {
    const info = this.getBuilder()!.getInfo(this)!;

    if (info.fees) {
      let feeAmount = bn(0);
      for (const { amount } of info.fees) {
        feeAmount = feeAmount.add(amount);
      }
      return feeAmount;
    }

    return bn(0);
  }

  public buildMatching(data?: any) {
    return this.getBuilder().buildMatching(this, data);
  }

  public async checkFillability(provider: Provider) {
    const conduitController = new Contract(
      Addresses.ConduitController[this.chainId],
      ConduitControllerAbi as any,
      provider
    );
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any,
      provider
    );

    const status = await exchange.getOrderStatus(this.hash());
    if (status.isCancelled) {
      throw new Error("not-fillable");
    }
    if (status.isValidated && bn(status.totalFilled).gte(status.totalSize)) {
      throw new Error("not-fillable");
    }

    const makerConduit =
      this.params.conduitKey === HashZero
        ? Addresses.Exchange[this.chainId]
        : await conduitController
            .getConduit(this.params.conduitKey)
            .then((result: { exists: boolean; conduit: string }) => {
              if (!result.exists) {
                throw new Error("invalid-conduit");
              } else {
                return result.conduit;
              }
            });

    for (const item of this.getInfo()!.offerItems) {
      if (item.tokenKind === "erc20") {
        // Check that maker has enough balance to cover the payment
        // and the approval to the corresponding conduit is set
        const erc20 = new Common.Helpers.Erc20(provider, item.amount!);
        const balance = await erc20.getBalance(this.params.offerer);
        if (bn(balance).lt(item.amount!)) {
          throw new Error("no-balance");
        }

        // Check allowance
        const allowance = await erc20.getAllowance(
          this.params.offerer,
          makerConduit
        );
        if (bn(allowance).lt(item.amount!)) {
          throw new Error("no-approval");
        }
      } else if (item.tokenKind === "erc721") {
        const erc721 = new Common.Helpers.Erc721(provider, item.contract);

        // Check ownership
        const owner = await erc721.getOwner(item.tokenId!);
        if (lc(owner) !== lc(this.params.offerer)) {
          throw new Error("no-balance");
        }

        // Check approval
        const isApproved = await erc721.isApproved(
          this.params.offerer,
          makerConduit
        );
        if (!isApproved) {
          throw new Error("no-approval");
        }
      } else {
        const erc1155 = new Common.Helpers.Erc1155(provider, item.contract);

        // Check balance
        const balance = await erc1155.getBalance(
          this.params.offerer,
          item.tokenId!
        );
        if (bn(balance).lt(item.amount || 1)) {
          throw new Error("no-balance");
        }

        // Check approval
        const isApproved = await erc1155.isApproved(
          this.params.offerer,
          makerConduit
        );
        if (!isApproved) {
          throw new Error("no-approval");
        }
      }
    }
  }

  private getBuilder(): BaseBundleBuilder {
    switch (this.params.kind) {
      case "bundle-ask": {
        return new Builders.Bundle.BundleAsk(this.chainId);
      }

      default: {
        throw new Error("Unknown order kind");
      }
    }
  }

  private detectKind(): Types.OrderKind {
    // bundle-ask
    {
      const builder = new Builders.Bundle.BundleAsk(this.chainId);
      if (builder.isValid(this)) {
        return "bundle-ask";
      }
    }

    throw new Error(
      "Could not detect order kind (order might have unsupported params/calldata)"
    );
  }
}

const EIP712_DOMAIN = (chainId: number) => ({
  name: "Seaport",
  version: "1.1",
  chainId,
  verifyingContract: Addresses.Exchange[chainId],
});

export const ORDER_EIP712_TYPES = {
  OrderComponents: [
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" },
    { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
};

const normalize = (order: Types.OrderComponents): Types.OrderComponents => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    kind: order.kind,
    offerer: lc(order.offerer),
    zone: lc(order.zone),
    offer: order.offer.map((o) => ({
      itemType: n(o.itemType),
      token: lc(o.token),
      identifierOrCriteria: s(o.identifierOrCriteria),
      startAmount: s(o.startAmount),
      endAmount: s(o.endAmount),
    })),
    consideration: order.consideration.map((c) => ({
      itemType: n(c.itemType),
      token: lc(c.token),
      identifierOrCriteria: s(c.identifierOrCriteria),
      startAmount: s(c.startAmount),
      endAmount: s(c.endAmount),
      recipient: lc(c.recipient),
    })),
    orderType: n(order.orderType),
    startTime: n(order.startTime),
    endTime: n(order.endTime),
    zoneHash: lc(order.zoneHash),
    salt: s(order.salt),
    conduitKey: lc(order.conduitKey),
    counter: s(order.counter),
    signature: order.signature ? lc(order.signature) : undefined,
  };
};
