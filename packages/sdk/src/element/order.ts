import { Provider } from "@ethersproject/abstract-provider";
import { TypedDataSigner, VoidSigner } from "@ethersproject/abstract-signer";
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
import { bn, lc, n, s } from "../utils";

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
    const raw = this.params.kind?.startsWith("erc721")
      ? toRawErc721Order(this)
      : toRawErc1155Order(this);
    return raw;
  }

  public hash() {
    const [types, value] = this.getEip712TypesAndValue();
    return _TypedDataEncoder.hash(EIP712_DOMAIN(this.chainId), types, value);
  }

  public async sign(signer: TypedDataSigner) {
    const [types, value] = this.getEip712TypesAndValue();
    const { v, r, s } = splitSignature(
      await signer._signTypedData(EIP712_DOMAIN(this.chainId), types, value)
    );

    this.params = {
      ...this.params,
      signatureType: 0,
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

    if (lc(this.params.maker) !== lc(signer)) {
      throw new Error("Invalid signature");
    }
  }

  public checkValidity() {
    if (!this.getBuilder().isValid(this)) {
      throw new Error("Invalid order");
    }
  }

  public getInfo(): BaseOrderInfo | undefined {
    return this.getBuilder().getInfo(this);
  }

  public async checkFillability(provider: Provider) {
    const chainId = await provider.getNetwork().then((n) => n.chainId);

    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi as any,
      provider
    );

    let status: number | undefined;
    if (this.params.kind?.startsWith("erc721")) {
      status =
        this.params.direction === Types.TradeDirection.SELL
          ? await exchange.getERC721SellOrderStatus(toRawErc721Order(this))
          : await exchange.getERC721BuyOrderStatus(toRawErc721Order(this));
    } else {
      ({ status } =
        this.params.direction === Types.TradeDirection.SELL
          ? await exchange.getERC1155SellOrderInfo(toRawErc1155Order(this))
          : await exchange.getERC1155BuyOrderInfo(toRawErc1155Order(this)));
    }

    if (status !== 1) {
      throw new Error("not-fillable");
    }

    // Determine the order's fees (which are to be payed by the buyer)
    let feeAmount = this.getFeeAmount();

    if (this.params.direction === Types.TradeDirection.BUY) {
      // Check that maker has enough balance to cover the payment
      // and the approval to the token transfer proxy is set
      const erc20 = new Common.Helpers.Erc20(provider, this.params.erc20Token);
      const balance = await erc20.getBalance(this.params.maker);
      if (bn(balance).lt(bn(this.params.erc20TokenAmount).add(feeAmount))) {
        throw new Error("no-balance");
      }

      // Check allowance
      const allowance = await erc20.getAllowance(
        this.params.maker,
        Addresses.Exchange[chainId]
      );
      if (bn(allowance).lt(bn(this.params.erc20TokenAmount).add(feeAmount))) {
        throw new Error("no-approval");
      }
    } else {
      if (this.params.kind?.startsWith("erc721")) {
        const erc721 = new Common.Helpers.Erc721(provider, this.params.nft);

        // Check ownership
        const owner = await erc721.getOwner(this.params.nftId);
        if (lc(owner) !== lc(this.params.maker)) {
          throw new Error("no-balance");
        }

        // Check approval
        const isApproved = await erc721.isApproved(
          this.params.maker,
          Addresses.Exchange[this.chainId]
        );
        if (!isApproved) {
          throw new Error("no-approval");
        }
      } else {
        const erc1155 = new Common.Helpers.Erc1155(provider, this.params.nft);

        // Check balance
        const balance = await erc1155.getBalance(
          this.params.maker,
          this.params.nftId
        );
        if (bn(balance).lt(this.params.nftAmount!)) {
          throw new Error("no-balance");
        }

        // Check approval
        const isApproved = await erc1155.isApproved(
          this.params.maker,
          Addresses.Exchange[this.chainId]
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

  public getFeeAmount(): BigNumber {
    let feeAmount = bn(0);
    for (const { amount } of this.params.fees) {
      feeAmount = feeAmount.add(amount);
    }
    return feeAmount;
  }

  private getEip712TypesAndValue() {
    const isSell = this.params.direction === Types.TradeDirection.SELL;
    if (!this.params.nftAmount) {
      if (isSell) {
        return [
          NFT_SELL_ORDER_EIP712_TYPES,
          toRawErc721Order(this),
          "NFTSellOrder",
        ];
      } else {
        return [
          NFT_BUY_ORDER_EIP712_TYPES,
          toRawErc721Order(this),
          "NFTBuyOrder",
        ];
      }
    } else {
      if (isSell) {
        return [
          ERC1155_SELL_ORDER_EIP712_TYPES,
          toRawErc1155Order(this),
          "ERC1155SellOrder",
        ];
      } else {
        return [
          ERC1155_BUY_ORDER_EIP712_TYPES,
          toRawErc1155Order(this),
          "ERC1155BuyOrder",
        ];
      }
    }
  }

  private getBuilder(): BaseBuilder {
    switch (this.params.kind) {
      case "erc721-contract-wide":
      case "erc1155-contract-wide": {
        return new Builders.ContractWide(this.chainId);
      }

      case "erc721-single-token":
      case "erc1155-single-token": {
        return new Builders.SingleToken(this.chainId);
      }

      default: {
        throw new Error("Unknown order kind");
      }
    }
  }

  private detectKind(): Types.OrderKind {
    // contract-wide
    {
      const builder = new Builders.ContractWide(this.chainId);
      if (builder.isValid(this)) {
        return this.params.nftAmount
          ? "erc1155-contract-wide"
          : "erc721-contract-wide";
      }
    }

    // single-token
    {
      const builder = new Builders.SingleToken(this.chainId);
      if (builder.isValid(this)) {
        return this.params.nftAmount
          ? "erc1155-single-token"
          : "erc721-single-token";
      }
    }

    throw new Error(
      "Could not detect order kind (order might have unsupported params/calldata)"
    );
  }
}

const EIP712_DOMAIN = (chainId: number) => ({
  name: "ElementEx",
  version: "1.0.0",
  chainId,
  verifyingContract: Addresses.Exchange[chainId],
});

const NFT_BUY_ORDER_EIP712_TYPES = {
  Fee: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "feeData", type: "bytes" },
  ],
  Property: [
    { name: "propertyValidator", type: "address" },
    { name: "propertyData", type: "bytes" },
  ],
  NFTBuyOrder: [
    { type: "address", name: "maker" },
    { type: "address", name: "taker" },
    { type: "uint256", name: "expiry" },
    { type: "uint256", name: "nonce" },
    { type: "address", name: "erc20Token" },
    { type: "uint256", name: "erc20TokenAmount" },
    { type: "Fee[]", name: "fees" },
    { type: "address", name: "nft" },
    { type: "uint256", name: "nftId" },
    { type: "Property[]", name: "nftProperties" },
    { type: "uint256", name: "hashNonce" },
  ],
};

const NFT_SELL_ORDER_EIP712_TYPES = {
  NFTSellOrder: [
    { type: "address", name: "maker" },
    { type: "address", name: "taker" },
    { type: "uint256", name: "expiry" },
    { type: "uint256", name: "nonce" },
    { type: "address", name: "erc20Token" },
    { type: "uint256", name: "erc20TokenAmount" },
    { type: "Fee[]", name: "fees" },
    { type: "address", name: "nft" },
    { type: "uint256", name: "nftId" },
    { type: "uint256", name: "hashNonce" },
  ],
  Fee: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "feeData", type: "bytes" },
  ],
};

const ERC1155_BUY_ORDER_EIP712_TYPES = {
  ERC1155BuyOrder: [
    { name: "maker", type: "address" },
    { name: "taker", type: "address" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "erc20Token", type: "address" },
    { name: "erc20TokenAmount", type: "uint256" },
    { name: "fees", type: "Fee[]" },
    { name: "erc1155Token", type: "address" },
    { name: "erc1155TokenId", type: "uint256" },
    { name: "erc1155TokenProperties", type: "Property[]" },
    { name: "erc1155TokenAmount", type: "uint128" },
    { type: "uint256", name: "hashNonce" },
  ],
  Fee: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "feeData", type: "bytes" },
  ],
  Property: [
    { name: "propertyValidator", type: "address" },
    { name: "propertyData", type: "bytes" },
  ],
};

const ERC1155_SELL_ORDER_EIP712_TYPES = {
  ERC1155SellOrder: [
    { name: "maker", type: "address" },
    { name: "taker", type: "address" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "erc20Token", type: "address" },
    { name: "erc20TokenAmount", type: "uint256" },
    { name: "fees", type: "Fee[]" },
    { name: "erc1155Token", type: "address" },
    { name: "erc1155TokenId", type: "uint256" },
    { name: "erc1155TokenAmount", type: "uint128" },
    { name: "hashNonce", type: "uint256" },
  ],
  Fee: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "feeData", type: "bytes" },
  ],
};

const toRawErc721Order = (order: Order): any => ({
  ...order.params,
  erc721Token: order.params.nft,
  erc721TokenId: order.params.nftId,
  erc721TokenProperties: order.params.nftProperties,
});

const toRawErc1155Order = (order: Order): any => ({
  ...order.params,
  erc1155Token: order.params.nft,
  erc1155TokenId: order.params.nftId,
  erc1155TokenProperties: order.params.nftProperties,
  erc1155TokenAmount: order.params.nftAmount,
});

const normalize = (order: Types.BaseOrder): Types.BaseOrder => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    kind: order.kind,
    direction: order.direction,
    maker: lc(order.maker),
    taker: lc(order.taker),
    expiry: s(order.expiry),
    nonce: s(order.nonce),
    hashNonce: s(order.hashNonce),
    erc20Token: lc(order.erc20Token),
    erc20TokenAmount: s(order.erc20TokenAmount),
    fees: order.fees.map(({ recipient, amount, feeData }) => ({
      recipient: lc(recipient),
      amount: s(amount),
      feeData: lc(feeData),
    })),
    nft: lc(order.nft),
    nftId: s(order.nftId),
    nftProperties: order.nftProperties.map(
      ({ propertyValidator, propertyData }) => ({
        propertyValidator: lc(propertyValidator),
        propertyData: lc(propertyData),
      })
    ),
    nftAmount: order.nftAmount ? s(order.nftAmount) : undefined,
    signatureType: order.signatureType ?? 0,
    v: order.v ?? 0,
    r: order.r ?? HashZero,
    s: order.s ?? HashZero,
  };
};
