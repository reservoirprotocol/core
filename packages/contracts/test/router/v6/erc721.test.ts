import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getChainId, getCurrentTimestamp, reset, setupNFTs } from "../../utils";

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
  let zeroExV4Market: Contract;
  let seaportMarket: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, david, emilio] = await ethers.getSigners();

    ({ erc721, erc1155 } = await setupNFTs(deployer));

    router = (await ethers
      .getContractFactory("ReservoirV6_0_0", deployer)
      .then((factory) => factory.deploy())) as any;
    zeroExV4Market = (await ethers
      .getContractFactory("ZeroExV4Market", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    seaportMarket = (await ethers
      .getContractFactory("SeaportMarket", deployer)
      .then((factory) => factory.deploy(router.address))) as any;

    await router.registerMarket(seaportMarket.address);
    await router.registerMarket(zeroExV4Market.address);
  });

  afterEach(reset);

  it("Seaport - fill single ERC721 listing", async () => {
    const listings: {
      seller: SignerWithAddress;
      tokenId: number;
      price: BigNumber;
      orderFee: BigNumber;
      order?: Sdk.Seaport.Order;
    }[] = [
      {
        seller: alice,
        tokenId: 9999,
        price: parseEther("7.63728283"),
        orderFee: parseEther("0.001"),
      },
    ];

    // Prepare orders

    for (const listing of listings) {
      const { seller, tokenId, price, orderFee } = listing;

      await erc721.connect(seller).mint(tokenId);
      await erc721
        .connect(seller)
        .setApprovalForAll(Sdk.Seaport.Addresses.Exchange[chainId], true);

      const builder = new Sdk.Seaport.Builders.SingleToken(chainId);
      const order = builder.build({
        side: "sell",
        tokenKind: "erc721",
        offerer: seller.address,
        contract: erc721.address,
        tokenId: tokenId,
        paymentToken: Sdk.Common.Addresses.Eth[chainId],
        price: price.sub(orderFee),
        fees: [
          {
            recipient: emilio.address,
            amount: orderFee,
          },
        ],
        counter: 0,
        startTime: await getCurrentTimestamp(ethers.provider),
        endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      });
      await order.sign(seller);

      listing.order = order;
    }

    // Fill order

    const aliceEthBalanceBefore = await alice.getBalance();
    const bobEthBalanceBefore = await bob.getBalance();
    const carolEthBalanceBefore = await carol.getBalance();

    const totalPrice = listings
      .map(({ price }) => price)
      .reduce((a, b) => a.add(b));
    const feeBps = 100;

    const ethPaidOnGas = await router
      .connect(bob)
      .fillSingle(
        {
          market: seaportMarket.address,
          data: seaportMarket.interface.encodeFunctionData("buySingle", [
            {
              parameters: {
                ...listings[0].order!.params,
                totalOriginalConsiderationItems:
                  listings[0].order!.params.consideration.length,
              },
              numerator: 1,
              denominator: 1,
              signature: listings[0].order!.params.signature,
              extraData: "0x",
            },
            bob.address,
            true,
          ]),
          value: totalPrice,
        },
        {
          recipient: carol.address,
          bps: feeBps,
        },
        {
          value: totalPrice.add(
            // Anything above the fee-on-top should get refunded
            parseEther("0.5")
          ),
        }
      )
      .then((tx: any) => tx.wait())
      .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

    const aliceEthBalanceAfter = await alice.getBalance();
    const bobEthBalanceAfter = await bob.getBalance();
    const carolEthBalanceAfter = await carol.getBalance();

    // Checks

    expect(await erc721.ownerOf(listings[0].tokenId)).to.eq(bob.address);
    expect(bobEthBalanceBefore.sub(bobEthBalanceAfter).sub(ethPaidOnGas)).to.eq(
      totalPrice.add(totalPrice.mul(feeBps).div(10000))
    );
    expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(
      totalPrice.sub(listings[0].orderFee)
    );
    expect(carolEthBalanceAfter.sub(carolEthBalanceBefore)).to.eq(
      totalPrice.mul(feeBps).div(10000)
    );

    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  });

  it("Seaport - fill single ERC721 listing with skipped reverts", async () => {
    const listings: {
      seller: SignerWithAddress;
      tokenId: number;
      price: BigNumber;
      orderFee: BigNumber;
      isCancelled?: boolean;
      order?: Sdk.Seaport.Order;
    }[] = [
      {
        seller: alice,
        tokenId: 9999,
        price: parseEther("7.63728283"),
        orderFee: parseEther("0.001"),
      },
    ];

    // Prepare orders

    for (const listing of listings) {
      const { seller, tokenId, price, orderFee } = listing;

      await erc721.connect(seller).mint(tokenId);
      await erc721
        .connect(seller)
        .setApprovalForAll(Sdk.Seaport.Addresses.Exchange[chainId], true);

      const builder = new Sdk.Seaport.Builders.SingleToken(chainId);
      const order = builder.build({
        side: "sell",
        tokenKind: "erc721",
        offerer: seller.address,
        contract: erc721.address,
        tokenId: tokenId,
        paymentToken: Sdk.Common.Addresses.Eth[chainId],
        price: price.sub(orderFee),
        fees: [
          {
            recipient: emilio.address,
            amount: orderFee,
          },
        ],
        counter: 0,
        startTime: await getCurrentTimestamp(ethers.provider),
        endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      });
      await order.sign(seller);

      listing.order = order;
    }

    // Cancel the order
    {
      const exchange = new Sdk.Seaport.Exchange(chainId);

      await exchange.cancelOrder(alice, listings[0].order!);
      listings[0].isCancelled = true;
    }

    // Fill order

    const totalPrice = listings
      .map(({ price }) => price)
      .reduce((a, b) => a.add(b));
    const feeBps = 100;

    const getEthPaidOnGas = async (revertIfIncomplete: boolean) =>
      router
        .connect(bob)
        .fillSingle(
          {
            market: seaportMarket.address,
            data: seaportMarket.interface.encodeFunctionData("buySingle", [
              {
                parameters: {
                  ...listings[0].order!.params,
                  totalOriginalConsiderationItems:
                    listings[0].order!.params.consideration.length,
                },
                numerator: 1,
                denominator: 1,
                signature: listings[0].order!.params.signature,
                extraData: "0x",
              },
              bob.address,
              revertIfIncomplete,
            ]),
            value: totalPrice,
          },
          {
            recipient: carol.address,
            bps: feeBps,
          },
          {
            value: totalPrice.add(
              // Anything above the fee-on-top should get refunded
              parseEther("0.5")
            ),
          }
        )
        .then((tx: any) => tx.wait())
        .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

    // Filling will fail if `revertIfIncomplete` is enabled
    await expect(getEthPaidOnGas(true)).to.be.revertedWith(
      "reverted with custom error 'UnsuccessfulFill()'"
    );

    const aliceEthBalanceBefore = await alice.getBalance();
    const bobEthBalanceBefore = await bob.getBalance();
    const carolEthBalanceBefore = await carol.getBalance();

    const ethPaidOnGas = await getEthPaidOnGas(false);

    const aliceEthBalanceAfter = await alice.getBalance();
    const bobEthBalanceAfter = await bob.getBalance();
    const carolEthBalanceAfter = await carol.getBalance();

    // Checks

    expect(await erc721.ownerOf(listings[0].tokenId)).to.eq(alice.address);
    expect(bobEthBalanceBefore.sub(bobEthBalanceAfter).sub(ethPaidOnGas)).to.eq(
      0
    );
    expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(0);
    expect(carolEthBalanceAfter.sub(carolEthBalanceBefore)).to.eq(0);

    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  });

  it("Seaport - fill multiple ERC721 listings", async () => {
    const listings: {
      seller: SignerWithAddress;
      tokenId: number;
      price: BigNumber;
      orderFee: BigNumber;
      order?: Sdk.Seaport.Order;
    }[] = [
      {
        seller: alice,
        tokenId: 10,
        price: parseEther("0.563"),
        orderFee: parseEther("0.00234"),
      },
      {
        seller: alice,
        tokenId: 99,
        price: parseEther("0.001"),
        orderFee: parseEther("0.000000657"),
      },
      {
        seller: bob,
        tokenId: 145,
        price: parseEther("0.3887"),
        orderFee: parseEther("0.04211425"),
      },
      {
        seller: bob,
        tokenId: 5647,
        price: parseEther("3.2855836"),
        orderFee: parseEther("0.1425365273"),
      },
    ];

    // Prepare orders

    for (const listing of listings) {
      const { seller, tokenId, price, orderFee } = listing;

      await erc721.connect(seller).mint(tokenId);
      await erc721
        .connect(seller)
        .setApprovalForAll(Sdk.Seaport.Addresses.Exchange[chainId], true);

      const builder = new Sdk.Seaport.Builders.SingleToken(chainId);
      const order = builder.build({
        side: "sell",
        tokenKind: "erc721",
        offerer: seller.address,
        contract: erc721.address,
        tokenId: tokenId,
        paymentToken: Sdk.Common.Addresses.Eth[chainId],
        price: price.sub(orderFee),
        fees: [
          {
            recipient: emilio.address,
            amount: orderFee,
          },
        ],
        counter: 0,
        startTime: await getCurrentTimestamp(ethers.provider),
        endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      });
      await order.sign(seller);

      listing.order = order;
    }

    // Fill order

    const aliceEthBalanceBefore = await alice.getBalance();
    const bobEthBalanceBefore = await bob.getBalance();
    const carolEthBalanceBefore = await carol.getBalance();
    const davidEthBalanceBefore = await david.getBalance();

    const totalPrice = listings
      .map(({ price }) => price)
      .reduce((a, b) => a.add(b));
    const feeBps = 100;

    const ethPaidOnGas = await router
      .connect(carol)
      .fillSingle(
        {
          market: seaportMarket.address,
          data: seaportMarket.interface.encodeFunctionData("buyMultiple", [
            listings.map(({ order }) => ({
              parameters: {
                ...order!.params,
                totalOriginalConsiderationItems:
                  order!.params.consideration.length,
              },
              numerator: 1,
              denominator: 1,
              signature: order!.params.signature,
              extraData: "0x",
            })),
            listings
              .map(({ order }, i) =>
                order!.params.offer.map((_, j) => ({
                  orderIndex: i,
                  itemIndex: j,
                }))
              )
              .flat()
              .map((x) => [x]),
            listings
              .map(({ order }, i) =>
                order!.params.consideration.map((_, j) => ({
                  orderIndex: i,
                  itemIndex: j,
                }))
              )
              .flat()
              .map((x) => [x]),
            carol.address,
            true,
          ]),
          value: totalPrice,
        },
        {
          recipient: david.address,
          bps: feeBps,
        },
        {
          value: totalPrice.add(
            // Anything above the fee-on-top should get refunded
            parseEther("1")
          ),
        }
      )
      .then((tx: any) => tx.wait())
      .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

    const aliceEthBalanceAfter = await alice.getBalance();
    const bobEthBalanceAfter = await bob.getBalance();
    const carolEthBalanceAfter = await carol.getBalance();
    const davidEthBalanceAfter = await david.getBalance();

    // Checks

    for (const { tokenId } of listings) {
      expect(await erc721.ownerOf(tokenId)).to.eq(carol.address);
    }

    expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(
      listings
        .filter(({ seller }) => seller.address === alice.address)
        .map(({ price, orderFee }) => price.sub(orderFee))
        .reduce((a, b) => a.add(b))
    );
    expect(bobEthBalanceAfter.sub(bobEthBalanceBefore)).to.eq(
      listings
        .filter(({ seller }) => seller.address === bob.address)
        .map(({ price, orderFee }) => price.sub(orderFee))
        .reduce((a, b) => a.add(b))
    );
    expect(davidEthBalanceAfter.sub(davidEthBalanceBefore)).to.eq(
      listings
        .map(({ price }) => price.mul(feeBps).div(10000))
        .reduce((a, b) => a.add(b))
    );
    expect(
      carolEthBalanceBefore.sub(carolEthBalanceAfter).sub(ethPaidOnGas)
    ).to.eq(totalPrice.add(totalPrice.mul(feeBps).div(10000)));

    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  });

  it("Seaport - fill multiple ERC721 listings with skipped reverts", async () => {
    const listings: {
      seller: SignerWithAddress;
      tokenId: number;
      price: BigNumber;
      orderFee: BigNumber;
      isCancelled?: boolean;
      order?: Sdk.Seaport.Order;
    }[] = [
      {
        seller: alice,
        tokenId: 10,
        price: parseEther("0.563"),
        orderFee: parseEther("0.00234"),
      },
      {
        seller: alice,
        tokenId: 99,
        price: parseEther("0.001"),
        orderFee: parseEther("0.000000657"),
      },
      {
        seller: bob,
        tokenId: 145,
        price: parseEther("0.3887"),
        orderFee: parseEther("0.04211425"),
      },
      {
        seller: bob,
        tokenId: 5647,
        price: parseEther("3.2855836"),
        orderFee: parseEther("0.1425365273"),
      },
    ];

    // Prepare orders

    for (const listing of listings) {
      const { seller, tokenId, price, orderFee } = listing;

      await erc721.connect(seller).mint(tokenId);
      await erc721
        .connect(seller)
        .setApprovalForAll(Sdk.Seaport.Addresses.Exchange[chainId], true);

      const builder = new Sdk.Seaport.Builders.SingleToken(chainId);
      const order = builder.build({
        side: "sell",
        tokenKind: "erc721",
        offerer: seller.address,
        contract: erc721.address,
        tokenId: tokenId,
        paymentToken: Sdk.Common.Addresses.Eth[chainId],
        price: price.sub(orderFee),
        fees: [
          {
            recipient: emilio.address,
            amount: orderFee,
          },
        ],
        counter: 0,
        startTime: await getCurrentTimestamp(ethers.provider),
        endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      });
      await order.sign(seller);

      listing.order = order;
    }

    // Cancel some of the orders
    {
      const exchange = new Sdk.Seaport.Exchange(chainId);

      await exchange.cancelOrder(alice, listings[0].order!);
      listings[0].isCancelled = true;

      await exchange.cancelOrder(bob, listings[2].order!);
      listings[2].isCancelled = true;
    }

    // Fill order

    const totalPrice = listings
      .map(({ price }) => price)
      .reduce((a, b) => a.add(b));
    const feeBps = 100;

    const getEthPaidOnGas = async (revertIfIncomplete: boolean) =>
      router
        .connect(carol)
        .fillSingle(
          {
            market: seaportMarket.address,
            data: seaportMarket.interface.encodeFunctionData("buyMultiple", [
              listings.map(({ order }) => ({
                parameters: {
                  ...order!.params,
                  totalOriginalConsiderationItems:
                    order!.params.consideration.length,
                },
                numerator: 1,
                denominator: 1,
                signature: order!.params.signature,
                extraData: "0x",
              })),
              listings
                .map(({ order }, i) =>
                  order!.params.offer.map((_, j) => ({
                    orderIndex: i,
                    itemIndex: j,
                  }))
                )
                .flat()
                .map((x) => [x]),
              listings
                .map(({ order }, i) =>
                  order!.params.consideration.map((_, j) => ({
                    orderIndex: i,
                    itemIndex: j,
                  }))
                )
                .flat()
                .map((x) => [x]),
              carol.address,
              revertIfIncomplete,
            ]),
            value: totalPrice,
          },
          {
            recipient: david.address,
            bps: feeBps,
          },
          {
            value: totalPrice.add(
              // Anything above the fee-on-top should get refunded
              parseEther("1")
            ),
          }
        )
        .then((tx: any) => tx.wait())
        .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

    // Filling will fail if `revertIfIncomplete` is enabled
    await expect(getEthPaidOnGas(true)).to.be.revertedWith(
      "reverted with custom error 'UnsuccessfulFill()'"
    );

    const aliceEthBalanceBefore = await alice.getBalance();
    const bobEthBalanceBefore = await bob.getBalance();
    const carolEthBalanceBefore = await carol.getBalance();
    const davidEthBalanceBefore = await david.getBalance();

    const ethPaidOnGas = await getEthPaidOnGas(false);

    const aliceEthBalanceAfter = await alice.getBalance();
    const bobEthBalanceAfter = await bob.getBalance();
    const carolEthBalanceAfter = await carol.getBalance();
    const davidEthBalanceAfter = await david.getBalance();

    // Checks

    for (const { seller, tokenId, isCancelled } of listings) {
      if (!isCancelled) {
        expect(await erc721.ownerOf(tokenId)).to.eq(carol.address);
      } else {
        expect(await erc721.ownerOf(tokenId)).to.eq(seller.address);
      }
    }

    expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            seller.address === alice.address && !isCancelled
        )
        .map(({ price, orderFee }) => price.sub(orderFee))
        .reduce((a, b) => a.add(b))
    );
    expect(bobEthBalanceAfter.sub(bobEthBalanceBefore)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            seller.address === bob.address && !isCancelled
        )
        .map(({ price, orderFee }) => price.sub(orderFee))
        .reduce((a, b) => a.add(b))
    );
    expect(davidEthBalanceAfter.sub(davidEthBalanceBefore)).to.eq(
      listings
        .filter(({ isCancelled }) => !isCancelled)
        .map(({ price }) => price.mul(feeBps).div(10000))
        .reduce((a, b) => a.add(b))
    );

    const totalPriceFilled = listings
      .filter(({ isCancelled }) => !isCancelled)
      .map(({ price }) => price)
      .reduce((a, b) => a.add(b));
    expect(
      carolEthBalanceBefore.sub(carolEthBalanceAfter).sub(ethPaidOnGas)
    ).to.eq(totalPriceFilled.add(totalPriceFilled.mul(feeBps).div(10000)));

    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(await ethers.provider.getBalance(seaportMarket.address)).to.eq(0);
  });
});
