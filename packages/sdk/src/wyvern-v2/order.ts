import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { arrayify, splitSignature } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { hashMessage } from "@ethersproject/hash";
import { keccak256 } from "@ethersproject/solidity";
import { verifyMessage } from "@ethersproject/wallet";

import * as Addresses from "./addresses";
import { ProxyRegistry } from "./helpers";
import { Builders } from "./builders";
import * as Types from "./types";
import * as Common from "../common";
import { bn, lc, n, s } from "../utils";
import { BaseBuilder } from "./builders/base";

/**
 * The Wyvern v2 order interface provides functionality to interact with Project Wyvern Ethereum Smart Contracts and read data from the blockchain about order's current state.
 */
export class Order {
  /**
   * The chain ID for the Ethereum network to be used. For example, 1 for Ethereum Mainnet and 4 for Rinkeby Testnet.
   */
  public chainId: number;
  /**
   * The order parameters obtained from an API or built locally.
   */
  public params: Types.OrderParams;

  /**
   * 
   * @param chainId The chain ID for the Ethereum network to be used. For example, 1 for Ethereum Mainnet and 4 for Rinkeby Testnet.
   * @param params The order parameters obtained from an API or built locally.
   */
  constructor(chainId: number, params: Types.OrderParams) {
    if (chainId !== 1 && chainId !== 4) {
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

    // Perform light validations

    // Validate fees
    if (
      this.params.makerRelayerFee > 10000 ||
      this.params.takerRelayerFee > 10000
    ) {
      throw new Error("Invalid fees");
    }

    // Validate side
    if (
      this.params.side !== Types.OrderSide.BUY &&
      this.params.side !== Types.OrderSide.SELL
    ) {
      throw new Error("Invalid side");
    }

    // Validate sale kind
    if (this.params.saleKind !== Types.OrderSaleKind.FIXED_PRICE) {
      // Support for dutch auctions will come later
      throw new Error("Invalid sale kind");
    }

    // Validate call method
    if (
      this.params.howToCall !== Types.OrderHowToCall.CALL &&
      this.params.howToCall !== Types.OrderHowToCall.DELEGATE_CALL
    ) {
      throw new Error("Invalid call method");
    }

    // Validate listing and expiration times
    if (
      this.params.expirationTime !== 0 &&
      this.params.listingTime >= this.params.expirationTime
    ) {
      throw new Error("Invalid listing and/or expiration time");
    }

    // Validate exchange
    if (this.params.exchange !== Addresses.Exchange[this.chainId]) {
      throw new Error("Invalid exchange");
    }
  }

  /**
   * 
   * @returns The order's keccak256 hash
   */
  public hash() {
    return keccak256(RAW_ORDER_FIELDS, toRaw(this.params));
  }

  /**
   * 
   * @returns The order's EIP191 prefix hash
   */
  public prefixHash() {
    return hashMessage(arrayify(this.hash()));
  }

  /**
   * Sign the Wyvern v2 order
   * @param signer Abstracted Ethereum account, usually as a JsonRpcSigner
   */
  public async sign(signer: Signer) {
    const signerChainId = await signer.getChainId();
    if (this.chainId !== signerChainId) {
      throw new Error("Wrong chain id");
    }

    const signerAddress = await signer.getAddress();
    if (lc(this.params.maker) !== lc(signerAddress)) {
      throw new Error("Wrong signer");
    }

    const { v, r, s } = await signer
      .signMessage(arrayify(this.hash()))
      .then(splitSignature);

    this.params = {
      ...this.params,
      v,
      r,
      s,
    };
  }

  /**
   * Build a matching buy order for a sell order and vice versa
   * @param taker The taker's Ethereum address
   * @param data Any aditional arguments
   * @returns The matching Wyvern v2 order
   */
  public buildMatching(taker: string, data?: any[]) {
    return this.getBuilder().buildMatching(this, taker, ...(data || []));
  }

  /**
   * Check the validity of the order's signature
   */
  public async checkSignature() {
    const signer = verifyMessage(arrayify(this.hash()), {
      v: this.params.v,
      r: this.params.r ?? "",
      s: this.params.s ?? "",
    });

    if (lc(this.params.maker) !== lc(signer)) {
      throw new Error("Invalid signature");
    }
  }

  /**
   * Check the order's validity
   */
  public checkValidity() {
    if (!this.getBuilder().isValid(this)) {
      throw new Error("Invalid order");
    }
  }

  // TODO: Use multicall for speed/efficiency
  /**
   * Check the order's fillability
   * @param provider A read-only abstraction to access the blockchain data
   */
  public async checkFillability(provider: Provider) {
    const chainId = await provider.getNetwork().then((n) => n.chainId);

    if (this.params.side === Types.OrderSide.BUY) {
      // Check that maker has enough balance to cover the payment
      // and the approval to the token transfer proxy is set

      const erc20 = new Common.Helpers.Erc20(
        provider,
        this.params.paymentToken
      );

      // Check balance
      const balance = await erc20.getBalance(this.params.maker);
      if (bn(balance).lt(this.params.basePrice)) {
        throw new Error("Insufficient balance");
      }

      // Check allowance
      const allowance = await erc20.getAllowance(
        this.params.maker,
        Addresses.TokenTransferProxy[chainId]
      );
      if (bn(allowance).lt(this.params.basePrice)) {
        throw new Error("Insufficient allowance");
      }
    } else {
      // Check that maker owns the token id put on sale and
      // the approval to the make'rs proxy is set

      const proxyRegistry = new ProxyRegistry(provider, chainId);
      const proxy = await proxyRegistry.getProxy(this.params.maker);
      if (!proxy) {
        throw new Error("Maker has no proxy");
      }

      if (this.params.kind?.startsWith("erc721")) {
        const erc721 = new Common.Helpers.Erc721(provider, this.params.target);

        // Sell orders can only be single token (at least for now), so
        // extracting the token id via the single token builder should
        // be enough
        const tokenId = new Builders.Erc721.SingleToken(chainId).getTokenId(
          this
        );
        if (!tokenId) {
          throw new Error("Invalid order");
        }

        // Check ownership
        const owner = await erc721.getOwner(tokenId);
        if (lc(owner) !== lc(this.params.maker)) {
          throw new Error("No ownership");
        }

        // Check approval
        const isApproved = await erc721.isApproved(this.params.maker, proxy);
        if (!isApproved) {
          throw new Error("No approval");
        }
      } else if (this.params.kind?.startsWith("erc1155")) {
        const erc1155 = new Common.Helpers.Erc1155(
          provider,
          this.params.target
        );

        // Sell orders can only be single token (at least for now), so
        // extracting the token id via the single token builder should
        // be enough
        const tokenId = new Builders.Erc1155.SingleToken(chainId).getTokenId(
          this
        );
        if (!tokenId) {
          throw new Error("Invalid order");
        }

        // Check balance
        const balance = await erc1155.getBalance(this.params.maker, tokenId);
        if (bn(balance).lt(1)) {
          throw new Error("Insufficient balance");
        }

        // Check approval
        const isApproved = await erc1155.isApproved(this.params.maker, proxy);
        if (!isApproved) {
          throw new Error("No approval");
        }
      } else {
        throw new Error("Invalid order");
      }
    }
  }

  private getBuilder(): BaseBuilder {
    switch (this.params.kind) {
      case "erc721-contract-wide": {
        return new Builders.Erc721.ContractWide(this.chainId);
      }

      case "erc721-single-token": {
        return new Builders.Erc721.SingleToken(this.chainId);
      }

      case "erc721-token-list": {
        return new Builders.Erc721.TokenList(this.chainId);
      }

      case "erc721-token-range": {
        return new Builders.Erc721.TokenRange(this.chainId);
      }

      case "erc1155-contract-wide": {
        return new Builders.Erc1155.ContractWide(this.chainId);
      }

      case "erc1155-single-token": {
        return new Builders.Erc1155.SingleToken(this.chainId);
      }

      case "erc1155-token-list": {
        return new Builders.Erc1155.TokenList(this.chainId);
      }

      case "erc1155-token-range": {
        return new Builders.Erc1155.TokenRange(this.chainId);
      }

      default: {
        throw new Error("Unknown order kind");
      }
    }
  }

  private detectKind(): Types.OrderKind {
    // erc721-contract-wide
    {
      const builder = new Builders.Erc721.ContractWide(this.chainId);
      if (builder.isValid(this)) {
        return "erc721-contract-wide";
      }
    }

    // erc721-single-token
    {
      const builder = new Builders.Erc721.SingleToken(this.chainId);
      if (builder.isValid(this)) {
        return "erc721-single-token";
      }
    }

    // erc721-token-list
    {
      const builder = new Builders.Erc721.TokenList(this.chainId);
      if (builder.isValid(this)) {
        return "erc721-token-list";
      }
    }

    // erc721-token-range
    {
      const builder = new Builders.Erc721.TokenRange(this.chainId);
      if (builder.isValid(this)) {
        return "erc721-token-range";
      }
    }

    // erc1155-contract-wide
    {
      const builder = new Builders.Erc1155.ContractWide(this.chainId);
      if (builder.isValid(this)) {
        return "erc1155-contract-wide";
      }
    }

    // erc1155-single-token
    {
      const builder = new Builders.Erc1155.SingleToken(this.chainId);
      if (builder.isValid(this)) {
        return "erc1155-single-token";
      }
    }

    // erc1155-token-list
    {
      const builder = new Builders.Erc1155.TokenList(this.chainId);
      if (builder.isValid(this)) {
        return "erc1155-token-list";
      }
    }

    // erc1155-token-range
    {
      const builder = new Builders.Erc1155.TokenRange(this.chainId);
      if (builder.isValid(this)) {
        return "erc1155-token-range";
      }
    }

    throw new Error(
      "Could not detect order kind (order might have unsupported params/calldata)"
    );
  }
}

const RAW_ORDER_FIELDS = [
  "address", // exchange
  "address", // maker
  "address", // taker
  "uint256", // makerRelayerFee
  "uint256", // takerRelayerFee
  "uint256", // makerProtocolFee (always 0)
  "uint256", // takerProtocolFee (always 0)
  "address", // feeRecipient
  "uint8", // feeMethod (always 1)
  "uint8", // side
  "uint8", // saleKind
  "address", // target
  "uint8", // howToCall
  "bytes", // calldata
  "bytes", // replacementPattern
  "address", // staticTarget
  "bytes", // staticExtradata
  "address", // paymentToken
  "uint256", // basePrice
  "uint256", // extra
  "uint256", // listingTime
  "uint256", // expirationTime
  "uint256", // salt
];

const toRaw = (order: Types.OrderParams): any[] => [
  order.exchange,
  order.maker,
  order.taker,
  order.makerRelayerFee,
  order.takerRelayerFee,
  0, // makerProtocolFee (always 0)
  0, // takerProtocolFee (always 0)
  order.feeRecipient,
  1, // feeMethod (always 1 - SplitFee)
  order.side,
  order.saleKind,
  order.target,
  order.howToCall,
  order.calldata,
  order.replacementPattern,
  order.staticTarget,
  order.staticExtradata,
  order.paymentToken,
  order.basePrice,
  order.extra,
  order.listingTime,
  order.expirationTime,
  order.salt,
];

const normalize = (order: Types.OrderParams): Types.OrderParams => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  return {
    kind: order.kind,
    exchange: lc(order.exchange),
    maker: lc(order.maker),
    taker: lc(order.taker),
    makerRelayerFee: n(order.makerRelayerFee),
    takerRelayerFee: n(order.takerRelayerFee),
    feeRecipient: lc(order.feeRecipient),
    side: n(order.side),
    saleKind: n(order.saleKind),
    target: lc(order.target),
    howToCall: n(order.howToCall),
    calldata: lc(order.calldata),
    replacementPattern: lc(order.replacementPattern),
    staticTarget: lc(order.staticTarget),
    staticExtradata: lc(order.staticExtradata),
    paymentToken: lc(order.paymentToken),
    basePrice: s(order.basePrice),
    extra: s(order.extra),
    listingTime: n(order.listingTime),
    expirationTime: n(order.expirationTime),
    salt: s(order.salt),
    v: order.v ?? 0,
    r: order.r ?? HashZero,
    s: order.s ?? HashZero,
  };
};
