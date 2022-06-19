import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { AddressZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { ExchangeKind, BidDetails, ListingDetails } from "./types";
import * as Sdk from "../index";
import { TxData, bn } from "../utils";

import Erc721Abi from "../common/abis/Erc721.json";
import Erc1155Abi from "../common/abis/Erc1155.json";
import RouterAbi from "./abis/ReservoirV3.json";

export class Router {
  public chainId: number;
  public contract: Contract;
  public provider: Provider;

  constructor(chainId: number, provider: Provider) {
    if (chainId !== 1 && chainId !== 4) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.contract = new Contract(
      Addresses.Router[chainId],
      RouterAbi,
      provider
    );
    this.provider = provider;
  }

  public async fillListingsTx(
    details: ListingDetails[],
    taker: string,
    options?: {
      referrer?: string;
      referrerFeeBps?: number | string;
      skipPrecheck?: boolean;
      partial?: boolean;
    }
  ): Promise<TxData> {
    // Assume the listing details are consistent with the underlying order object

    // Orders on exchanges that support batch filling will be batch filled
    // natively so that filling is as efficient as possible while the rest
    // of the orders will be filled individually.

    // Native batch filling:
    // - OpenDao (only ERC1155 supported for now)
    // - Seaport (not supported yet)
    // - X2Y2 (not supported yet)
    // - ZeroExV4 (only ERC1155 supported for now)

    // Keep track of batch-fillable orders
    const opendaoErc1155Details: ListingDetails[] = [];
    const zeroexV4Erc1155Details: ListingDetails[] = [];
    for (let i = 0; i < details.length; i++) {
      const { kind, contractKind } = details[i];
      if (contractKind === "erc1155" && kind === "opendao") {
        opendaoErc1155Details.push(details[i]);
      } else if (contractKind === "erc1155" && kind === "zeroex-v4") {
        zeroexV4Erc1155Details.push(details[i]);
      }
    }

    const referrer = options?.referrer || AddressZero;
    const referrerFeeBps = options?.referrer ? options?.referrerFeeBps ?? 0 : 0;

    // Keep track of all listings to be filled through the router
    const routerTxs: TxData[] = [];

    // Only batch-fill if there are multiple orders
    if (opendaoErc1155Details.length > 1) {
      const exchange = new Sdk.OpenDao.Exchange(this.chainId);
      const tx = exchange.batchBuyTransaction(
        taker,
        opendaoErc1155Details.map(
          (detail) => detail.order as Sdk.OpenDao.Order
        ),
        opendaoErc1155Details.map((detail) =>
          (detail.order as Sdk.OpenDao.Order).buildMatching({
            amount: detail.amount ?? 1,
          })
        )
      );

      routerTxs.push({
        from: taker,
        to: this.contract.address,
        data: this.contract.interface.encodeFunctionData(
          "batchERC1155ListingFill",
          [
            referrer,
            tx.data,
            ExchangeKind.ZEROEX_V4,
            opendaoErc1155Details.map((detail) => detail.contract),
            opendaoErc1155Details.map((detail) => detail.tokenId),
            opendaoErc1155Details.map((detail) => detail.amount ?? 1),
            taker,
            referrerFeeBps,
          ]
        ),
        value: bn(tx.value!)
          .add(bn(tx.value!).mul(referrerFeeBps).div(10000))
          .toHexString(),
      });

      // Delete any batch-filled orders
      details = details.filter(({ kind }) => kind !== "opendao");
    }
    if (zeroexV4Erc1155Details.length > 1) {
      const exchange = new Sdk.ZeroExV4.Exchange(this.chainId);
      const tx = exchange.batchBuyTransaction(
        taker,
        zeroexV4Erc1155Details.map(
          (detail) => detail.order as Sdk.ZeroExV4.Order
        ),
        zeroexV4Erc1155Details.map((detail) =>
          (detail.order as Sdk.ZeroExV4.Order).buildMatching({
            amount: detail.amount ?? 1,
          })
        )
      );

      routerTxs.push({
        from: taker,
        to: this.contract.address,
        data: this.contract.interface.encodeFunctionData(
          "batchERC1155ListingFill",
          [
            referrer,
            tx.data,
            ExchangeKind.ZEROEX_V4,
            zeroexV4Erc1155Details.map((detail) => detail.contract),
            zeroexV4Erc1155Details.map((detail) => detail.tokenId),
            zeroexV4Erc1155Details.map((detail) => detail.amount ?? 1),
            taker,
            referrerFeeBps,
          ]
        ),
        value: bn(tx.value!)
          .add(bn(tx.value!).mul(referrerFeeBps).div(10000))
          .toHexString(),
      });

      // Delete any batch-filled orders
      details = details.filter(({ kind }) => kind !== "zeroex-v4");
    }

    // Rest of orders are individually filled
    for (const detail of details) {
      const { tx, exchangeKind, maker, isEscrowed } =
        await this.generateNativeListingFillTx(detail, taker, options);

      if (detail.contractKind === "erc721") {
        routerTxs.push({
          from: taker,
          to: this.contract.address,
          data:
            !options?.skipPrecheck && !isEscrowed
              ? this.contract.interface.encodeFunctionData(
                  "singleERC721ListingFillWithPrecheck",
                  [
                    referrer,
                    tx.data,
                    exchangeKind,
                    detail.contract,
                    detail.tokenId,
                    taker,
                    maker,
                    referrerFeeBps,
                  ]
                )
              : this.contract.interface.encodeFunctionData(
                  "singleERC721ListingFill",
                  [
                    referrer,
                    tx.data,
                    exchangeKind,
                    detail.contract,
                    detail.tokenId,
                    taker,
                    referrerFeeBps,
                  ]
                ),
          value: bn(tx.value!)
            // Add the referrer fee
            .add(bn(tx.value!).mul(referrerFeeBps).div(10000))
            .toHexString(),
        });
      } else {
        routerTxs.push({
          from: taker,
          to: this.contract.address,
          data:
            !options?.skipPrecheck && !isEscrowed
              ? this.contract.interface.encodeFunctionData(
                  "singleERC1155ListingFillWithPrecheck",
                  [
                    referrer,
                    tx.data,
                    exchangeKind,
                    detail.contract,
                    detail.tokenId,
                    detail.amount ?? 1,
                    taker,
                    maker,
                    referrerFeeBps,
                  ]
                )
              : this.contract.interface.encodeFunctionData(
                  "singleERC1155ListingFill",
                  [
                    referrer,
                    tx.data,
                    exchangeKind,
                    detail.contract,
                    detail.tokenId,
                    detail.amount ?? 1,
                    taker,
                    referrerFeeBps,
                  ]
                ),
          value: bn(tx.value!)
            // Add the referrer fee
            .add(bn(tx.value!).mul(referrerFeeBps).div(10000))
            .toHexString(),
        });
      }
    }

    if (routerTxs.length === 1) {
      return routerTxs[0];
    } else if (routerTxs.length > 1) {
      return {
        from: taker,
        to: this.contract.address,
        data: this.contract.interface.encodeFunctionData("multiListingFill", [
          routerTxs.map((tx) => tx.data),
          routerTxs.map((tx) => tx.value!.toString()),
          !options?.partial,
        ]),
        value: routerTxs
          .map((tx) => bn(tx.value!))
          .reduce((a, b) => a.add(b), bn(0))
          .toHexString(),
      };
    } else {
      throw new Error("Could not generate transaction");
    }
  }

  public async fillBidTx(
    detail: BidDetails,
    taker: string,
    options?: {
      referrer?: string;
    }
  ) {
    // Assume the bid details are consistent with the underlying order object

    const { tx, exchangeKind } = await this.generateNativeBidFillTx(
      detail,
      taker
    );

    const referrer = options?.referrer || AddressZero;

    // Wrap the exchange-specific fill transaction via the router.
    // We are using the `onReceived` hooks for single-tx filling.
    if (detail.contractKind === "erc721") {
      return {
        from: taker,
        to: detail.contract,
        data: new Interface(Erc721Abi).encodeFunctionData(
          "safeTransferFrom(address,address,uint256,bytes)",
          [
            taker,
            this.contract.address,
            detail.tokenId,
            this.contract.interface.encodeFunctionData("singleERC721BidFill", [
              referrer,
              tx.data,
              exchangeKind,
              detail.contract,
              taker,
              true,
            ]),
          ]
        ),
      };
    } else {
      return {
        from: taker,
        to: detail.contract,
        data: new Interface(Erc1155Abi).encodeFunctionData(
          "safeTransferFrom(address,address,uint256,uint256,bytes)",
          [
            taker,
            this.contract.address,
            detail.tokenId,
            // TODO: Support selling a quantity greater than 1
            1,
            this.contract.interface.encodeFunctionData("singleERC1155BidFill", [
              referrer,
              tx.data,
              exchangeKind,
              detail.contract,
              taker,
              true,
            ]),
          ]
        ),
      };
    }
  }

  private async generateNativeListingFillTx(
    { kind, order, tokenId, amount }: ListingDetails,
    taker: string,
    options?: { referrer?: string }
  ): Promise<{
    tx: TxData;
    exchangeKind: ExchangeKind;
    maker: string;
    isEscrowed?: boolean;
  }> {
    // In all below cases we set the router contract as the taker
    // since forwarding any received token to the actual taker of
    // the order will be done on-chain by the router (unless it's
    // possible to specify a token recipient other than the taker
    // natively - only Wyvern V2.3 supports this).

    if (kind === "foundation") {
      order = order as Sdk.Foundation.Order;

      const exchange = new Sdk.Foundation.Exchange(this.chainId);
      return {
        tx: exchange.fillOrderTx(
          this.contract.address,
          order,
          // Foundation has built-in referral support
          options?.referrer || AddressZero
        ),
        exchangeKind: ExchangeKind.FOUNDATION,
        maker: order.params.maker,
        isEscrowed: true,
      };
    } else if (kind === "looks-rare") {
      order = order as Sdk.LooksRare.Order;

      const matchParams = order.buildMatching(this.contract.address, {
        tokenId,
      });

      const exchange = new Sdk.LooksRare.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(
          this.contract.address,
          order,
          matchParams
        ),
        exchangeKind: ExchangeKind.LOOKS_RARE,
        maker: order.params.signer,
      };
    } else if (kind === "opendao") {
      order = order as Sdk.OpenDao.Order;

      const matchParams = order.buildMatching();

      const exchange = new Sdk.OpenDao.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(
          this.contract.address,
          order,
          matchParams
        ),
        exchangeKind: ExchangeKind.ZEROEX_V4,
        maker: order.params.maker,
      };
    } else if (kind === "wyvern-v2.3") {
      order = order as Sdk.WyvernV23.Order;

      const matchParams = order.buildMatching(this.contract.address, {
        order,
        nonce: 0,
        // Wyvern v2.3 supports specifying a recipient other than the taker
        recipient: taker,
      });
      // Set the listing time in the past so that on-chain validation passes
      matchParams.params.listingTime = await this.provider
        .getBlock("latest")
        .then((b) => b.timestamp - 2 * 60);

      const exchange = new Sdk.WyvernV23.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(
          this.contract.address,
          matchParams,
          order
        ),
        exchangeKind: ExchangeKind.WYVERN_V23,
        maker: order.params.maker,
      };
    } else if (kind === "x2y2") {
      order = order as Sdk.X2Y2.Order;

      // X2Y2 requires an API key to fill
      const exchange = new Sdk.X2Y2.Exchange(
        this.chainId,
        String(process.env.X2Y2_API_KEY)
      );
      return {
        tx: await exchange.fillOrderTx(this.contract.address, order),
        exchangeKind: ExchangeKind.X2Y2,
        maker: order.params.maker,
      };
    } else if (kind === "zeroex-v4") {
      order = order as Sdk.ZeroExV4.Order;

      // Support passing an amount for partially fillable erc1155 orders
      const matchParams = order.buildMatching({ amount });

      const exchange = new Sdk.ZeroExV4.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(
          this.contract.address,
          order,
          matchParams
        ),
        exchangeKind: ExchangeKind.ZEROEX_V4,
        maker: order.params.maker,
      };
    } else if (kind === "seaport") {
      order = order as Sdk.Seaport.Order;

      // Support passing an amount for partially fillable orders
      const matchParams = order.buildMatching({ amount });

      const exchange = new Sdk.Seaport.Exchange(this.chainId);
      return {
        tx: exchange.fillOrderTx(
          this.contract.address,
          order,
          matchParams,
          taker
        ),
        exchangeKind: ExchangeKind.SEAPORT,
        maker: order.params.offerer,
      };
    }

    throw new Error("Unreachable");
  }

  private async generateNativeBidFillTx(
    { kind, order, tokenId, extraArgs }: BidDetails,
    taker: string
  ): Promise<{ tx: TxData; exchangeKind: ExchangeKind }> {
    // In all below cases we set the router contract as the taker
    // since forwarding any received token to the actual taker of
    // the order will be done on-chain by the router.

    if (kind === "looks-rare") {
      order = order as Sdk.LooksRare.Order;

      const matchParams = order.buildMatching(this.contract.address, {
        tokenId,
        ...(extraArgs || {}),
      });

      const exchange = new Sdk.LooksRare.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(taker, order, matchParams),
        exchangeKind: ExchangeKind.LOOKS_RARE,
      };
    } else if (kind === "opendao") {
      order = order as Sdk.OpenDao.Order;

      const matchParams = order.buildMatching({
        tokenId,
        amount: 1,
        // Do not unwrap in order to be compatible with the router
        unwrapNativeToken: false,
      });

      const exchange = new Sdk.OpenDao.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(taker, order, matchParams, {
          // Do not use the `onReceived` hook filling to be compatible with the router
          noDirectTransfer: true,
        }),
        exchangeKind: ExchangeKind.ZEROEX_V4,
      };
    } else if (kind === "wyvern-v2.3") {
      order = order as Sdk.WyvernV23.Order;

      const matchParams = order.buildMatching(this.contract.address, {
        tokenId,
        nonce: 0,
        ...(extraArgs || {}),
      });
      // Set the listing time in the past so that on-chain validation passes
      matchParams.params.listingTime = await this.provider
        .getBlock("latest")
        .then((b) => b.timestamp - 2 * 60);

      const exchange = new Sdk.WyvernV23.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(taker, order, matchParams),
        exchangeKind: ExchangeKind.WYVERN_V23,
      };
    } else if (kind === "zeroex-v4") {
      order = order as Sdk.ZeroExV4.Order;

      const matchParams = order.buildMatching({
        tokenId,
        amount: 1,
        // Do not unwrap in order to be compatible with the router
        unwrapNativeToken: false,
      });

      const exchange = new Sdk.ZeroExV4.Exchange(this.chainId);
      return {
        tx: exchange.matchTransaction(taker, order, matchParams, {
          // Do not use the `onReceived` hook filling to be compatible with the router
          noDirectTransfer: true,
        }),
        exchangeKind: ExchangeKind.ZEROEX_V4,
      };
    } else if (kind === "seaport") {
      order = order as Sdk.Seaport.Order;

      const matchParams = order.buildMatching({
        tokenId,
        ...(extraArgs || {}),
        amount: 1,
      });

      const exchange = new Sdk.Seaport.Exchange(this.chainId);
      return {
        tx: exchange.fillOrderTx(
          this.contract.address,
          order,
          matchParams,
          taker
        ),
        exchangeKind: ExchangeKind.SEAPORT,
      };
    }

    throw new Error("Unreachable");
  }
}
