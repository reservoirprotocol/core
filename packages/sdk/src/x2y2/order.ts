import { defaultAbiCoder } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { arrayify, splitSignature } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import { keccak256 } from "@ethersproject/solidity";
import { verifyMessage } from "@ethersproject/wallet";

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
    if (chainId !== 1) {
      throw new Error("Unsupported chain id");
    }

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
    return keccak256(
      ["bytes"],
      [
        defaultAbiCoder.encode(
          [
            "uint256",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "address",
            "bytes",
            "uint256",
            "(uint256,bytes)[]",
          ],
          [
            this.params.salt,
            this.params.user,
            this.params.network,
            this.params.intent,
            this.params.delegateType,
            this.params.deadline,
            this.params.currency,
            this.params.dataMask,
            this.params.items.length,
            this.params.items.map(({ price, data }) => [price, data]),
          ]
        ),
      ]
    );
  }

  public itemHash(itemId = 0) {
    return keccak256(
      ["bytes"],
      [
        defaultAbiCoder.encode(
          [
            "uint256",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "address",
            "bytes",
            "(uint256,bytes)",
          ],
          [
            this.params.salt,
            this.params.user,
            this.params.network,
            this.params.intent,
            this.params.delegateType,
            this.params.deadline,
            this.params.currency,
            this.params.dataMask,
            this.params.items.map(({ price, data }) => [price, data])[itemId],
          ]
        ),
      ]
    );
  }

  public async sign(signer: Signer) {
    const { v, r, s } = splitSignature(
      await signer.signMessage(arrayify(this.hash()))
    );
    this.params = {
      ...this.params,
      v,
      r,
      s,
      signVersion: Types.SignatureVersion.SIGN_V1,
    };
  }

  public getSignatureData() {
    return {
      signatureKind: "eip191",
      message: this.hash(),
    };
  }

  public checkSignature() {
    const signer = verifyMessage(arrayify(this.hash()), {
      v: this.params.v,
      r: this.params.r ?? "",
      s: this.params.s ?? "",
    });

    if (lc(this.params.user) !== lc(signer)) {
      throw new Error("Invalid signature");
    }
  }

  public checkValidity() {
    if (!this.getBuilder().isValid(this)) {
      throw new Error("Invalid order");
    }
  }

  public async checkFillability(provider: Provider, itemId = 0) {
    const chainId = await provider.getNetwork().then((n) => n.chainId);

    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any,
      provider
    );

    const inventoryStatus = await exchange.inventoryStatus(
      this.itemHash(itemId)
    );
    if (inventoryStatus !== Types.InventoryStatus.NEW) {
      throw new Error("executed-or-cancelled");
    }

    const item = this.params.items[itemId];
    if (this.params.intent === Types.Intent.SELL) {
      if (this.params.delegateType === Types.DelegationType.ERC721) {
        const [[[contract, tokenId]]] = defaultAbiCoder.decode(
          ["(address,uint256)[]"],
          item.data
        );

        const erc721 = new Common.Helpers.Erc721(provider, contract);

        // Check: ownership
        const owner = await erc721.getOwner(tokenId);
        if (lc(owner) !== lc(this.params.user)) {
          throw new Error("no-balance");
        }

        // Check: approval
        const isApproved = await erc721.isApproved(
          this.params.user,
          Addresses.Erc721Delegate[this.chainId]
        );
        if (!isApproved) {
          throw new Error("no-approval");
        }
      } else {
        throw new Error("invalid");
      }
    } else {
      // Check: balance
      const erc20 = new Common.Helpers.Erc20(provider, this.params.currency);
      const balance = await erc20.getBalance(this.params.user);
      if (bn(balance).lt(item.price)) {
        throw new Error("no-balance");
      }

      // Check: allowance
      const allowance = await erc20.getAllowance(
        this.params.user,
        Addresses.Exchange[chainId]
      );
      if (bn(allowance).lt(item.price)) {
        throw new Error("no-approval");
      }
    }
  }

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

  private detectKind(): Types.OrderKind {
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

const normalize = (order: Types.Order): Types.Order => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    kind: order.kind,
    salt: s(order.salt),
    user: lc(order.user),
    network: n(order.network),
    intent: n(order.intent),
    delegateType: n(order.delegateType),
    deadline: n(order.deadline),
    currency: lc(order.currency),
    dataMask: lc(order.dataMask),
    items: order.items.map(({ price, data }) => ({
      price: s(price),
      data: lc(data),
    })),
    v: order.v ?? 0,
    r: order.r ?? HashZero,
    s: order.s ?? HashZero,
    signVersion: n(order.signVersion),
  };
};
