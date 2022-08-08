import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { parseEther, parseUnits } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { ExecutionInfo } from "../helpers/router";
import {
  SeaportListing,
  SeaportTip,
  setupSeaportListings,
  setupSeaportTips,
} from "../helpers/seaport";
import {
  bn,
  getChainId,
  getCurrentTimestamp,
  getRandomBoolean,
  getRandomFloat,
  getRandomInteger,
  reset,
  setupNFTs,
} from "../../utils";

describe("[ReservoirV6_0_0] Seaport", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let david: SignerWithAddress;
  let emilio: SignerWithAddress;

  let erc721: Contract;
  let router: Contract;
  let seaportModule: Contract;
  let uniswapV3Module: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, david, emilio] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));

    router = (await ethers
      .getContractFactory("ReservoirV6_0_0", deployer)
      .then((factory) => factory.deploy())) as any;
    seaportModule = (await ethers
      .getContractFactory("SeaportModule", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    uniswapV3Module = (await ethers
      .getContractFactory("UniswapV3Module", deployer)
      .then((factory) => factory.deploy(router.address))) as any;

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
        seaportModule: await ethers.provider.getBalance(seaportModule.address),
        uniswapV3Module: await ethers.provider.getBalance(
          uniswapV3Module.address
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
        seaportModule: await contract.getBalance(seaportModule.address),
        uniswapV3Module: await contract.getBalance(uniswapV3Module.address),
      };
    }
  };

  afterEach(reset);

  const testAcceptListings = async (
    // Whether to fill USDC or ETH listings
    useUsdc: boolean,
    // Include fees on top
    withFees: boolean,
    // Whether to revert or not in case of any failures
    revertIfIncomplete: boolean,
    // Whether to cancel some orders in order to trigger partial filling
    partial: boolean,
    // Number of listings to fill
    listingsCount: number
  ) => {
    // Setup

    const paymentToken = useUsdc
      ? Sdk.Common.Addresses.Usdc[chainId]
      : Sdk.Common.Addresses.Eth[chainId];

    const listings: SeaportListing[] = [];
    const feesOnTop: BigNumber[] = [];
    for (let i = 0; i < listingsCount; i++) {
      listings.push({
        seller: getRandomBoolean() ? alice : bob,
        nft: {
          kind: "erc721",
          contract: erc721,
          id: getRandomInteger(1, 10000),
        },
        paymentToken,
        price: parseUnits(
          getRandomFloat(0.0001, 2).toFixed(6),
          useUsdc ? 6 : 18
        ),
        isCancelled: partial && getRandomBoolean(),
      });
      feesOnTop.push(
        parseUnits(getRandomFloat(0.0001, 0.1).toFixed(6), useUsdc ? 6 : 18)
      );
    }
    await setupSeaportListings(listings);

    // Prepare executions

    const totalPrice = bn(
      listings.map(({ price }) => price).reduce((a, b) => bn(a).add(b), bn(0))
    );
    const executions: ExecutionInfo[] = [
      // 1. If filling USDC listings, swap ETH to USDC on Uniswap V3 (for testing purposes only)
      ...(useUsdc
        ? [
            {
              module: uniswapV3Module.address,
              data: uniswapV3Module.interface.encodeFunctionData(
                "ethToExactOutput",
                [
                  {
                    tokenIn: Sdk.Common.Addresses.Weth[chainId],
                    tokenOut: Sdk.Common.Addresses.Usdc[chainId],
                    fee: 500,
                    recipient: seaportModule.address,
                    deadline: (await getCurrentTimestamp(ethers.provider)) + 60,
                    amountOut: listings
                      .map(({ price }, i) =>
                        withFees ? bn(price).add(feesOnTop[i]) : price
                      )
                      .reduce((a, b) => bn(a).add(b), bn(0)),
                    amountInMaximum: parseEther("10"),
                    sqrtPriceLimitX96: 0,
                  },
                  carol.address,
                ]
              ),
              value: parseEther("10"),
            },
          ]
        : []),
      // 2. Fill listings
      listingsCount > 1
        ? {
            module: seaportModule.address,
            data: seaportModule.interface.encodeFunctionData(
              `accept${useUsdc ? "ERC20" : "ETH"}Listings${
                withFees ? "WithFees" : ""
              }`,
              [
                listings.map((listing) => ({
                  parameters: {
                    ...listing.order!.params,
                    totalOriginalConsiderationItems:
                      listing.order!.params.consideration.length,
                  },
                  numerator: 1,
                  denominator: 1,
                  signature: listing.order!.params.signature,
                  extraData: "0x",
                })),
                // TODO: Look into optimizing the fulfillments
                {
                  offer: listings
                    .map(({ order }, i) =>
                      order!.params.offer.map((_, j) => ({
                        orderIndex: i,
                        itemIndex: j,
                      }))
                    )
                    .flat()
                    .map((x) => [x]),
                  consideration: listings
                    .map(({ order }, i) =>
                      order!.params.consideration.map((_, j) => ({
                        orderIndex: i,
                        itemIndex: j,
                      }))
                    )
                    .flat()
                    .map((x) => [x]),
                },
                {
                  fillTo: carol.address,
                  refundTo: carol.address,
                  revertIfIncomplete,
                  token: paymentToken,
                  amount: totalPrice,
                },
                ...(withFees
                  ? [
                      feesOnTop.map((amount) => ({
                        recipient: emilio.address,
                        amount,
                      })),
                    ]
                  : []),
              ]
            ),
            value: useUsdc
              ? 0
              : totalPrice.add(
                  // Anything on top should be refunded
                  feesOnTop
                    .reduce((a, b) => bn(a).add(b), bn(0))
                    .add(parseEther("0.1"))
                ),
          }
        : {
            module: seaportModule.address,
            data: seaportModule.interface.encodeFunctionData(
              `accept${useUsdc ? "ERC20" : "ETH"}Listing${
                withFees ? "WithFees" : ""
              }`,
              [
                ...listings.map((listing) => ({
                  parameters: {
                    ...listing.order!.params,
                    totalOriginalConsiderationItems:
                      listing.order!.params.consideration.length,
                  },
                  numerator: 1,
                  denominator: 1,
                  signature: listing.order!.params.signature,
                  extraData: "0x",
                })),
                {
                  fillTo: carol.address,
                  refundTo: carol.address,
                  revertIfIncomplete,
                  token: paymentToken,
                  amount: totalPrice,
                },
                ...(withFees
                  ? [
                      feesOnTop.map((amount) => ({
                        recipient: emilio.address,
                        amount,
                      })),
                    ]
                  : []),
              ]
            ),
            value: useUsdc
              ? 0
              : totalPrice.add(
                  // Anything on top should be refunded
                  feesOnTop
                    .reduce((a, b) => bn(a).add(b), bn(0))
                    .add(parseEther("0.1"))
                ),
          },
    ];

    // Execute

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

    const balancesBefore = await getBalances(paymentToken);

    // Execute

    await router.connect(carol).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b), bn(0)),
    });

    // Fetch post-state

    const balancesAfter = await getBalances(paymentToken);

    // Checks

    // Alice got the payment
    expect(balancesAfter.alice.sub(balancesBefore.alice)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            !isCancelled && seller.address === alice.address
        )
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0))
    );
    // Bob got the payment
    expect(balancesAfter.bob.sub(balancesBefore.bob)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            !isCancelled && seller.address === bob.address
        )
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0))
    );

    // Fee recipient got their payment
    if (withFees) {
      const actualPaid = listings
        .filter(({ isCancelled }) => !isCancelled)
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0));
      expect(balancesAfter.emilio.sub(balancesBefore.emilio)).to.eq(
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
    expect(balancesAfter.seaportModule).to.eq(0);
    expect(balancesAfter.uniswapV3Module).to.eq(0);
  };

  for (let useUsdc of [false, true]) {
    for (let multiple of [false, true]) {
      for (let partial of [false, true]) {
        for (let withFees of [false, true]) {
          for (let revertIfIncomplete of [false, true]) {
            it(
              `${useUsdc ? "[usdc]" : "[eth]"}` +
                `${multiple ? "[multiple]" : "[single]"}` +
                `${partial ? "[partial]" : "[full]"}` +
                `${withFees ? "[fees]" : "[no-fees]"}` +
                `${revertIfIncomplete ? "[reverts]" : "[no-reverts]"}`,
              async () =>
                testAcceptListings(
                  useUsdc,
                  withFees,
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

  it("Fill USDC listing with ETH", async () => {
    // Setup

    const listing: SeaportListing = {
      seller: alice,
      nft: {
        kind: "erc721",
        contract: erc721,
        id: 9876,
      },
      paymentToken: Sdk.Common.Addresses.Usdc[chainId],
      price: parseUnits("2576", 6),
    };
    await setupSeaportListings([listing]);

    // Prepare executions

    const executions: ExecutionInfo[] = [
      // 1. Swap ETH for USDC on UniswapV3, sending the USDC to the Seaport module
      {
        module: uniswapV3Module.address,
        data: uniswapV3Module.interface.encodeFunctionData("ethToExactOutput", [
          {
            tokenIn: Sdk.Common.Addresses.Weth[chainId],
            tokenOut: Sdk.Common.Addresses.Usdc[chainId],
            fee: 500,
            recipient: seaportModule.address,
            deadline: (await getCurrentTimestamp(ethers.provider)) + 60,
            amountOut: listing.price,
            amountInMaximum: parseEther("2"),
            sqrtPriceLimitX96: 0,
          },
          bob.address,
        ]),
        value: parseEther("2"),
      },
      // 2. Fill USDC listing with the received funds
      {
        module: seaportModule.address,
        data: seaportModule.interface.encodeFunctionData("acceptERC20Listing", [
          {
            parameters: {
              ...listing.order!.params,
              totalOriginalConsiderationItems:
                listing.order!.params.consideration.length,
            },
            numerator: 1,
            denominator: 1,
            signature: listing.order!.params.signature,
            extraData: "0x",
          },
          {
            fillTo: bob.address,
            refundTo: bob.address,
            revertIfIncomplete: true,
            token: listing.paymentToken!,
            amount: listing.price,
          },
        ]),
        value: 0,
      },
    ];

    // Fetch pre-state

    const balancesBefore = await getBalances(
      Sdk.Common.Addresses.Usdc[chainId]
    );

    // Execute

    await router.connect(bob).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b)),
    });

    // Fetch post-state

    const balancesAfter = await getBalances(Sdk.Common.Addresses.Usdc[chainId]);
    const ethBalancesAfter = await getBalances(
      Sdk.Common.Addresses.Eth[chainId]
    );

    // Checks

    // Alice got the USDC
    expect(balancesAfter.alice.sub(balancesBefore.alice)).to.eq(listing.price);

    // Bob got the NFT
    expect(await erc721.ownerOf(listing.nft.id)).to.eq(bob.address);

    // Router is stateless
    expect(balancesAfter.router).to.eq(0);
    expect(balancesAfter.seaportModule).to.eq(0);
    expect(balancesAfter.uniswapV3Module).to.eq(0);
    expect(ethBalancesAfter.router).to.eq(0);
    expect(ethBalancesAfter.seaportModule).to.eq(0);
    expect(ethBalancesAfter.uniswapV3Module).to.eq(0);
  });

  it("Fill USDC listing approval-less", async () => {
    // Setup

    const listing: SeaportListing = {
      seller: alice,
      nft: {
        kind: "erc721",
        contract: erc721,
        id: 9876,
      },
      paymentToken: Sdk.Common.Addresses.Usdc[chainId],
      price: parseUnits("2576", 6),
    };
    await setupSeaportListings([listing]);

    const tip: SeaportTip = {
      giver: bob,
      receiver: seaportModule.address,
      paymentToken: listing.paymentToken!,
      amount: listing.price,
    };
    await setupSeaportTips([tip]);

    // Prepare executions

    const executions: ExecutionInfo[] = [
      // 1. Swap ETH for USDC and send it to Bob (for testing purposes only)
      {
        module: uniswapV3Module.address,
        data: uniswapV3Module.interface.encodeFunctionData("ethToExactOutput", [
          {
            tokenIn: Sdk.Common.Addresses.Weth[chainId],
            tokenOut: Sdk.Common.Addresses.Usdc[chainId],
            fee: 500,
            recipient: bob.address,
            deadline: (await getCurrentTimestamp(ethers.provider)) + 60,
            amountOut: listing.price,
            amountInMaximum: parseEther("2"),
            sqrtPriceLimitX96: 0,
          },
          bob.address,
        ]),
        value: parseEther("2"),
      },
      // 2. Fill tip order, so that we avoid giving approval to the router
      {
        module: seaportModule.address,
        data: seaportModule.interface.encodeFunctionData("matchOrders", [
          [
            {
              parameters: {
                ...tip.orders![0].params,
                totalOriginalConsiderationItems:
                  tip.orders![0].params.consideration.length,
              },
              signature: tip.orders![0].params.signature,
            },
            {
              parameters: {
                ...tip.orders![1].params,
                totalOriginalConsiderationItems:
                  tip.orders![1].params.consideration.length,
              },
              signature: "0x",
            },
          ],
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
      // 2. Fill USDC listing with the received funds
      {
        module: seaportModule.address,
        data: seaportModule.interface.encodeFunctionData("acceptERC20Listing", [
          {
            parameters: {
              ...listing.order!.params,
              totalOriginalConsiderationItems:
                listing.order!.params.consideration.length,
            },
            numerator: 1,
            denominator: 1,
            signature: listing.order!.params.signature,
            extraData: "0x",
          },
          {
            fillTo: bob.address,
            refundTo: bob.address,
            revertIfIncomplete: true,
            token: listing.paymentToken!,
            amount: listing.price,
          },
        ]),
        value: 0,
      },
    ];

    // Fetch pre-state

    const balancesBefore = await getBalances(
      Sdk.Common.Addresses.Usdc[chainId]
    );

    // Execute

    await router.connect(bob).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b)),
      gasLimit: 1000000,
    });

    // Fetch post-state

    const balancesAfter = await getBalances(Sdk.Common.Addresses.Usdc[chainId]);

    // Checks

    // Alice got the USDC
    expect(balancesAfter.alice.sub(balancesBefore.alice)).to.eq(listing.price);

    // Bob got the NFT
    expect(await erc721.ownerOf(listing.nft.id)).to.eq(bob.address);

    // Router is stateless
    expect(balancesAfter.router).to.eq(0);
    expect(balancesAfter.seaportModule).to.eq(0);
    expect(balancesAfter.uniswapV3Module).to.eq(0);
  });
});
