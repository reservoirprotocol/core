import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Seaport from "@reservoir0x/sdk/src/seaport";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  getChainId,
  getCurrentTimestamp,
  reset,
  setupNFTs,
} from "../../../utils";

describe("Seaport - SingleToken Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ted: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, ted, carol] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("build and match sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 1;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the exchange
    await nft.approve(seller, Seaport.Addresses.Exchange[chainId]);

    const exchange = new Seaport.Exchange(chainId);

    const builder = new Seaport.Builders.SingleToken(chainId);

    // Build sell order
    const sellOrder = builder.build({
      side: "sell",
      tokenKind: "erc721",
      offerer: seller.address,
      contract: erc721.address,
      tokenId: soldTokenId,
      paymentToken: Common.Addresses.Eth[chainId],
      price,
      nonce: 0,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });

    // Sign the order
    await sellOrder.sign(seller);

    await sellOrder.checkFillability(ethers.provider);

    // Create matching params
    const matchParams = sellOrder.buildMatching();

    const buyerEthBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, matchParams);

    const buyerEthBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerEthBalanceBefore.sub(buyerEthBalanceAfter)).to.be.gt(price);
    expect(sellerEthBalanceAfter).to.eq(sellerEthBalanceBefore.add(price));
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("build and match sell order with fees", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const feeRecipient1 = ted;
    const fee1 = parseEther("0.025");
    const feeRecipient2 = carol;
    const fee2 = parseEther("0.05");
    const soldTokenId = 99;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the exchange
    await nft.approve(seller, Seaport.Addresses.Exchange[chainId]);

    const exchange = new Seaport.Exchange(chainId);

    const builder = new Seaport.Builders.SingleToken(chainId);

    // Build sell order
    const sellOrder = builder.build({
      side: "sell",
      tokenKind: "erc721",
      offerer: seller.address,
      contract: erc721.address,
      tokenId: soldTokenId,
      paymentToken: Common.Addresses.Eth[chainId],
      price,
      fees: [
        {
          amount: fee1,
          recipient: feeRecipient1.address,
        },
        {
          amount: fee2,
          recipient: feeRecipient2.address,
        },
      ],
      nonce: 0,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });

    // Sign the order
    await sellOrder.sign(seller);

    await sellOrder.checkFillability(ethers.provider);

    // Create matching params
    const matchParams = sellOrder.buildMatching();

    const buyerEthBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const feeRecipient1EthBalanceBefore = await ethers.provider.getBalance(
      feeRecipient1.address
    );
    const feeRecipient2EthBalanceBefore = await ethers.provider.getBalance(
      feeRecipient2.address
    );
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, matchParams);

    const buyerEthBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const feeRecipient1EthBalanceAfter = await ethers.provider.getBalance(
      feeRecipient1.address
    );
    const feeRecipient2EthBalanceAfter = await ethers.provider.getBalance(
      feeRecipient2.address
    );
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerEthBalanceBefore.sub(buyerEthBalanceAfter)).to.be.gt(price);
    expect(sellerEthBalanceAfter).to.eq(sellerEthBalanceBefore.add(price));
    expect(
      feeRecipient1EthBalanceAfter.sub(feeRecipient1EthBalanceBefore)
    ).to.eq(fee1);
    expect(
      feeRecipient2EthBalanceAfter.sub(feeRecipient2EthBalanceBefore)
    ).to.eq(fee2);
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("build and match buy order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const boughtTokenId = 10;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange
    await weth.approve(buyer, Seaport.Addresses.Exchange[chainId]);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(boughtTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the exchange
    await nft.approve(seller, Seaport.Addresses.Exchange[chainId]);

    const exchange = new Seaport.Exchange(chainId);

    const builder = new Seaport.Builders.SingleToken(chainId);

    // Build buy order
    const buyOrder = builder.build({
      side: "buy",
      tokenKind: "erc721",
      offerer: buyer.address,
      contract: erc721.address,
      tokenId: boughtTokenId,
      paymentToken: Common.Addresses.Weth[chainId],
      price,
      nonce: 0,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });

    // Sign the order
    await buyOrder.sign(buyer);

    await buyOrder.checkFillability(ethers.provider);

    // Create matching params
    const matchParams = buyOrder.buildMatching();

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerWethBalanceBefore = await weth.getBalance(seller.address);
    const ownerBefore = await nft.getOwner(boughtTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(seller, buyOrder, matchParams);

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(boughtTokenId);

    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.eq(price);
    expect(sellerWethBalanceAfter).to.eq(sellerWethBalanceBefore.add(price));
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("build and match buy order with fees", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const feeRecipient1 = ted;
    const fee1 = parseEther("0.1");
    const feeRecipient2 = carol;
    const fee2 = parseEther("0.00025");
    const boughtTokenId = 10;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange
    await weth.approve(buyer, Seaport.Addresses.Exchange[chainId]);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(boughtTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the exchange
    await nft.approve(seller, Seaport.Addresses.Exchange[chainId]);

    const exchange = new Seaport.Exchange(chainId);

    const builder = new Seaport.Builders.SingleToken(chainId);

    // Build buy order
    const buyOrder = builder.build({
      side: "buy",
      tokenKind: "erc721",
      offerer: buyer.address,
      contract: erc721.address,
      tokenId: boughtTokenId,
      paymentToken: Common.Addresses.Weth[chainId],
      price,
      fees: [
        {
          amount: fee1,
          recipient: feeRecipient1.address,
        },
        {
          amount: fee2,
          recipient: feeRecipient2.address,
        },
      ],
      nonce: 0,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });

    // Sign the order
    await buyOrder.sign(buyer);

    await buyOrder.checkFillability(ethers.provider);

    // Create matching params
    const matchParams = buyOrder.buildMatching();

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerWethBalanceBefore = await weth.getBalance(seller.address);
    const feeRecipient1WethBalanceBefore = await weth.getBalance(
      feeRecipient1.address
    );
    const feeRecipient2WethBalanceBefore = await weth.getBalance(
      feeRecipient2.address
    );
    const ownerBefore = await nft.getOwner(boughtTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(seller, buyOrder, matchParams);

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const feeRecipient1WethBalanceAfter = await weth.getBalance(
      feeRecipient1.address
    );
    const feeRecipient2WethBalanceAfter = await weth.getBalance(
      feeRecipient2.address
    );
    const ownerAfter = await nft.getOwner(boughtTokenId);

    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.eq(price);
    expect(sellerWethBalanceAfter).to.eq(
      sellerWethBalanceBefore.add(price).sub(buyOrder.getFeeAmount())
    );
    expect(
      feeRecipient1WethBalanceAfter.sub(feeRecipient1WethBalanceBefore)
    ).to.eq(fee1);
    expect(
      feeRecipient2WethBalanceAfter.sub(feeRecipient2WethBalanceBefore)
    ).to.eq(fee2);
    expect(ownerAfter).to.eq(buyer.address);
  });
});
