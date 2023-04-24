import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as Common from "@reservoir0x/sdk/src/common";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

import * as Flow from "@reservoir0x/sdk/src/flow";

import {
  getChainId,
  setupNFTs,
  reset,
  getCurrentTimestamp,
  bn,
} from "../../../utils";
import { BigNumberish } from "ethers";

describe("Flow - Single Specific Token ERC721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("Build and take sell order - Complication V1", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1").toString();

    const tokenId = "1";

    await erc721.connect(seller).mint(tokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    await nft.approve(seller, Flow.Addresses.Exchange[chainId]);

    const exchange = new Flow.Exchange(chainId);

    const builder = new Flow.Builders.SingleToken(chainId);

    const sellOrder = builder.build({
      isSellOrder: true,
      collection: erc721.address,
      signer: seller.address,
      startPrice: price,
      endPrice: price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: "1",
      maxGasPrice: "100000000000",
      currency: Common.Addresses.Eth[chainId],
      tokenId,
      numTokens: 1,
      complication: Flow.Addresses.Complication[chainId],
    });

    await sellOrder.sign(seller);
    await sellOrder.checkFillability(ethers.provider);

    const buyerEthBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );

    const ownerBefore = await nft.getOwner(tokenId);
    expect(ownerBefore).to.eq(seller.address);

    await exchange.takeMultipleOneOrders(buyer, [sellOrder]);

    const buyerEthBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const ownerAfter = await nft.getOwner(tokenId);

    const protocolFeeBps: BigNumberish = await exchange.contract
      .connect(seller)
      .protocolFeeBps();
    const fees = bn(price).mul(protocolFeeBps).div(10000);

    expect(buyerEthBalanceBefore.sub(buyerEthBalanceAfter)).to.be.gte(price);
    expect(sellerEthBalanceAfter).to.eq(
      sellerEthBalanceBefore.add(price).sub(fees)
    );
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and take offer order - Complication V1", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1").toString();

    const tokenId = "1";

    await erc721.connect(seller).mint(tokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    await nft.approve(seller, Flow.Addresses.Exchange[chainId]);

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);
    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Flow.Addresses.Exchange[chainId]);

    const exchange = new Flow.Exchange(chainId);

    const builder = new Flow.Builders.SingleToken(chainId);

    const offerOrder = builder.build({
      isSellOrder: false,
      collection: erc721.address,
      signer: buyer.address,
      startPrice: price,
      endPrice: price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: "1",
      maxGasPrice: "100000000000",
      currency: Common.Addresses.Weth[chainId],
      tokenId,
      numTokens: 1,
      complication: Flow.Addresses.Complication[chainId],
    });

    await offerOrder.sign(buyer);
    await offerOrder.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerWethBalanceBefore = await weth.getBalance(seller.address);

    const ownerBefore = await nft.getOwner(tokenId);
    expect(ownerBefore).to.eq(seller.address);

    await exchange.takeMultipleOneOrders(seller, [offerOrder]);

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(tokenId);

    const protocolFeeBps: BigNumberish = await exchange.contract
      .connect(seller)
      .protocolFeeBps();
    const fees = bn(price).mul(protocolFeeBps).div(10000);

    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.be.gte(price);
    expect(sellerWethBalanceAfter).to.eq(
      sellerWethBalanceBefore.add(price).sub(fees)
    );
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and take sell order - Complication V2", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1").toString();

    const tokenId = "1";

    await erc721.connect(seller).mint(tokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    await nft.approve(seller, Flow.Addresses.Exchange[chainId]);

    const exchange = new Flow.Exchange(chainId);

    const builder = new Flow.Builders.SingleToken(chainId);

    const sellOrder = builder.build({
      isSellOrder: true,
      collection: erc721.address,
      signer: seller.address,
      startPrice: price,
      endPrice: price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: "1",
      maxGasPrice: "100000000000",
      currency: Common.Addresses.Eth[chainId],
      tokenId,
      numTokens: 1,
      complication: Flow.Addresses.ComplicationV2[chainId],
    });

    await sellOrder.sign(seller);
    await sellOrder.checkFillability(ethers.provider);

    const buyerEthBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );

    const ownerBefore = await nft.getOwner(tokenId);
    expect(ownerBefore).to.eq(seller.address);

    await exchange.takeMultipleOneOrders(buyer, [sellOrder]);

    const buyerEthBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const ownerAfter = await nft.getOwner(tokenId);

    const protocolFeeBps: BigNumberish = await exchange.contract
      .connect(seller)
      .protocolFeeBps();
    const fees = bn(price).mul(protocolFeeBps).div(10000);

    expect(buyerEthBalanceBefore.sub(buyerEthBalanceAfter)).to.be.gte(price);
    expect(sellerEthBalanceAfter).to.eq(
      sellerEthBalanceBefore.add(price).sub(fees)
    );
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and take offer order - Complication V2", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1").toString();

    const tokenId = "1";

    await erc721.connect(seller).mint(tokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    await nft.approve(seller, Flow.Addresses.Exchange[chainId]);

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);
    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Flow.Addresses.Exchange[chainId]);

    const exchange = new Flow.Exchange(chainId);

    const builder = new Flow.Builders.SingleToken(chainId);

    const offerOrder = builder.build({
      isSellOrder: false,
      collection: erc721.address,
      signer: buyer.address,
      startPrice: price,
      endPrice: price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: "1",
      maxGasPrice: "100000000000",
      currency: Common.Addresses.Weth[chainId],
      tokenId,
      numTokens: 1,
      complication: Flow.Addresses.ComplicationV2[chainId],
    });

    await offerOrder.sign(buyer);
    await offerOrder.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerWethBalanceBefore = await weth.getBalance(seller.address);

    const ownerBefore = await nft.getOwner(tokenId);
    expect(ownerBefore).to.eq(seller.address);

    await exchange.takeMultipleOneOrders(seller, [offerOrder]);

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(tokenId);

    const protocolFeeBps: BigNumberish = await exchange.contract
      .connect(seller)
      .protocolFeeBps();
    const fees = bn(price).mul(protocolFeeBps).div(10000);

    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.be.gte(price);
    expect(sellerWethBalanceAfter).to.eq(
      sellerWethBalanceBefore.add(price).sub(fees)
    );
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Take bulk signature orders - Complication V2", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1").toString();

    const tokenId1 = "1";
    const tokenId2 = "2";

    await erc721.connect(seller).mint(tokenId1);
    await erc721.connect(seller).mint(tokenId2);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    await nft.approve(seller, Flow.Addresses.Exchange[chainId]);

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);
    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Flow.Addresses.Exchange[chainId]);

    const exchange = new Flow.Exchange(chainId);

    const builder = new Flow.Builders.SingleToken(chainId);

    const offerOrder1 = builder.build({
      isSellOrder: false,
      collection: erc721.address,
      signer: buyer.address,
      startPrice: price,
      endPrice: price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: "1",
      maxGasPrice: "100000000000",
      currency: Common.Addresses.Weth[chainId],
      tokenId: tokenId1,
      numTokens: 1,
      complication: Flow.Addresses.ComplicationV2[chainId],
    });

    const offerOrder2 = builder.build({
      isSellOrder: false,
      collection: erc721.address,
      signer: buyer.address,
      startPrice: price,
      endPrice: price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: "2",
      maxGasPrice: "100000000000",
      currency: Common.Addresses.Weth[chainId],
      tokenId: tokenId2,
      numTokens: 1,
      complication: Flow.Addresses.ComplicationV2[chainId],
    });

    await exchange.bulkSign(buyer, [offerOrder1, offerOrder2]);

    await offerOrder1.checkFillability(ethers.provider);
    await offerOrder2.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerWethBalanceBefore = await weth.getBalance(seller.address);

    const ownerBefore = await nft.getOwner(tokenId1);
    expect(ownerBefore).to.eq(seller.address);

    await exchange.takeMultipleOneOrders(seller, [offerOrder1]);

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(tokenId1);

    const protocolFeeBps: BigNumberish = await exchange.contract
      .connect(seller)
      .protocolFeeBps();
    const fees = bn(price).mul(protocolFeeBps).div(10000);

    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.be.gte(price);
    expect(sellerWethBalanceAfter).to.eq(
      sellerWethBalanceBefore.add(price).sub(fees)
    );
    expect(ownerAfter).to.eq(buyer.address);
  });
});
