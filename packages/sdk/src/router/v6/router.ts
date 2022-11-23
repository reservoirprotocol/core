import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import axios from "axios";

import * as Addresses from "./addresses";
import { BidDetails, Fee, ListingDetails, ListingFillDetails } from "./types";
import * as Sdk from "../../index";
import { TxData, bn, generateSourceBytes } from "../../utils";

// Tokens
import ERC721Abi from "../../common/abis/Erc721.json";
import ERC1155Abi from "../../common/abis/Erc1155.json";
// Router
import RouterAbi from "./abis/ReservoirV6_0_0.json";
// Modules
import SudoswapModuleAbi from "./abis/SudoswapModule.json";
import FoundationModuleAbi from "./abis/FoundationModule.json";
import LooksRareModuleAbi from "./abis/LooksRareModule.json";
import SeaportModuleAbi from "./abis/SeaportModule.json";
import X2Y2ModuleAbi from "./abis/X2Y2Module.json";
import ZeroExV4ModuleAbi from "./abis/ZeroExV4Module.json";
import ZoraModuleAbi from "./abis/ZoraModule.json";
import BlurModuleAbi from "./abis/BlurModule.json";

type ExecutionInfo = {
  module: string;
  data: string;
  value: BigNumberish;
};

type SetupOptions = {
  x2y2ApiKey?: string;
  cbApiKey?: string;
};

export class Router {
  public chainId: number;
  public provider: Provider;
  public options?: SetupOptions;

  public contracts: { [name: string]: Contract };

  constructor(chainId: number, provider: Provider, options?: SetupOptions) {
    this.chainId = chainId;
    this.provider = provider;
    this.options = options;

    this.contracts = {
      // Initialize router
      router: new Contract(Addresses.Router[chainId], RouterAbi, provider),
      // Initialize modules
      foundationModule: new Contract(
        Addresses.FoundationModule[chainId] ?? AddressZero,
        FoundationModuleAbi,
        provider
      ),
      looksRareModule: new Contract(
        Addresses.LooksRareModule[chainId] ?? AddressZero,
        LooksRareModuleAbi,
        provider
      ),
      seaportModule: new Contract(
        Addresses.SeaportModule[chainId] ?? AddressZero,
        SeaportModuleAbi,
        provider
      ),
      sudoswapModule: new Contract(
        Addresses.SudoswapModule[chainId] ?? AddressZero,
        SudoswapModuleAbi,
        provider
      ),
      x2y2Module: new Contract(
        Addresses.X2Y2Module[chainId] ?? AddressZero,
        X2Y2ModuleAbi,
        provider
      ),
      zeroExV4Module: new Contract(
        Addresses.ZeroExV4Module[chainId] ?? AddressZero,
        ZeroExV4ModuleAbi,
        provider
      ),
      zoraModule: new Contract(
        Addresses.ZoraModule[chainId] ?? AddressZero,
        ZoraModuleAbi,
        provider
      ),
      blurModule: new Contract(
        Addresses.BlurModule[chainId] ?? AddressZero,
        BlurModuleAbi,
        provider
      ),
    };
  }

  public async fillListingsTx(
    details: ListingDetails[],
    taker: string,
    currency = Sdk.Common.Addresses.Eth[this.chainId],
    options?: {
      source?: string;
      // Will be split among all listings to get filled
      globalFees?: Fee[];
      // Include a balance assert module call for every listing
      assertBalances?: boolean;
      // Force filling through the router (where possible)
      forceRouter?: boolean;
      // Skip any errors generating filling data (eg. for X2Y2)
      skipErrors?: boolean;
      // Do not revert in case of on-chain fill failures
      partial?: boolean;
      // Any extra data relevant when filling natively
      directFillingData?: any;
    }
  ): Promise<{ txData: TxData; success: boolean[] }> {
    // Assume the listing details are consistent with the underlying order object

    // TODO: Add support for balance assertions
    if (options?.assertBalances) {
      throw new Error("Balance assertions not yet implemented");
    }

    // TODO: Add Universe router module
    if (details.some(({ kind }) => kind === "universe")) {
      if (details.length > 1) {
        throw new Error("Universe sweeping is not supported");
      } else {
        if (options?.globalFees?.length) {
          throw new Error("Fees not supported");
        }

        const order = details[0].order as Sdk.Universe.Order;
        const exchange = new Sdk.Universe.Exchange(this.chainId);
        return {
          txData: await exchange.fillOrderTx(taker, order, {
            amount: Number(details[0].amount),
          }),
          success: [true],
        };
      }
    }

    // TODO: Add Rarible router module
    if (details.some(({ kind }) => kind === "rarible")) {
      if (details.length > 1) {
        throw new Error("Rarible sweeping is not supported");
      } else {
        const order = details[0].order as Sdk.Rarible.Order;
        const exchange = new Sdk.Rarible.Exchange(this.chainId);
        return {
          txData: await exchange.fillOrderTx(taker, order, {
            tokenId: details[0].tokenId,
            assetClass: details[0].contractKind.toUpperCase(),
            amount: Number(details[0].amount),
          }),
          success: [true],
        };
      }
    }

    // TODO: Add Cryptopunks router module
    if (details.some(({ kind }) => kind === "cryptopunks")) {
      if (details.length > 1) {
        throw new Error("Cryptopunks sweeping is not supported");
      } else {
        if (options?.globalFees?.length) {
          throw new Error("Fees not supported");
        }

        const order = details[0].order as Sdk.CryptoPunks.Order;
        const exchange = new Sdk.CryptoPunks.Exchange(this.chainId);
        return {
          txData: exchange.fillListingTx(taker, order, options),
          success: [true],
        };
      }
    }

    // TODO: Add Infinity router module
    if (details.some(({ kind }) => kind === "infinity")) {
      if (details.length > 1) {
        throw new Error("Infinity sweeping is not supported");
      } else {
        if (options?.globalFees?.length) {
          throw new Error("Fees not supported");
        }

        const order = details[0].order as Sdk.Infinity.Order;
        const exchange = new Sdk.Infinity.Exchange(this.chainId);

        if (options?.directFillingData) {
          return {
            txData: exchange.takeOrdersTx(taker, [
              {
                order,
                tokens: options.directFillingData,
              },
            ]),
            success: [true],
          };
        }
        return {
          txData: exchange.takeMultipleOneOrdersTx(taker, [order]),
          success: [true],
        };
      }
    }

    // Handle partial seaport orders:
    // - fetch the full order data for each partial order (concurrently)
    // - remove any partial order from the details
    await Promise.all(
      details
        .filter(({ kind }) => kind === "seaport-partial")
        .map(async (detail) => {
          const order = detail.order as Sdk.Seaport.Types.PartialOrder;
          const result = await axios.get(
            `https://order-fetcher.vercel.app/api/listing?orderHash=${order.id}&contract=${order.contract}&tokenId=${order.tokenId}&taker=${taker}`
          );

          const fullOrder = new Sdk.Seaport.Order(
            this.chainId,
            result.data.order
          );
          details.push({
            ...detail,
            kind: "seaport",
            order: fullOrder,
          });
        })
    );
    details = details.filter(({ kind }) => kind !== "seaport-partial");

    // If all orders are Seaport, then fill on Seaport directly
    // TODO: Directly fill for other exchanges as well
    if (
      details.every(({ kind, fees }) => kind === "seaport" && !fees?.length) &&
      !options?.globalFees?.length &&
      !options?.forceRouter
    ) {
      const exchange = new Sdk.Seaport.Exchange(this.chainId);
      if (details.length === 1) {
        const order = details[0].order as Sdk.Seaport.Order;
        return {
          txData: exchange.fillOrderTx(
            taker,
            order,
            order.buildMatching({ amount: details[0].amount }),
            {
              ...options,
              ...options?.directFillingData,
            }
          ),
          success: [true],
        };
      } else {
        const orders = details.map((d) => d.order as Sdk.Seaport.Order);
        return {
          txData: exchange.fillOrdersTx(
            taker,
            orders,
            orders.map((order, i) =>
              order.buildMatching({ amount: details[i].amount })
            ),
            {
              ...options,
              ...options?.directFillingData,
            }
          ),
          success: [true],
        };
      }
    }

    // TODO: Add support for filling non-ETH orders through the router via Uniswap V3
    if (currency !== Sdk.Common.Addresses.Eth[this.chainId]) {
      throw new Error("Non-ETH filling not yet implemented");
    }
    if (!details.every((d) => d.currency === currency)) {
      throw new Error("Mismatched currencies");
    }

    const getFees = (ownDetails: ListingFillDetails[]) => [
      // Global fees
      ...(options?.globalFees ?? []).map(({ recipient, amount }) => ({
        recipient,
        // The fees are averaged over the number of listings to fill
        // TODO: Also take into account the quantity filled for ERC1155
        amount: bn(amount).mul(ownDetails.length).div(details.length),
      })),
      // Local fees
      // TODO: Should not split the local fees among all executions
      ...ownDetails.flatMap(({ fees }) => fees ?? []),
    ];

    // For keeping track of the listing's position in the original array
    type ListingDetailsExtracted = {
      originalIndex: number;
    } & ListingDetails;

    // Split all listings by their kind
    const sudoswapDetails: ListingDetailsExtracted[] = [];
    const foundationDetails: ListingDetailsExtracted[] = [];
    const looksRareDetails: ListingDetailsExtracted[] = [];
    const seaportDetails: ListingDetailsExtracted[] = [];
    const x2y2Details: ListingDetailsExtracted[] = [];
    const zeroexV4Erc721Details: ListingDetailsExtracted[] = [];
    const zeroexV4Erc1155Details: ListingDetailsExtracted[] = [];
    const zoraDetails: ListingDetailsExtracted[] = [];
    const blurDetails: ListingDetailsExtracted[] = [];

    for (let i = 0; i < details.length; i++) {
      const { kind, contractKind } = details[i];

      let detailsRef: ListingDetailsExtracted[];
      switch (kind) {
        case "sudoswap":
          detailsRef = sudoswapDetails;
          break;

        case "foundation":
          detailsRef = foundationDetails;
          break;

        case "looks-rare":
          detailsRef = looksRareDetails;
          break;

        case "seaport":
          detailsRef = seaportDetails;
          break;

        case "x2y2":
          detailsRef = x2y2Details;
          break;

        case "zeroex-v4":
          detailsRef =
            contractKind === "erc721"
              ? zeroexV4Erc721Details
              : zeroexV4Erc1155Details;
          break;
        
        case "blur":
          detailsRef = blurDetails;

        case "zora":
          detailsRef = zoraDetails;
          break;
        
        case "blur":
          detailsRef = blurDetails;
          break;

        default:
          throw new Error("Unsupported exchange kind");
      }

      detailsRef.push({ ...details[i], originalIndex: i });
    }

    // Generate router executions
    const executions: ExecutionInfo[] = [];
    const success: boolean[] = details.map(() => false);

    // Handle Foundation listings
    if (foundationDetails.length) {
      const orders = foundationDetails.map(
        (d) => d.order as Sdk.Foundation.Order
      );
      const fees = getFees(foundationDetails);

      const totalPrice = orders
        .map((order) => bn(order.params.price))
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module: this.contracts.foundationModule.address,
        data:
          orders.length === 1
            ? this.contracts.foundationModule.interface.encodeFunctionData(
                "acceptETHListing",
                [
                  orders[0].params,
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.foundationModule.interface.encodeFunctionData(
                "acceptETHListings",
                [
                  orders.map((order) => order.params),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of foundationDetails) {
        success[originalIndex] = true;
      }
    }

    // Handle LooksRare listings
    if (looksRareDetails.length) {
      const orders = looksRareDetails.map(
        (d) => d.order as Sdk.LooksRare.Order
      );
      const module = this.contracts.looksRareModule.address;

      const fees = getFees(looksRareDetails);

      const totalPrice = orders
        .map((order) => bn(order.params.price))
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module,
        data:
          orders.length === 1
            ? this.contracts.looksRareModule.interface.encodeFunctionData(
                "acceptETHListing",
                [
                  orders[0].buildMatching(
                    // For LooksRare, the module acts as the taker proxy
                    module
                  ),
                  orders[0].params,
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.looksRareModule.interface.encodeFunctionData(
                "acceptETHListings",
                [
                  orders.map((order) =>
                    order.buildMatching(
                      // For LooksRare, the module acts as the taker proxy
                      module
                    )
                  ),
                  orders.map((order) => order.params),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of looksRareDetails) {
        success[originalIndex] = true;
      }
    }

    // Handle Seaport listings
    if (seaportDetails.length) {
      const orders = seaportDetails.map((d) => d.order as Sdk.Seaport.Order);

      const fees = getFees(seaportDetails);

      const totalPrice = orders
        .map((order, i) =>
          // Seaport orders can be partially-fillable
          bn(order.getMatchingPrice())
            .mul(seaportDetails[i].amount ?? 1)
            .div(order.getInfo()!.amount)
        )
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module: this.contracts.seaportModule.address,
        data:
          orders.length === 1
            ? this.contracts.seaportModule.interface.encodeFunctionData(
                "acceptETHListing",
                [
                  {
                    parameters: {
                      ...orders[0].params,
                      totalOriginalConsiderationItems:
                        orders[0].params.consideration.length,
                    },
                    numerator: seaportDetails[0].amount ?? 1,
                    denominator: 1,
                    signature: orders[0].params.signature,
                    extraData: "0x",
                  },
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.seaportModule.interface.encodeFunctionData(
                "acceptETHListings",
                [
                  orders.map((order, i) => ({
                    parameters: {
                      ...order.params,
                      totalOriginalConsiderationItems:
                        order.params.consideration.length,
                    },
                    numerator: seaportDetails[i].amount ?? 1,
                    denominator: 1,
                    signature: order.params.signature,
                    extraData: "0x",
                  })),
                  // TODO: Optimize the fulfillments
                  {
                    offer: orders
                      .map((order, i) =>
                        order.params.offer.map((_, j) => ({
                          orderIndex: i,
                          itemIndex: j,
                        }))
                      )
                      .flat()
                      .map((x) => [x]),
                    consideration: orders
                      .map((order, i) =>
                        order.params.consideration.map((_, j) => ({
                          orderIndex: i,
                          itemIndex: j,
                        }))
                      )
                      .flat()
                      .map((x) => [x]),
                  },
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of seaportDetails) {
        success[originalIndex] = true;
      }
    }

    // Handle Sudoswap listings
    if (sudoswapDetails.length) {
      const orders = sudoswapDetails.map((d) => d.order as Sdk.Sudoswap.Order);
      const fees = getFees(sudoswapDetails);

      const totalPrice = orders
        .map((order) => bn(order.params.price))
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module: this.contracts.sudoswapModule.address,
        data: this.contracts.sudoswapModule.interface.encodeFunctionData(
          "buyWithETH",
          [
            sudoswapDetails.map(
              (d) => (d.order as Sdk.Sudoswap.Order).params.pair
            ),
            sudoswapDetails.map((d) => d.tokenId),
            Math.floor(Date.now() / 1000) + 10 * 60,
            {
              fillTo: taker,
              refundTo: taker,
              revertIfIncomplete: Boolean(!options?.partial),
              amount: totalPrice,
            },
            fees,
          ]
        ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of sudoswapDetails) {
        success[originalIndex] = true;
      }
    }

    // Handle X2Y2 listings
    if (x2y2Details.length) {
      const orders = x2y2Details.map((d) => d.order as Sdk.X2Y2.Order);
      const module = this.contracts.x2y2Module.address;

      const fees = getFees(x2y2Details);

      const totalPrice = orders
        .map((order) => bn(order.params.price))
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      const exchange = new Sdk.X2Y2.Exchange(
        this.chainId,
        String(this.options?.x2y2ApiKey)
      );
      executions.push({
        module,
        data:
          orders.length === 1
            ? this.contracts.x2y2Module.interface.encodeFunctionData(
                "acceptETHListing",
                [
                  // Fetch X2Y2-signed input
                  exchange.contract.interface.decodeFunctionData(
                    "run",
                    await exchange.fetchInput(
                      // For X2Y2, the module acts as the taker proxy
                      module,
                      orders[0],
                      {
                        source: options?.source,
                        tokenId: x2y2Details[0].tokenId,
                      }
                    )
                  ).input,
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.x2y2Module.interface.encodeFunctionData(
                "acceptETHListings",
                [
                  await Promise.all(
                    orders.map(
                      async (order, i) =>
                        // Fetch X2Y2-signed input
                        exchange.contract.interface.decodeFunctionData(
                          "run",
                          await exchange.fetchInput(
                            // For X2Y2, the module acts as the taker proxy
                            module,
                            order,
                            {
                              source: options?.source,
                              tokenId: x2y2Details[i].tokenId,
                            }
                          )
                        ).input
                    )
                  ),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of x2y2Details) {
        success[originalIndex] = true;
      }
    }

    // Handle ZeroExV4 ERC721 listings
    if (zeroexV4Erc721Details.length) {
      const orders = zeroexV4Erc721Details.map(
        (d) => d.order as Sdk.ZeroExV4.Order
      );

      for (const order of orders) {
        // Retrieve the order's signature
        if (order.params.cbOrderId) {
          await new Sdk.ZeroExV4.Exchange(
            this.chainId,
            String(this.options?.cbApiKey!)
          ).releaseOrder(taker, order);
        }
      }

      const fees = getFees(zeroexV4Erc721Details);

      const totalPrice = orders
        .map((order) =>
          bn(order.params.erc20TokenAmount).add(
            // For ZeroExV4, the fees are not included in the price
            // TODO: Add order method to get the price including the fees
            order.getFeeAmount()
          )
        )
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module: this.contracts.zeroExV4Module.address,
        data:
          orders.length === 1
            ? this.contracts.zeroExV4Module.interface.encodeFunctionData(
                "acceptETHListingERC721",
                [
                  orders[0].getRaw(),
                  orders[0].params,
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.zeroExV4Module.interface.encodeFunctionData(
                "acceptETHListingsERC721",
                [
                  orders.map((order) => order.getRaw()),
                  orders.map((order) => order.params),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of zeroexV4Erc721Details) {
        success[originalIndex] = true;
      }
    }

    // Handle ZeroExV4 ERC1155 listings
    if (zeroexV4Erc1155Details.length) {
      const orders = zeroexV4Erc1155Details.map(
        (d) => d.order as Sdk.ZeroExV4.Order
      );

      for (const order of orders) {
        // Retrieve the order's signature
        if (order.params.cbOrderId) {
          await new Sdk.ZeroExV4.Exchange(
            this.chainId,
            String(this.options?.cbApiKey!)
          ).releaseOrder(taker, order);
        }
      }

      const fees = getFees(zeroexV4Erc1155Details);

      const totalPrice = orders
        .map((order, i) =>
          bn(order.params.erc20TokenAmount)
            // For ZeroExV4, the fees are not included in the price
            // TODO: Add order method to get the price including the fees
            .add(order.getFeeAmount())
            .mul(zeroexV4Erc1155Details[i].amount ?? 1)
            // Round up
            // TODO: ZeroExV4 ERC1155 orders are partially-fillable
            .add(bn(order.params.nftAmount ?? 1).sub(1))
            .div(order.params.nftAmount ?? 1)
        )
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module: this.contracts.zeroExV4Module.address,
        data:
          orders.length === 1
            ? this.contracts.zeroExV4Module.interface.encodeFunctionData(
                "acceptETHListingERC1155",
                [
                  orders[0].getRaw(),
                  orders[0].params,
                  zeroexV4Erc1155Details[0].amount ?? 1,
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.zeroExV4Module.interface.encodeFunctionData(
                "acceptETHListingsERC1155",
                [
                  orders.map((order) => order.getRaw()),
                  orders.map((order) => order.params),
                  zeroexV4Erc1155Details.map((d) => d.amount ?? 1),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of zeroexV4Erc1155Details) {
        success[originalIndex] = true;
      }
    }

    // Handle Zora listings
    if (zoraDetails.length) {
      const orders = zoraDetails.map((d) => d.order as Sdk.Zora.Order);
      const fees = getFees(zoraDetails);

      const totalPrice = orders
        .map((order) => bn(order.params.askPrice))
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module: this.contracts.zoraModule.address,
        data:
          orders.length === 1
            ? this.contracts.zoraModule.interface.encodeFunctionData(
                "acceptETHListing",
                [
                  orders[0].params,
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.foundationModule.interface.encodeFunctionData(
                "acceptETHListings",
                [
                  orders.map((order) => order.params),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of zoraDetails) {
        success[originalIndex] = true;
      }
    }

    // Handle Blur listings
    if (blurDetails.length) {
      const orders = blurDetails.map(
        (d) => d.order as Sdk.Blur.Order
      );
      const module = this.contracts.blurModule.address;

      const fees = getFees(blurDetails);

      const totalPrice = orders
        .map((order) => bn(order.params.price))
        .reduce((a, b) => a.add(b), bn(0));
      const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

      executions.push({
        module,
        data:
          orders.length === 1
            ? this.contracts.blurModule.interface.encodeFunctionData(
                "acceptETHListing",
                [
                  orders[0].getRaw(),
                  orders[0].buildMatching({
                    trader: module
                  }),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              )
            : this.contracts.blurModule.interface.encodeFunctionData(
                "acceptETHListings",
                [
                  orders.map((order) => order.getRaw()),
                  orders.map((order) =>
                    order.buildMatching({
                      trader: module
                    })
                  ),
                  {
                    fillTo: taker,
                    refundTo: taker,
                    revertIfIncomplete: Boolean(!options?.partial),
                    amount: totalPrice,
                  },
                  fees,
                ]
              ),
        value: totalPrice.add(totalFees),
      });

      // Mark the listings as successfully handled
      for (const { originalIndex } of blurDetails) {
        success[originalIndex] = true;
      }
    }

    return {
      txData: {
        from: taker,
        to: this.contracts.router.address,
        data:
          this.contracts.router.interface.encodeFunctionData("execute", [
            executions,
          ]) + generateSourceBytes(options?.source),
        value: executions
          .map((e) => bn(e.value))
          .reduce((a, b) => a.add(b))
          .toHexString(),
      },
      success,
    };
  }

  public async fillBidTx(
    detail: BidDetails,
    taker: string,
    options?: {
      source?: string;
    }
  ): Promise<{
    txData: TxData;
    // When `true`, the fill happens natively (not proxied, eg. through the router or via the on-received hooks)
    direct?: boolean;
  }> {
    // Assume the bid details are consistent with the underlying order object

    // TODO: Add Blur router module
    if (detail.kind === "blur") {
      const order = detail.order as Sdk.Blur.Order;
      const exchange = new Sdk.Blur.Exchange(this.chainId);
      const matchOrder = order.buildMatching({
        trader: taker,
      });

      return {
        txData: exchange.fillOrderTx(taker, order, matchOrder),
        direct: true,
      };
    }

    // TODO: Add Universe router module
    if (detail.kind === "universe") {
      const order = detail.order as Sdk.Universe.Order;
      const exchange = new Sdk.Universe.Exchange(this.chainId);
      return {
        txData: await exchange.fillOrderTx(taker, order, {
          amount: Number(detail.amount ?? 1),
          source: options?.source,
        }),
        direct: true,
      };
    }

    // TODO: Add Rarible router module
    if (detail.kind === "rarible") {
      const order = detail.order as Sdk.Rarible.Order;
      const exchange = new Sdk.Rarible.Exchange(this.chainId);
      return {
        txData: await exchange.fillOrderTx(taker, order, {
          tokenId: detail.tokenId,
          assetClass: detail.contractKind.toUpperCase(),
          amount: Number(detail.amount),
        }),
        direct: true,
      };
    }

    // TODO: Add Forward router module
    if (detail.kind === "forward") {
      const order = detail.order as Sdk.Forward.Order;

      const matchParams = order.buildMatching({
        tokenId: detail.tokenId,
        amount: detail.amount ?? 1,
        ...(detail.extraArgs ?? {}),
      });

      const exchange = new Sdk.Forward.Exchange(this.chainId);
      return {
        txData: exchange.fillOrderTx(taker, order, matchParams, {
          source: options?.source,
        }),
        direct: true,
      };
    }

    // Build module-level transaction data
    let moduleLevelTx: {
      module: string;
      data: string;
    };
    switch (detail.kind) {
      case "looks-rare": {
        const order = detail.order as Sdk.LooksRare.Order;
        const module = this.contracts.looksRareModule.address;

        const matchParams = order.buildMatching(
          // For LooksRare, the module acts as the taker proxy
          module,
          {
            tokenId: detail.tokenId,
            ...(detail.extraArgs || {}),
          }
        );

        moduleLevelTx = {
          module,
          data: this.contracts.looksRareModule.interface.encodeFunctionData(
            detail.contractKind === "erc721"
              ? "acceptERC721Offer"
              : "acceptERC1155Offer",
            [
              matchParams,
              order.params,
              {
                fillTo: taker,
                refundTo: taker,
                revertIfIncomplete: true,
              },
              [],
            ]
          ),
        };

        break;
      }

      case "seaport": {
        const order = detail.order as Sdk.Seaport.Order;

        const matchParams = order.buildMatching({
          tokenId: detail.tokenId,
          amount: detail.amount ?? 1,
          ...(detail.extraArgs ?? {}),
        });

        moduleLevelTx = {
          module: this.contracts.seaportModule.address,
          data: this.contracts.seaportModule.interface.encodeFunctionData(
            detail.contractKind === "erc721"
              ? "acceptERC721Offer"
              : "acceptERC1155Offer",
            [
              {
                parameters: {
                  ...order.params,
                  totalOriginalConsiderationItems:
                    order.params.consideration.length,
                },
                numerator: matchParams.amount ?? 1,
                denominator: 1,
                signature: order.params.signature,
                extraData: "0x",
              },
              matchParams.criteriaResolvers ?? [],
              {
                fillTo: taker,
                refundTo: taker,
                revertIfIncomplete: true,
              },
              [],
            ]
          ),
        };

        break;
      }

      case "seaport-partial": {
        const order = detail.order as Sdk.Seaport.Types.PartialOrder;
        const result = await axios.get(
          `https://order-fetcher.vercel.app/api/offer?orderHash=${order.id}&contract=${order.contract}&tokenId=${order.tokenId}&taker=${taker}`
        );

        const fullOrder = new Sdk.Seaport.Order(
          this.chainId,
          result.data.order
        );

        moduleLevelTx = {
          module: this.contracts.seaportModule.address,
          data: this.contracts.seaportModule.interface.encodeFunctionData(
            detail.contractKind === "erc721"
              ? "acceptERC721Offer"
              : "acceptERC1155Offer",
            [
              {
                parameters: {
                  ...fullOrder.params,
                  totalOriginalConsiderationItems:
                    fullOrder.params.consideration.length,
                },
                numerator: detail.amount ?? 1,
                denominator: 1,
                signature: fullOrder.params.signature,
                extraData: "0x",
              },
              result.data.criteriaResolvers ?? [],
              {
                fillTo: taker,
                refundTo: taker,
                revertIfIncomplete: true,
              },
              [],
            ]
          ),
        };

        break;
      }

      case "sudoswap": {
        const order = detail.order as Sdk.Sudoswap.Order;

        moduleLevelTx = {
          module: this.contracts.sudoswapModule.address,
          data: this.contracts.sudoswapModule.interface.encodeFunctionData(
            "sell",
            [
              order.params.pair,
              detail.tokenId,
              bn(order.params.price).sub(
                // Take into account the protocol fee of 0.5%
                bn(order.params.price).mul(50).div(10000)
              ),
              Math.floor(Date.now() / 1000),
              {
                fillTo: taker,
                refundTo: taker,
                revertIfIncomplete: true,
              },
              [],
            ]
          ),
        };

        break;
      }

      case "x2y2": {
        const order = detail.order as Sdk.X2Y2.Order;
        const exchange = new Sdk.X2Y2.Exchange(
          this.chainId,
          String(this.options?.x2y2ApiKey)
        );

        moduleLevelTx = {
          module: this.contracts.x2y2Module.address,
          data: this.contracts.x2y2Module.interface.encodeFunctionData(
            detail.contractKind === "erc721"
              ? "acceptERC721Offer"
              : "acceptERC1155Offer",
            [
              exchange.contract.interface.decodeFunctionData(
                "run",
                await exchange.fetchInput(
                  // For X2Y2, the module acts as the taker proxy
                  this.contracts.x2y2Module.address,
                  order,
                  {
                    tokenId: detail.tokenId,
                    source: options?.source,
                  }
                )
              ).input,
              order.params,
              {
                fillTo: taker,
                refundTo: taker,
                revertIfIncomplete: true,
              },
              [],
            ]
          ),
        };

        break;
      }

      case "zeroex-v4": {
        const order = detail.order as Sdk.ZeroExV4.Order;

        // Retrieve the order's signature
        if (order.params.cbOrderId) {
          await new Sdk.ZeroExV4.Exchange(
            this.chainId,
            String(this.options?.cbApiKey!)
          ).releaseOrder(taker, order);
        }

        if (detail.contractKind === "erc721") {
          moduleLevelTx = {
            module: this.contracts.zeroExV4Module.address,
            data: this.contracts.zeroExV4Module.interface.encodeFunctionData(
              "acceptERC721Offer",
              [
                order.getRaw(),
                order.params,
                {
                  fillTo: taker,
                  refundTo: taker,
                  revertIfIncomplete: true,
                },
                detail.tokenId,
                [],
              ]
            ),
          };
        } else {
          moduleLevelTx = {
            module: this.contracts.zeroExV4Module.address,
            data: this.contracts.zeroExV4Module.interface.encodeFunctionData(
              "acceptERC1155Offer",
              [
                order.getRaw(),
                order.params,
                detail.amount ?? 1,
                {
                  fillTo: taker,
                  refundTo: taker,
                  revertIfIncomplete: true,
                },
                detail.tokenId,
                [],
              ]
            ),
          };
        }

        break;
      }

      default: {
        throw new Error("Unsupported exchange kind");
      }
    }

    // Generate router-level transaction data
    const routerLevelTxData =
      this.contracts.router.interface.encodeFunctionData("execute", [
        [
          {
            module: moduleLevelTx.module,
            data: moduleLevelTx.data,
            value: 0,
          },
        ],
      ]);

    // Use the on-received ERC721/ERC1155 hooks for approval-less bid filling
    if (detail.contractKind === "erc721") {
      return {
        txData: {
          from: taker,
          to: detail.contract,
          data:
            new Interface(ERC721Abi).encodeFunctionData(
              "safeTransferFrom(address,address,uint256,bytes)",
              [taker, moduleLevelTx.module, detail.tokenId, routerLevelTxData]
            ) + generateSourceBytes(options?.source),
        },
        direct: false,
      };
    } else {
      return {
        txData: {
          from: taker,
          to: detail.contract,
          data:
            new Interface(ERC1155Abi).encodeFunctionData(
              "safeTransferFrom(address,address,uint256,uint256,bytes)",
              [
                taker,
                moduleLevelTx.module,
                detail.tokenId,
                detail.amount ?? 1,
                routerLevelTxData,
              ]
            ) + generateSourceBytes(options?.source),
        },
        direct: false,
      };
    }
  }
}
