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
  reset,
  setupNFTs,
} from "../../utils";

describe("ReservoirV6_0_0 - fill listings", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let david: SignerWithAddress;
  let emilio: SignerWithAddress;

  let erc721: Contract;
  let erc1155: Contract;
  let router: Contract;
  let seaportMarket: Contract;
  let uniswapV3Market: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, david, emilio] = await ethers.getSigners();

    ({ erc721, erc1155 } = await setupNFTs(deployer));

    router = (await ethers
      .getContractFactory("ReservoirV6_0_0", deployer)
      .then((factory) => factory.deploy())) as any;
    seaportMarket = (await ethers
      .getContractFactory("SeaportMarket", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    uniswapV3Market = (await ethers
      .getContractFactory("UniswapV3Market", deployer)
      .then((factory) => factory.deploy(router.address))) as any;

    await router.registerMarket(seaportMarket.address);
    await router.registerMarket(uniswapV3Market.address);
  });

  afterEach(reset);

  it("[Seaport] Fill ETH listing with fees", async () => {
    // Setup

    const listing: SeaportListing = {
      seller: alice,
      nft: {
        kind: "erc721",
        contract: erc721,
        id: 9876,
      },
      price: parseEther("1.3688"),
    };
    await setupSeaportListings([listing]);

    // Prepare executions

    const feesOnTop = [parseEther("0.005"), parseEther("0.00463728")];
    const executions: ExecutionInfo[] = [
      // 1. Fill ETH listing with provided ETH
      {
        market: seaportMarket.address,
        data: seaportMarket.interface.encodeFunctionData(
          "acceptETHListingWithFees",
          [
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
              amount: listing.price,
            },
            [
              {
                recipient: carol.address,
                amount: feesOnTop[0],
              },
              {
                recipient: david.address,
                amount: feesOnTop[1],
              },
            ],
          ]
        ),
        value: bn(listing.price).add(
          // Anything on top of the listing payment and fees should be refunded
          parseEther("0.5")
        ),
      },
    ];

    // Fetch pre-state

    const aliceEthBalanceBefore = await ethers.provider.getBalance(
      alice.address
    );
    const carolEthBalanceBefore = await ethers.provider.getBalance(
      carol.address
    );
    const davidEthBalanceBefore = await ethers.provider.getBalance(
      david.address
    );

    // Execute

    await router.connect(bob).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b)),
    });

    // Fetch post-state

    const aliceEthBalanceAfter = await ethers.provider.getBalance(
      alice.address
    );
    const carolEthBalanceAfter = await ethers.provider.getBalance(
      carol.address
    );
    const davidEthBalanceAfter = await ethers.provider.getBalance(
      david.address
    );

    // Checks

    // Alice got the ETH
    expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(
      listing.price
    );

    // Fee recipients got their ETH
    expect(carolEthBalanceAfter.sub(carolEthBalanceBefore)).to.eq(feesOnTop[0]);
    expect(davidEthBalanceAfter.sub(davidEthBalanceBefore)).to.eq(feesOnTop[1]);

    // Bob got the NFT
    expect(await erc721.ownerOf(listing.nft.id)).to.eq(bob.address);

    // Router is stateless
    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
    expect(await ethers.provider.getBalance(uniswapV3Market.address)).to.eq(0);
  });

  it("[Seaport] Partially fill ETH listing with fees", async () => {
    // Setup

    const listing: SeaportListing = {
      seller: alice,
      nft: {
        kind: "erc721",
        contract: erc721,
        id: 9876,
      },
      price: parseEther("1.3688"),
      isCancelled: true,
    };
    await setupSeaportListings([listing]);

    // Prepare executions

    const feesOnTop = [parseEther("0.005"), parseEther("0.00463728")];
    const getExecutions = (revertIfIncomplete: boolean): ExecutionInfo[] => [
      // 1. Fill ETH listing with provided ETH
      {
        market: seaportMarket.address,
        data: seaportMarket.interface.encodeFunctionData(
          "acceptETHListingWithFees",
          [
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
              revertIfIncomplete,
              amount: listing.price,
            },
            [
              {
                recipient: carol.address,
                amount: feesOnTop[0],
              },
              {
                recipient: david.address,
                amount: feesOnTop[1],
              },
            ],
          ]
        ),
        value: bn(listing.price).add(
          // Anything on top of the listing payment and fees should be refunded
          parseEther("0.5")
        ),
      },
    ];

    // Execute

    // Fails because we disallow reverts
    const disallowRevertsExecutions = getExecutions(true);
    await expect(
      router.connect(bob).execute(disallowRevertsExecutions, {
        value: disallowRevertsExecutions
          .map(({ value }) => value)
          .reduce((a, b) => bn(a).add(b)),
      })
    ).to.be.revertedWith(
      "reverted with custom error 'UnsuccessfulExecution()'"
    );

    // Fetch pre-state

    const aliceEthBalanceBefore = await ethers.provider.getBalance(
      alice.address
    );
    const bobEthBalanceBefore = await ethers.provider.getBalance(bob.address);
    const carolEthBalanceBefore = await ethers.provider.getBalance(
      carol.address
    );
    const davidEthBalanceBefore = await ethers.provider.getBalance(
      david.address
    );

    // Execute

    // Succeeds because we allow reverts
    const allowRevertsExecutions = getExecutions(false);
    const ethPaidOnGas = await router
      .connect(bob)
      .execute(allowRevertsExecutions, {
        value: allowRevertsExecutions
          .map(({ value }) => value)
          .reduce((a, b) => bn(a).add(b)),
      })
      .then((tx: any) => tx.wait())
      .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

    // Fetch post-state

    const aliceEthBalanceAfter = await ethers.provider.getBalance(
      alice.address
    );
    const bobEthBalanceAfter = await ethers.provider.getBalance(bob.address);
    const carolEthBalanceAfter = await ethers.provider.getBalance(
      carol.address
    );
    const davidEthBalanceAfter = await ethers.provider.getBalance(
      david.address
    );

    // Checks

    // Nobody got paid any ETH
    expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(0);
    expect(carolEthBalanceAfter.sub(carolEthBalanceBefore)).to.eq(0);
    expect(davidEthBalanceAfter.sub(davidEthBalanceBefore)).to.eq(0);

    // Alice still has the NFT
    expect(await erc721.ownerOf(listing.nft.id)).to.eq(alice.address);

    // Bob got refunded all provided ETH
    expect(bobEthBalanceBefore.sub(bobEthBalanceAfter).sub(ethPaidOnGas)).to.eq(
      0
    );

    // Router is stateless
    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
    expect(await ethers.provider.getBalance(uniswapV3Market.address)).to.eq(0);
  });

  it("[Seaport] Fill ERC20 listing with ETH", async () => {
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
        market: uniswapV3Market.address,
        data: uniswapV3Market.interface.encodeFunctionData("ethToExactOutput", [
          {
            tokenIn: Sdk.Common.Addresses.Weth[chainId],
            tokenOut: Sdk.Common.Addresses.Usdc[chainId],
            fee: 500,
            recipient: seaportMarket.address,
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
        market: seaportMarket.address,
        data: seaportMarket.interface.encodeFunctionData("acceptERC20Listing", [
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

    const erc20 = new Sdk.Common.Helpers.Erc20(
      ethers.provider,
      Sdk.Common.Addresses.Usdc[chainId]
    );

    const aliceUsdcBalanceBefore = await erc20.getBalance(alice.address);

    // Execute

    await router.connect(bob).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b)),
    });

    // Fetch post-state

    const aliceUsdcBalanceAfter = await erc20.getBalance(alice.address);

    // Checks

    // Alice got the USDC
    expect(aliceUsdcBalanceAfter.sub(aliceUsdcBalanceBefore)).to.eq(
      listing.price
    );

    // Bob got the NFT
    expect(await erc721.ownerOf(listing.nft.id)).to.eq(bob.address);

    // Router is stateless
    expect(await erc20.getBalance(router.address)).to.eq(0);
    expect(await erc20.getBalance(seaportMarket.address)).to.eq(0);
    expect(await erc20.getBalance(uniswapV3Market.address)).to.eq(0);
  });

  it("[Seaport] Fill ERC20 listing approval-less", async () => {
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
      receiver: seaportMarket.address,
      paymentToken: listing.paymentToken!,
      amount: listing.price,
    };
    await setupSeaportTips([tip]);

    // Prepare executions

    const executions: ExecutionInfo[] = [
      // 1. Swap ETH for USDC and send it to Bob (for testing purposes only)
      {
        market: uniswapV3Market.address,
        data: uniswapV3Market.interface.encodeFunctionData("ethToExactOutput", [
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
        market: seaportMarket.address,
        data: seaportMarket.interface.encodeFunctionData("matchOrders", [
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
        market: seaportMarket.address,
        data: seaportMarket.interface.encodeFunctionData("acceptERC20Listing", [
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

    const erc20 = new Sdk.Common.Helpers.Erc20(
      ethers.provider,
      listing.paymentToken!
    );

    const aliceUsdcBalanceBefore = await erc20.getBalance(alice.address);

    // Execute

    await router.connect(bob).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b)),
      gasLimit: 1000000,
    });

    // Fetch post-state

    const aliceUsdcBalanceAfter = await erc20.getBalance(alice.address);

    // Checks

    // Alice got the USDC
    expect(aliceUsdcBalanceAfter.sub(aliceUsdcBalanceBefore)).to.eq(
      listing.price
    );

    // Bob got the NFT
    expect(await erc721.ownerOf(listing.nft.id)).to.eq(bob.address);

    // Router is stateless
    expect(await erc20.getBalance(router.address)).to.eq(0);
    expect(await erc20.getBalance(seaportMarket.address)).to.eq(0);
    expect(await erc20.getBalance(uniswapV3Market.address)).to.eq(0);
  });

  // it("Seaport - fill single ERC721 listing", async () => {
  //   const listing: SeaportListing = {
  //     seller: alice,
  //     token: {
  //       kind: "erc721",
  //       contract: erc721,
  //       id: 9999,
  //     },
  //     price: parseEther("7.63728283"),
  //     orderFee: parseEther("0.001"),
  //   };
  //   await setupSeaportOrders([listing]);

  //   // Fill order

  //   const aliceEthBalanceBefore = await alice.getBalance();
  //   const bobEthBalanceBefore = await bob.getBalance();
  //   const carolEthBalanceBefore = await carol.getBalance();

  //   const totalPrice = listing.price;
  //   const feeBps = 100;

  //   const ethPaidOnGas = await router
  //     .connect(bob)
  //     .fillSingle(
  //       {
  //         market: seaportMarket.address,
  //         data: seaportMarket.interface.encodeFunctionData("buySingle", [
  //           {
  //             parameters: {
  //               ...listing.order!.params,
  //               totalOriginalConsiderationItems:
  //                 listing.order!.params.consideration.length,
  //             },
  //             numerator: 1,
  //             denominator: 1,
  //             signature: listing.order!.params.signature,
  //             extraData: "0x",
  //           },
  //           bob.address,
  //           true,
  //         ]),
  //         value: totalPrice,
  //       },
  //       {
  //         recipient: carol.address,
  //         bps: feeBps,
  //       },
  //       {
  //         value: totalPrice.add(
  //           // Anything above the fee-on-top should get refunded
  //           parseEther("0.5")
  //         ),
  //       }
  //     )
  //     .then((tx: any) => tx.wait())
  //     .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

  //   const aliceEthBalanceAfter = await alice.getBalance();
  //   const bobEthBalanceAfter = await bob.getBalance();
  //   const carolEthBalanceAfter = await carol.getBalance();

  //   // Checks

  //   expect(await listing.token.contract.ownerOf(listing.token.id)).to.eq(
  //     bob.address
  //   );
  //   expect(bobEthBalanceBefore.sub(bobEthBalanceAfter).sub(ethPaidOnGas)).to.eq(
  //     totalPrice.add(totalPrice.mul(feeBps).div(10000))
  //   );
  //   expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(
  //     totalPrice.sub(listing.orderFee)
  //   );
  //   expect(carolEthBalanceAfter.sub(carolEthBalanceBefore)).to.eq(
  //     totalPrice.mul(feeBps).div(10000)
  //   );

  //   expect(await ethers.provider.getBalance(router.address)).to.eq(0);
  //   expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  // });

  // it("Seaport - fill single ERC721 listing with skipped reverts", async () => {
  //   const listing: SeaportListing = {
  //     seller: alice,
  //     token: {
  //       kind: "erc721",
  //       contract: erc721,
  //       id: 9999,
  //     },
  //     price: parseEther("7.63728283"),
  //     orderFee: parseEther("0.001"),
  //     isCancelled: true,
  //   };
  //   await setupSeaportOrders([listing]);

  //   // Fill order

  //   const totalPrice = listing.price;
  //   const feeBps = 100;

  //   const getEthPaidOnGas = async (revertIfIncomplete: boolean) =>
  //     router
  //       .connect(bob)
  //       .fillSingle(
  //         {
  //           market: seaportMarket.address,
  //           data: seaportMarket.interface.encodeFunctionData("buySingle", [
  //             {
  //               parameters: {
  //                 ...listing.order!.params,
  //                 totalOriginalConsiderationItems:
  //                   listing.order!.params.consideration.length,
  //               },
  //               numerator: 1,
  //               denominator: 1,
  //               signature: listing.order!.params.signature,
  //               extraData: "0x",
  //             },
  //             bob.address,
  //             revertIfIncomplete,
  //           ]),
  //           value: totalPrice,
  //         },
  //         {
  //           recipient: carol.address,
  //           bps: feeBps,
  //         },
  //         {
  //           value: totalPrice.add(
  //             // Anything above the fee-on-top should get refunded
  //             parseEther("0.5")
  //           ),
  //         }
  //       )
  //       .then((tx: any) => tx.wait())
  //       .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

  //   // Filling will fail if `revertIfIncomplete` is enabled
  //   await expect(getEthPaidOnGas(true)).to.be.revertedWith(
  //     "reverted with custom error 'UnsuccessfulFill()'"
  //   );

  //   const aliceEthBalanceBefore = await alice.getBalance();
  //   const bobEthBalanceBefore = await bob.getBalance();
  //   const carolEthBalanceBefore = await carol.getBalance();

  //   const ethPaidOnGas = await getEthPaidOnGas(false);

  //   const aliceEthBalanceAfter = await alice.getBalance();
  //   const bobEthBalanceAfter = await bob.getBalance();
  //   const carolEthBalanceAfter = await carol.getBalance();

  //   // Checks

  //   expect(await listing.token.contract.ownerOf(listing.token.id)).to.eq(
  //     alice.address
  //   );
  //   expect(bobEthBalanceBefore.sub(bobEthBalanceAfter).sub(ethPaidOnGas)).to.eq(
  //     0
  //   );
  //   expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(0);
  //   expect(carolEthBalanceAfter.sub(carolEthBalanceBefore)).to.eq(0);

  //   expect(await ethers.provider.getBalance(router.address)).to.eq(0);
  //   expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  // });

  // it("Seaport - fill multiple ERC721 listings", async () => {
  //   const listings: SeaportListing[] = [
  //     {
  //       seller: alice,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 10,
  //       },
  //       price: parseEther("0.563"),
  //       orderFee: parseEther("0.00234"),
  //     },
  //     {
  //       seller: alice,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 99,
  //       },
  //       price: parseEther("0.001"),
  //       orderFee: parseEther("0.000000657"),
  //     },
  //     {
  //       seller: bob,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 1000,
  //       },
  //       price: parseEther("0.3887"),
  //       orderFee: parseEther("0.04211425"),
  //     },
  //     {
  //       seller: bob,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 6748,
  //       },
  //       price: parseEther("3.2855836"),
  //       orderFee: parseEther("0.1425365273"),
  //     },
  //   ];
  //   await setupSeaportOrders(listings);

  //   // Fill order

  //   const aliceEthBalanceBefore = await alice.getBalance();
  //   const bobEthBalanceBefore = await bob.getBalance();
  //   const carolEthBalanceBefore = await carol.getBalance();
  //   const davidEthBalanceBefore = await david.getBalance();

  //   const totalPrice = listings
  //     .map(({ price }) => price)
  //     .reduce((a, b) => a.add(b));
  //   const feeBps = 100;

  //   const ethPaidOnGas = await router
  //     .connect(carol)
  //     .fillSingle(
  //       {
  //         market: seaportMarket.address,
  //         data: seaportMarket.interface.encodeFunctionData("buyMultiple", [
  //           listings.map(({ order }) => ({
  //             parameters: {
  //               ...order!.params,
  //               totalOriginalConsiderationItems:
  //                 order!.params.consideration.length,
  //             },
  //             numerator: 1,
  //             denominator: 1,
  //             signature: order!.params.signature,
  //             extraData: "0x",
  //           })),
  //           listings
  //             .map(({ order }, i) =>
  //               order!.params.offer.map((_, j) => ({
  //                 orderIndex: i,
  //                 itemIndex: j,
  //               }))
  //             )
  //             .flat()
  //             .map((x) => [x]),
  //           listings
  //             .map(({ order }, i) =>
  //               order!.params.consideration.map((_, j) => ({
  //                 orderIndex: i,
  //                 itemIndex: j,
  //               }))
  //             )
  //             .flat()
  //             .map((x) => [x]),
  //           carol.address,
  //           true,
  //         ]),
  //         value: totalPrice,
  //       },
  //       {
  //         recipient: david.address,
  //         bps: feeBps,
  //       },
  //       {
  //         value: totalPrice.add(
  //           // Anything above the fee-on-top should get refunded
  //           parseEther("1")
  //         ),
  //       }
  //     )
  //     .then((tx: any) => tx.wait())
  //     .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

  //   const aliceEthBalanceAfter = await alice.getBalance();
  //   const bobEthBalanceAfter = await bob.getBalance();
  //   const carolEthBalanceAfter = await carol.getBalance();
  //   const davidEthBalanceAfter = await david.getBalance();

  //   // Checks

  //   for (const { token } of listings) {
  //     expect(await token.contract.ownerOf(token.id)).to.eq(carol.address);
  //   }

  //   expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(
  //     listings
  //       .filter(({ seller }) => seller.address === alice.address)
  //       .map(({ price, orderFee }) => price.sub(orderFee))
  //       .reduce((a, b) => a.add(b))
  //   );
  //   expect(bobEthBalanceAfter.sub(bobEthBalanceBefore)).to.eq(
  //     listings
  //       .filter(({ seller }) => seller.address === bob.address)
  //       .map(({ price, orderFee }) => price.sub(orderFee))
  //       .reduce((a, b) => a.add(b))
  //   );
  //   expect(davidEthBalanceAfter.sub(davidEthBalanceBefore)).to.eq(
  //     listings
  //       .map(({ price }) => price.mul(feeBps).div(10000))
  //       .reduce((a, b) => a.add(b))
  //   );
  //   expect(
  //     carolEthBalanceBefore.sub(carolEthBalanceAfter).sub(ethPaidOnGas)
  //   ).to.eq(totalPrice.add(totalPrice.mul(feeBps).div(10000)));

  //   expect(await ethers.provider.getBalance(router.address)).to.eq(0);
  //   expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  // });

  // it("Seaport - fill multiple ERC721 listings with skipped reverts", async () => {
  //   const listings: SeaportListing[] = [
  //     {
  //       seller: alice,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 10,
  //       },
  //       price: parseEther("0.563"),
  //       orderFee: parseEther("0.00234"),
  //       isCancelled: true,
  //     },
  //     {
  //       seller: alice,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 99,
  //       },
  //       price: parseEther("0.001"),
  //       orderFee: parseEther("0.000000657"),
  //     },
  //     {
  //       seller: bob,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 1000,
  //       },
  //       price: parseEther("0.3887"),
  //       orderFee: parseEther("0.04211425"),
  //     },
  //     {
  //       seller: bob,
  //       token: {
  //         kind: "erc721",
  //         contract: erc721,
  //         id: 6748,
  //       },
  //       price: parseEther("3.2855836"),
  //       isCancelled: true,
  //       orderFee: parseEther("0.1425365273"),
  //     },
  //   ];
  //   await setupSeaportOrders(listings);

  //   // Fill order

  //   const totalPrice = listings
  //     .map(({ price }) => price)
  //     .reduce((a, b) => a.add(b));
  //   const feeBps = 100;

  //   const getEthPaidOnGas = async (revertIfIncomplete: boolean) =>
  //     router
  //       .connect(carol)
  //       .fillSingle(
  //         {
  //           market: seaportMarket.address,
  //           data: seaportMarket.interface.encodeFunctionData("buyMultiple", [
  //             listings.map(({ order }) => ({
  //               parameters: {
  //                 ...order!.params,
  //                 totalOriginalConsiderationItems:
  //                   order!.params.consideration.length,
  //               },
  //               numerator: 1,
  //               denominator: 1,
  //               signature: order!.params.signature,
  //               extraData: "0x",
  //             })),
  //             listings
  //               .map(({ order }, i) =>
  //                 order!.params.offer.map((_, j) => ({
  //                   orderIndex: i,
  //                   itemIndex: j,
  //                 }))
  //               )
  //               .flat()
  //               .map((x) => [x]),
  //             listings
  //               .map(({ order }, i) =>
  //                 order!.params.consideration.map((_, j) => ({
  //                   orderIndex: i,
  //                   itemIndex: j,
  //                 }))
  //               )
  //               .flat()
  //               .map((x) => [x]),
  //             carol.address,
  //             revertIfIncomplete,
  //           ]),
  //           value: totalPrice,
  //         },
  //         {
  //           recipient: david.address,
  //           bps: feeBps,
  //         },
  //         {
  //           value: totalPrice.add(
  //             // Anything above the fee-on-top should get refunded
  //             parseEther("1")
  //           ),
  //         }
  //       )
  //       .then((tx: any) => tx.wait())
  //       .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

  //   // Filling will fail if `revertIfIncomplete` is enabled
  //   await expect(getEthPaidOnGas(true)).to.be.revertedWith(
  //     "reverted with custom error 'UnsuccessfulFill()'"
  //   );

  //   const aliceEthBalanceBefore = await alice.getBalance();
  //   const bobEthBalanceBefore = await bob.getBalance();
  //   const carolEthBalanceBefore = await carol.getBalance();
  //   const davidEthBalanceBefore = await david.getBalance();

  //   const ethPaidOnGas = await getEthPaidOnGas(false);

  //   const aliceEthBalanceAfter = await alice.getBalance();
  //   const bobEthBalanceAfter = await bob.getBalance();
  //   const carolEthBalanceAfter = await carol.getBalance();
  //   const davidEthBalanceAfter = await david.getBalance();

  //   // Checks

  //   for (const { seller, token, isCancelled } of listings) {
  //     if (!isCancelled) {
  //       expect(await token.contract.ownerOf(token.id)).to.eq(carol.address);
  //     } else {
  //       expect(await token.contract.ownerOf(token.id)).to.eq(seller.address);
  //     }
  //   }

  //   expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(
  //     listings
  //       .filter(
  //         ({ seller, isCancelled }) =>
  //           seller.address === alice.address && !isCancelled
  //       )
  //       .map(({ price, orderFee }) => price.sub(orderFee))
  //       .reduce((a, b) => a.add(b))
  //   );
  //   expect(bobEthBalanceAfter.sub(bobEthBalanceBefore)).to.eq(
  //     listings
  //       .filter(
  //         ({ seller, isCancelled }) =>
  //           seller.address === bob.address && !isCancelled
  //       )
  //       .map(({ price, orderFee }) => price.sub(orderFee))
  //       .reduce((a, b) => a.add(b))
  //   );
  //   expect(davidEthBalanceAfter.sub(davidEthBalanceBefore)).to.eq(
  //     listings
  //       .filter(({ isCancelled }) => !isCancelled)
  //       .map(({ price }) => price.mul(feeBps).div(10000))
  //       .reduce((a, b) => a.add(b))
  //   );

  //   const totalPriceFilled = listings
  //     .filter(({ isCancelled }) => !isCancelled)
  //     .map(({ price }) => price)
  //     .reduce((a, b) => a.add(b));
  //   expect(
  //     carolEthBalanceBefore.sub(carolEthBalanceAfter).sub(ethPaidOnGas)
  //   ).to.eq(totalPriceFilled.add(totalPriceFilled.mul(feeBps).div(10000)));

  //   expect(await ethers.provider.getBalance(router.address)).to.eq(0);
  //   expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  // });
});
