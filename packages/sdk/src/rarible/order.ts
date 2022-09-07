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
  public params: Types.Order;

  constructor(chainId: number, params: Types.Order) {
    this.chainId = chainId;

    try {
      this.params = normalize(params);
    } catch {
      throw new Error("Invalid params");
    }
  }

  public hash() {
    return _TypedDataEncoder.hashStruct("Order", EIP712_TYPES, this.params);
  }

  public async sign(signer: TypedDataSigner) {
    const signature = await signer._signTypedData(
      EIP712_DOMAIN(this.chainId),
      EIP712_TYPES,
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
      types: EIP712_TYPES,
      value: toRawOrder(this),
    };
  }

  public checkSignature() {
    const signer = verifyTypedData(
      EIP712_DOMAIN(this.chainId),
      EIP712_TYPES,
      toRawOrder(this),
      this.params.signature!
    );

    if (lc(this.params.maker) !== lc(signer)) {
      throw new Error("Invalid signature");
    }
  }

  public checkValidity() {
    if (!this.getBuilder().isValid(this)) {
      throw new Error("Invalid order");
    }
  }

  // public async checkFillability(provider: Provider) {
  //   const chainId = await provider.getNetwork().then((n) => n.chainId);

  //   const exchange = new Contract(
  //     Addresses.Exchange[this.chainId],
  //     ExchangeAbi as any,
  //     provider
  //   );

  //   const executedOrCancelled =
  //     await exchange.isUserOrderNonceExecutedOrCancelled(
  //       this.params.signer,
  //       this.params.nonce
  //     );
  //   if (executedOrCancelled) {
  //     throw new Error("executed-or-cancelled");
  //   }

  //   if (this.params.isOrderAsk) {
  //     // Detect the collection kind (erc721 or erc1155)
  //     let kind: string | undefined;
  //     if (!kind) {
  //       const erc721 = new Common.Helpers.Erc721(
  //         provider,
  //         this.params.collection
  //       );
  //       if (await erc721.isValid()) {
  //         kind = "erc721";

  //         // Check ownership
  //         const owner = await erc721.getOwner(this.params.tokenId);
  //         if (lc(owner) !== lc(this.params.signer)) {
  //           throw new Error("no-balance");
  //         }

  //         // Check approval
  //         const isApproved = await erc721.isApproved(
  //           this.params.signer,
  //           Addresses.Exchange[this.chainId]
  //         );
  //         if (!isApproved) {
  //           throw new Error("no-approval");
  //         }
  //       }
  //     }
  //     if (!kind) {
  //       const erc1155 = new Common.Helpers.Erc1155(
  //         provider,
  //         this.params.collection
  //       );
  //       if (await erc1155.isValid()) {
  //         kind = "erc1155";

  //         // Check balance
  //         const balance = await erc1155.getBalance(
  //           this.params.signer,
  //           this.params.tokenId
  //         );
  //         if (bn(balance).lt(1)) {
  //           throw new Error("no-balance");
  //         }

  //         // Check approval
  //         const isApproved = await erc1155.isApproved(
  //           this.params.signer,
  //           Addresses.Exchange[this.chainId]
  //         );
  //         if (!isApproved) {
  //           throw new Error("no-approval");
  //         }
  //       }
  //     }

  //     if (!kind) {
  //       throw new Error("invalid");
  //     }
  //   } else {
  //     // Check that maker has enough balance to cover the payment
  //     // and the approval to the token transfer proxy is set
  //     const erc20 = new Common.Helpers.Erc20(provider, this.params.currency);
  //     const balance = await erc20.getBalance(this.params.signer);
  //     if (bn(balance).lt(this.params.price)) {
  //       throw new Error("no-balance");
  //     }

  //     // Check allowance
  //     const allowance = await erc20.getAllowance(
  //       this.params.signer,
  //       Addresses.Exchange[chainId]
  //     );
  //     if (bn(allowance).lt(this.params.price)) {
  //       throw new Error("no-approval");
  //     }
  //   }
  // }

  public buildMatching(taker: string, data?: any) {
    return this.getBuilder().buildMatching(this, taker, data);
  }

  private getBuilder(): BaseBuilder {
    switch (this.params.kind) {
      case "single-token": {
        return new Builders.SingleToken(this.chainId);
      }

      default: {
        throw new Error("Unknown order kind");
      }
    }
  }

  private detectKind(): Types.Order["kind"] {
    // single-token
    {
      const builder = new Builders.SingleToken(this.chainId);
      if (builder.isValid(this)) {
        return "single-token";
      }
    }

    throw new Error(
      "Could not detect order kind (order might have unsupported params/calldata)"
    );
  }
}

const EIP712_DOMAIN = (chainId: number) => ({
  name: "RaribleExchange",
  version: "1",
  chainId,
  verifyingContract: Addresses.Exchange[chainId],
});

const EIP712_TYPES = {
  Order: [
    { name: "maker", type: "address" },
    { name: "makeAsset", type: "Asset[]" },
    { name: "taker", type: "address" },
    { name: "takeAsset", type: "Asset[]" },
    { name: "salt", type: "uint256" },
    { name: "start", type: "uint256" },
    { name: "end", type: "uint256" },
    { name: "dataType", type: "bytes4" },
    { name: "data", type: "bytes" },
  ],
  Asset: [
    { name: "assetType", type: "AssetType[]" },
    { name: "value", type: "uint256" },
  ],
  AssetType: [
    { name: "assetClass", type: "bytes4" },
    { name: "data", type: "bytes" },
  ],
};

const toRawOrder = (order: Order): any => ({
  ...order.params,
});

const normalize = (order: Types.Order): Types.Order => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    kind: order.kind,
    maker: lc(order.maker),
    makeAsset: {
      assetType: {
        assetClass: s(order.makeAsset.assetType.assetClass),
        data: s(order.makeAsset.assetType.data),
      },
      value: s(order.makeAsset.value),
    },
    taker: lc(order.taker),
    takeAsset: {
      assetType: {
        assetClass: s(order.makeAsset.assetType.assetClass),
        data: s(order.makeAsset.assetType.data),
      },
      value: s(order.makeAsset.value),
    },
    salt: n(order.salt),
    start: n(order.start),
    end: n(order.end),
    dataType: s(order.dataType),
    data: s(order.data),
    signature: order.signature,
  };
};
