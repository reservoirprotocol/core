import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  ExchangeKind,
  bn,
  getChainId,
  getCurrentTimestamp,
  reset,
  setupNFTs,
  setupRouter,
} from "../utils";

describe("Router V1 - multi buy", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let referrer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let dan: SignerWithAddress;

  let erc721: Contract;
  let erc1155: Contract;
  let router: Contract;

  beforeEach(async () => {
    [deployer, referrer, alice, bob, carol, dan] = await ethers.getSigners();

    erc721 = await ethers
      .getContractFactory("MockERC721", deployer)
      .then((factory) => factory.deploy());
    erc1155 = await ethers
      .getContractFactory("MockERC1155", deployer)
      .then((factory) => factory.deploy());

    ({ erc721, erc1155 } = await setupNFTs(deployer));
    router = await setupRouter(chainId, deployer);
  });

  afterEach(reset);

  it("Fill multiple listings", async () => {
    const routerFee = 100;

    const buyer = dan;

    const data: string[] = [];
    const values: string[] = [];

    // Order 1: Wyvern V2.3
    const seller1 = alice;
    const tokenId1 = 0;
    const price1 = parseEther("1");
    const fee1 = bn(0);
    {
      // Mint erc721 to seller
      await erc721.connect(seller1).mint(tokenId1);

      // Register user proxy for the seller
      const proxyRegistry = new Sdk.WyvernV23.Helpers.ProxyRegistry(
        ethers.provider,
        chainId
      );
      await proxyRegistry.registerProxy(seller1);
      const proxy = await proxyRegistry.getProxy(seller1.address);

      // Approve the user proxy
      await erc721.connect(seller1).setApprovalForAll(proxy, true);

      const exchange = new Sdk.WyvernV23.Exchange(chainId);
      const builder = new Sdk.WyvernV23.Builders.Erc721.SingleToken.V2(chainId);

      // Build sell order
      const sellOrder = builder.build({
        maker: seller1.address,
        contract: erc721.address,
        tokenId: tokenId1,
        side: "sell",
        price: price1,
        paymentToken: Sdk.Common.Addresses.Eth[chainId],
        fee: 0,
        feeRecipient: referrer.address,
        listingTime: await getCurrentTimestamp(ethers.provider),
        nonce: await exchange.getNonce(ethers.provider, seller1.address),
      });
      await sellOrder.sign(seller1);

      // Create matching buy order
      const buyOrder = sellOrder.buildMatching(router.address, {
        nonce: await exchange.getNonce(ethers.provider, router.address),
        recipient: buyer.address,
      });
      buyOrder.params.listingTime = await getCurrentTimestamp(ethers.provider);

      await sellOrder.checkFillability(ethers.provider);

      const tx = exchange.matchTransaction(buyer.address, buyOrder, sellOrder);
      data.push(
        router.interface.encodeFunctionData("singleERC721ListingFill", [
          referrer.address,
          tx.data,
          ExchangeKind.WYVERN_V23,
          erc721.address,
          tokenId1,
          buyer.address,
          routerFee,
        ])
      );
      values.push(
        bn(tx.value!).add(bn(tx.value!).mul(routerFee).div(10000)).toString()
      );
    }

    // Order 2: LooksRare
    const seller2 = bob;
    const tokenId2 = 1;
    const price2 = parseEther("2");
    const fee2 = bn(200);
    {
      // Mint erc721 to seller
      await erc721.connect(seller2).mint(tokenId2);

      // Approve the transfer manager
      await erc721
        .connect(seller2)
        .setApprovalForAll(
          Sdk.LooksRare.Addresses.TransferManagerErc721[chainId],
          true
        );

      const exchange = new Sdk.LooksRare.Exchange(chainId);
      const builder = new Sdk.LooksRare.Builders.SingleToken(chainId);

      // Build sell order
      const sellOrder = builder.build({
        isOrderAsk: true,
        signer: seller2.address,
        collection: erc721.address,
        tokenId: tokenId2,
        price: price2,
        startTime: await getCurrentTimestamp(ethers.provider),
        endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
        nonce: await exchange.getNonce(ethers.provider, seller2.address),
      });
      await sellOrder.sign(seller2);

      // Create matching buy order
      const buyOrder = sellOrder.buildMatching(router.address);

      await sellOrder.checkFillability(ethers.provider);

      const tx = exchange.matchTransaction(buyer.address, sellOrder, buyOrder);
      data.push(
        router.interface.encodeFunctionData("singleERC721ListingFill", [
          referrer.address,
          tx.data,
          ExchangeKind.LOOKS_RARE,
          sellOrder.params.collection,
          sellOrder.params.tokenId,
          buyer.address,
          routerFee,
        ])
      );
      values.push(
        bn(tx.value!).add(bn(tx.value!).mul(routerFee).div(10000)).toString()
      );
    }

    // Order 3: ZeroEx V4
    const seller3 = carol;
    const tokenId3 = 0;
    const totalAmount3 = 9;
    const amount3 = 4;
    const price3 = parseEther("2");
    const fee3 = parseEther("0.1");
    const totalPaid3 = price3.add(fee3);
    {
      // Mint erc1155 to seller
      await erc1155.connect(seller3).mintMany(tokenId3, totalAmount3);

      // Approve the exchange
      await erc1155
        .connect(seller3)
        .setApprovalForAll(Sdk.ZeroExV4.Addresses.Exchange[chainId], true);

      const exchange = new Sdk.ZeroExV4.Exchange(chainId);
      const builder = new Sdk.ZeroExV4.Builders.SingleToken(chainId);

      // Build sell order
      const sellOrder = builder.build({
        direction: "sell",
        maker: seller3.address,
        contract: erc1155.address,
        tokenId: tokenId3,
        amount: totalAmount3,
        fees: [
          {
            recipient: deployer.address,
            amount: fee3,
          },
        ],
        price: price3,
        expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
      });
      await sellOrder.sign(seller3);

      // Create matching buy order
      const buyOrder = sellOrder.buildMatching({ amount: amount3 });

      await sellOrder.checkFillability(ethers.provider);

      const tx = exchange.matchTransaction(buyer.address, sellOrder, buyOrder);
      data.push(
        router.interface.encodeFunctionData("singleERC1155ListingFill", [
          referrer.address,
          tx.data,
          ExchangeKind.ZEROEX_V4,
          sellOrder.params.nft,
          sellOrder.params.nftId,
          amount3,
          buyer.address,
          routerFee,
        ])
      );
      values.push(
        bn(tx.value!)
          .add(bn(tx.value!).mul(routerFee).add(10001).div(10000))
          .toString()
      );
    }

    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, chainId);

    const referrerEthBalanceBefore = await referrer.getBalance();
    const seller1EthBalanceBefore = await seller1.getBalance();
    const seller2WethBalanceBefore = await weth.getBalance(seller2.address);
    const seller3EthBalanceBefore = await seller3.getBalance();
    const token1OwnerBefore = await erc721.ownerOf(tokenId1);
    const token2OwnerBefore = await erc721.ownerOf(tokenId2);
    const token3BuyerBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      tokenId3
    );
    expect(token1OwnerBefore).to.eq(seller1.address);
    expect(token2OwnerBefore).to.eq(seller2.address);
    expect(token3BuyerBalanceBefore).to.eq(0);

    await router.connect(buyer).multiListingFill(data, values, true, {
      value: values.reduce((a, b) => bn(a).add(b), bn(0)).toString(),
    });

    const referrerEthBalanceAfter = await referrer.getBalance();
    const seller1EthBalanceAfter = await seller1.getBalance();
    const seller2WethBalanceAfter = await weth.getBalance(seller2.address);
    const seller3EthBalanceAfter = await seller3.getBalance();
    const token1OwnerAfter = await erc721.ownerOf(tokenId1);
    const token2OwnerAfter = await erc721.ownerOf(tokenId2);
    const token3BuyerBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      tokenId3
    );
    expect(referrerEthBalanceAfter.sub(referrerEthBalanceBefore)).to.eq(
      price1
        .add(price2)
        .add(totalPaid3.mul(amount3).div(totalAmount3))
        .mul(routerFee)
        .add(10001)
        .div(10000)
    );
    expect(seller1EthBalanceAfter.sub(seller1EthBalanceBefore)).to.eq(
      price1.sub(price1.mul(fee1).div(10000))
    );
    expect(seller2WethBalanceAfter.sub(seller2WethBalanceBefore)).to.eq(
      price2.sub(price2.mul(fee2).div(10000))
    );
    // expect(seller3EthBalanceAfter.sub(seller3EthBalanceBefore)).to.eq(
    //   price3.mul(amount3).add(totalAmount3)
    // );
    expect(token1OwnerAfter).to.eq(buyer.address);
    expect(token2OwnerAfter).to.eq(buyer.address);
    expect(token3BuyerBalanceAfter).to.eq(amount3);

    // Router is stateless (it shouldn't keep any funds)
    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(await weth.getBalance(router.address)).to.eq(0);
  });
});
