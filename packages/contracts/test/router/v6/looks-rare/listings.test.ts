import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { parseEther, parseUnits } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { ExecutionInfo } from "../../helpers/router";
import {
  SeaportERC20Approval,
  setupSeaportERC20Approvals,
} from "../../helpers/seaport";
import {
  LooksRareListing,
  setupLooksRareListings,
} from "../../helpers/looks-rare";
import {
  bn,
  getChainId,
  getCurrentTimestamp,
  getRandomBoolean,
  getRandomFloat,
  getRandomInteger,
  reset,
  setupNFTs,
} from "../../../utils";

describe("[ReservoirV6_0_0] LooksRare listings", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let david: SignerWithAddress;
  let emilio: SignerWithAddress;

  let erc721: Contract;
  let router: Contract;
  let looksRareModule: Contract;
  let seaportModule: Contract;
  let uniswapV3Module: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, david, emilio] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));

    router = (await ethers
      .getContractFactory("ReservoirV6_0_0", deployer)
      .then((factory) => factory.deploy())) as any;
    looksRareModule = (await ethers
      .getContractFactory("LooksRareModule", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    seaportModule = (await ethers
      .getContractFactory("SeaportModule", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    uniswapV3Module = (await ethers
      .getContractFactory("UniswapV3Module", deployer)
      .then((factory) => factory.deploy(router.address))) as any;

    await router.registerModule(looksRareModule.address);
    await router.registerModule(seaportModule.address);
    await router.registerModule(uniswapV3Module.address);
  });

  const getBalances = async (token: string) => {
    if (token === Sdk.Common.Addresses.Eth[chainId]) {
      return {
        alice: await ethers.provider.getBalance(alice.address),
        bob: await ethers.provider.getBalance(bob.address),
        carol: await ethers.provider.getBalance(carol.address),
        david: await ethers.provider.getBalance(david.address),
        emilio: await ethers.provider.getBalance(emilio.address),
        router: await ethers.provider.getBalance(router.address),
        looksRareModule: await ethers.provider.getBalance(
          looksRareModule.address
        ),
      };
    } else {
      const contract = new Sdk.Common.Helpers.Erc20(ethers.provider, token);
      return {
        alice: await contract.getBalance(alice.address),
        bob: await contract.getBalance(bob.address),
        carol: await contract.getBalance(carol.address),
        david: await contract.getBalance(david.address),
        emilio: await contract.getBalance(emilio.address),
        router: await contract.getBalance(router.address),
        looksRareModule: await contract.getBalance(looksRareModule.address),
      };
    }
  };

  afterEach(reset);

  const testAcceptListings = async (
    // Whether to fill USDC or ETH listings
    useUsdc: boolean,
    // Whether to include fees on top
    chargeFees: boolean,
    // Whether to revert or not in case of any failures
    revertIfIncomplete: boolean,
    // Whether to cancel some orders in order to trigger partial filling
    partial: boolean,
    // Number of listings to fill
    listingsCount: number
  ) => {
    // Setup

    // Makers: Alice and Bob
    // Taker: Carol
    // Fee recipient: Emilio

    const currency = useUsdc
      ? Sdk.Common.Addresses.Usdc[chainId]
      : Sdk.Common.Addresses.Weth[chainId];
    const parsePrice = (price: string) =>
      useUsdc ? parseUnits(price, 6) : parseEther(price);

    const listings: LooksRareListing[] = [];
    const feesOnTop: BigNumber[] = [];
    for (let i = 0; i < listingsCount; i++) {
      listings.push({
        seller: getRandomBoolean() ? alice : bob,
        nft: {
          kind: "erc721",
          contract: erc721,
          id: getRandomInteger(1, 10000),
        },
        currency,
        price: parsePrice(getRandomFloat(0.0001, 2).toFixed(6)),
        isCancelled: partial && getRandomBoolean(),
      });
      if (chargeFees) {
        feesOnTop.push(parsePrice(getRandomFloat(0.0001, 0.1).toFixed(6)));
      }
    }
    await setupLooksRareListings(listings);

    const totalPrice = bn(
      listings.map(({ price }) => price).reduce((a, b) => bn(a).add(b), bn(0))
    );

    const approval: SeaportERC20Approval = {
      giver: carol,
      filler: seaportModule.address,
      receiver: looksRareModule.address,
      paymentToken: currency,
      amount: totalPrice.add(
        // Anything on top should be refunded
        feesOnTop.reduce((a, b) => bn(a).add(b), bn(0)).add(parsePrice("0.1"))
      ),
    };
    await setupSeaportERC20Approvals([approval]);

    // Prepare executions

    const executions: ExecutionInfo[] = [
      ...(useUsdc
        ? [
            // 1. When filling USDC listings, swap ETH to USDC on Uniswap V3 (for testing purposes only)
            {
              module: uniswapV3Module.address,
              data: uniswapV3Module.interface.encodeFunctionData(
                "ethToExactOutput",
                [
                  {
                    tokenIn: Sdk.Common.Addresses.Weth[chainId],
                    tokenOut: Sdk.Common.Addresses.Usdc[chainId],
                    fee: 500,
                    // Send USDC to the Carol
                    recipient: carol.address,
                    deadline: (await getCurrentTimestamp(ethers.provider)) + 60,
                    amountOut: listings
                      .map(({ price }, i) =>
                        bn(price).add(chargeFees ? feesOnTop[i] : 0)
                      )
                      .reduce((a, b) => bn(a).add(b), bn(0))
                      // Anything on top should be refunded
                      .add(parsePrice("1000")),
                    amountInMaximum: parseEther("100"),
                    sqrtPriceLimitX96: 0,
                  },
                  // Refund to Carol
                  carol.address,
                ]
              ),
              // Anything on top should be refunded
              value: parseEther("100"),
            },
            // 2. Fill approval order, so that we avoid giving approval to the router
            {
              module: seaportModule.address,
              data: seaportModule.interface.encodeFunctionData("matchOrders", [
                [
                  // Regular order
                  {
                    parameters: {
                      ...approval.orders![0].params,
                      totalOriginalConsiderationItems:
                        approval.orders![0].params.consideration.length,
                    },
                    signature: approval.orders![0].params.signature,
                  },
                  // Mirror order
                  {
                    parameters: {
                      ...approval.orders![1].params,
                      totalOriginalConsiderationItems:
                        approval.orders![1].params.consideration.length,
                    },
                    signature: "0x",
                  },
                ],
                // Match the single offer item to the single consideration item
                [
                  {
                    offerComponents: [
                      {
                        orderIndex: 0,
                        itemIndex: 0,
                      },
                    ],
                    considerationComponents: [
                      {
                        orderIndex: 0,
                        itemIndex: 0,
                      },
                    ],
                  },
                ],
              ]),
              value: 0,
            },
          ]
        : []),
      // 3. Fill listings
      listingsCount > 1
        ? {
            module: looksRareModule.address,
            data: looksRareModule.interface.encodeFunctionData(
              `accept${useUsdc ? "ERC20" : "ETH"}Listings`,
              [
                listings.map((listing) =>
                  listing.order!.buildMatching(looksRareModule.address)
                ),
                listings.map((listing) => listing.order!.params),
                {
                  fillTo: carol.address,
                  refundTo: carol.address,
                  revertIfIncomplete,
                  amount: totalPrice,
                  // Only relevant when filling USDC listings
                  token: currency,
                },
                [
                  ...feesOnTop.map((amount) => ({
                    recipient: emilio.address,
                    amount,
                  })),
                ],
              ]
            ),
            value: useUsdc
              ? 0
              : totalPrice.add(
                  // Anything on top should be refunded
                  feesOnTop
                    .reduce((a, b) => bn(a).add(b), bn(0))
                    .add(parsePrice("0.1"))
                ),
          }
        : {
            module: looksRareModule.address,
            data: looksRareModule.interface.encodeFunctionData(
              `accept${useUsdc ? "ERC20" : "ETH"}Listing`,
              [
                listings[0].order!.buildMatching(looksRareModule.address),
                listings[0].order!.params,
                {
                  fillTo: carol.address,
                  refundTo: carol.address,
                  revertIfIncomplete,
                  amount: totalPrice,
                  // Only relevant when filling USDC listings
                  token: currency,
                },
                chargeFees
                  ? feesOnTop.map((amount) => ({
                      recipient: emilio.address,
                      amount,
                    }))
                  : [],
              ]
            ),
            value: useUsdc
              ? 0
              : totalPrice.add(
                  // Anything on top should be refunded
                  feesOnTop
                    .reduce((a, b) => bn(a).add(b), bn(0))
                    .add(parsePrice("0.1"))
                ),
          },
    ];

    // Checks

    // If the `revertIfIncomplete` option is enabled and we have any
    // orders that are not fillable, the whole transaction should be
    // reverted
    if (
      partial &&
      revertIfIncomplete &&
      listings.some(({ isCancelled }) => isCancelled)
    ) {
      await expect(
        router.connect(carol).execute(executions, {
          value: executions
            .map(({ value }) => value)
            .reduce((a, b) => bn(a).add(b), bn(0)),
        })
      ).to.be.revertedWith(
        "reverted with custom error 'UnsuccessfulExecution()'"
      );

      return;
    }

    // Fetch pre-state

    // LooksRare wraps all ETH
    const ethBalancesBefore = await getBalances(
      Sdk.Common.Addresses.Eth[chainId]
    );
    const balancesBefore = await getBalances(currency);

    // Execute

    await router.connect(carol).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b), bn(0)),
      gasLimit: 1000000,
    });

    // Fetch post-state

    const ethBalancesAfter = await getBalances(
      Sdk.Common.Addresses.Eth[chainId]
    );
    const balancesAfter = await getBalances(currency);

    // Checks

    // Alice got the payment
    expect(balancesAfter.alice.sub(balancesBefore.alice)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            !isCancelled && seller.address === alice.address
        )
        .map(({ price }) =>
          bn(price).sub(
            // Take into consideration the protocol fee
            bn(price).mul(200).div(10000)
          )
        )
        .reduce((a, b) => bn(a).add(b), bn(0))
    );
    // Bob got the payment
    expect(balancesAfter.bob.sub(balancesBefore.bob)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            !isCancelled && seller.address === bob.address
        )
        .map(({ price }) =>
          bn(price).sub(
            // Take into consideration the protocol fee
            bn(price).mul(200).div(10000)
          )
        )
        .reduce((a, b) => bn(a).add(b), bn(0))
    );

    // Emilio got the fee payments
    if (chargeFees) {
      // Fees are charged per execution, and since we have a single execution
      // here, we will have a single fee payment at the end adjusted over the
      // amount that was actually paid (eg. prices of filled orders)
      const actualPaid = listings
        .filter(({ isCancelled }) => !isCancelled)
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0));
      expect(
        (useUsdc ? balancesAfter : ethBalancesAfter).emilio.sub(
          (useUsdc ? balancesBefore : ethBalancesBefore).emilio
        )
      ).to.eq(
        listings
          .map((_, i) => feesOnTop[i].mul(actualPaid).div(totalPrice))
          .reduce((a, b) => bn(a).add(b), bn(0))
      );
    }

    // Carol got the NFTs from all filled orders
    for (let i = 0; i < listings.length; i++) {
      if (!listings[i].isCancelled) {
        expect(await erc721.ownerOf(listings[i].nft.id)).to.eq(carol.address);
      } else {
        expect(await erc721.ownerOf(listings[i].nft.id)).to.eq(
          listings[i].seller.address
        );
      }
    }

    // Router is stateless
    expect(balancesAfter.router).to.eq(0);
    expect(balancesAfter.looksRareModule).to.eq(0);
    expect(ethBalancesAfter.router).to.eq(0);
    expect(ethBalancesAfter.looksRareModule).to.eq(0);
  };

  // LooksRare only supports ETH/WETH orders at the moment (other currencies require whitelisting)
  for (let useUsdc of [false]) {
    for (let multiple of [false]) {
      for (let partial of [false, true]) {
        for (let chargeFees of [false, true]) {
          for (let revertIfIncomplete of [false, true]) {
            it(
              `${useUsdc ? "[usdc]" : "[eth]"}` +
                `${multiple ? "[multiple-orders]" : "[single-order]"}` +
                `${partial ? "[partial]" : "[full]"}` +
                `${chargeFees ? "[fees]" : "[no-fees]"}` +
                `${revertIfIncomplete ? "[reverts]" : "[skip-reverts]"}`,
              async () =>
                testAcceptListings(
                  useUsdc,
                  chargeFees,
                  revertIfIncomplete,
                  partial,
                  multiple ? getRandomInteger(2, 6) : 1
                )
            );
          }
        }
      }
    }
  }
});
