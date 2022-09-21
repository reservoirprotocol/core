import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Universe from "@reservoir0x/sdk/src/Universe";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getChainId, reset, setupNFTs } from "../../../utils";
import { OrderSide } from "@reservoir0x/sdk/src/universe/types";
import { BigNumber, constants } from "ethers";

describe("Universe - SingleToken Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let dan: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, charlie, dan] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("Build and fill ERC721 WETH buy order no revenue splits", async () => {
    const seller = alice;
    const buyer = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Universe.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(seller.address);
    const sellerBalanceBefore = await weth.getBalance(buyer.address);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Universe.Addresses.Exchange[chainId]);

    const exchange = new Universe.Exchange(chainId);
    const daoFee = await exchange.getDaoFee(seller.provider!);

    const builder = new Universe.Builders.SingleToken(chainId);
    // Build sell order
    const buyOrder = builder.build({
      hash: "",
      type: "UNIVERSE_V1",
      side: OrderSide.SELL,
      maker: buyer.address,
      make: {
        assetType: {
          assetClass: "ERC20",
          contract: Common.Addresses.Weth[chainId],
        },
        value: price.toString(),
      },
      taker: constants.AddressZero,
      take: {
        assetType: {
          assetClass: "ERC721",
          contract: erc721.address,
          tokenId: soldTokenId.toString(),
        },
        value: "1",
      },
      salt: "1",
      start: "0",
      end: "0",
      data: {
        dataType: "",
        revenueSplits: [],
      },
      signature: "",
      makeBalance: price.toString(),
      makeStock: "1",
    });

    // Sign the order
    await buyOrder.sign(buyer);

    // Create matching buy order (right order)
    const sellOrder = buyOrder.buildMatching(seller.address);
    await buyOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(buyerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(seller, buyOrder, sellOrder, {
      referrer: "reservoir.market",
    });

    const buyerBalanceAfter = await weth.getBalance(seller.address);
    const sellerBalanceAfter = await weth.getBalance(buyer.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(sellerBalanceAfter).to.be.eq(0);
    expect(buyerBalanceAfter).to.eq(price.sub(price.mul(daoFee).div(10000)));
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and fill ERC721 WETH buy order with revenue splits", async () => {
    const seller = alice;
    const buyer = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Universe.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(seller.address);
    const sellerBalanceBefore = await weth.getBalance(buyer.address);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Universe.Addresses.Exchange[chainId]);

    const exchange = new Universe.Exchange(chainId);
    const daoFee = await exchange.getDaoFee(seller.provider!);
    const revenueSplitBpsA = "1000";
    const revenueSplitBpsB = "1500";

    const builder = new Universe.Builders.SingleToken(chainId);
    // Build sell order
    const buyOrder = builder.build({
      hash: "",
      type: "UNIVERSE_V1",
      side: OrderSide.SELL,
      maker: buyer.address,
      make: {
        assetType: {
          assetClass: "ERC20",
          contract: Common.Addresses.Weth[chainId],
        },
        value: price.toString(),
      },
      taker: constants.AddressZero,
      take: {
        assetType: {
          assetClass: "ERC721",
          contract: erc721.address,
          tokenId: soldTokenId.toString(),
        },
        value: "1",
      },
      salt: "1",
      start: "0",
      end: "0",
      data: {
        dataType: "ORDER_DATA",
        revenueSplits: [
          {
            account: charlie.address,
            value: revenueSplitBpsA,
          },
          {
            account: dan.address,
            value: revenueSplitBpsB,
          },
        ],
      },
      signature: "",
      makeBalance: price.toString(),
      makeStock: "1",
    });

    // Sign the order
    await buyOrder.sign(buyer);

    // Create matching buy order (right order)
    const sellOrder = buyOrder.buildMatching(seller.address);
    await buyOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(buyerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(seller, buyOrder, sellOrder, {
      referrer: "reservoir.market",
    });

    const buyerBalanceAfter = await weth.getBalance(seller.address);
    const sellerBalanceAfter = await weth.getBalance(buyer.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    let priceAfterFees = price;
    priceAfterFees = priceAfterFees.sub(
      priceAfterFees
        .mul(BigNumber.from(revenueSplitBpsA).add(revenueSplitBpsB))
        .div(10000)
    );
    priceAfterFees = priceAfterFees.sub(priceAfterFees.mul(daoFee).div(10000));

    expect(sellerBalanceAfter).to.be.eq(0);
    expect(buyerBalanceAfter).to.eq(priceAfterFees);
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and fill ERC721 WETH sell order no revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Universe.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Universe.Addresses.Exchange[chainId]);

    const exchange = new Universe.Exchange(chainId);
    const daoFee = await exchange.getDaoFee(buyer.provider!);

    const builder = new Universe.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      hash: "",
      type: "UNIVERSE_V1",
      side: OrderSide.SELL,
      maker: seller.address,
      make: {
        assetType: {
          assetClass: "ERC721",
          contract: erc721.address,
          tokenId: soldTokenId.toString(),
        },
        value: "1",
      },
      taker: constants.AddressZero,
      take: {
        assetType: {
          assetClass: "ERC20",
          contract: Common.Addresses.Weth[chainId],
        },
        value: price.toString(),
      },
      salt: "1",
      start: "0",
      end: "0",
      data: {
        dataType: "",
        revenueSplits: [],
      },
      signature: "",
      makeBalance: price.toString(),
      makeStock: "1",
    });

    // Sign the order
    await sellOrder.sign(seller);

    // Create matching buy order (right order)
    const buyOrder = sellOrder.buildMatching(buyer.address);
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(sellerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, buyOrder, {
      referrer: "reservoir.market",
    });

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerBalanceAfter).to.be.eq(0);
    expect(sellerBalanceAfter).to.eq(price.sub(price.mul(daoFee).div(10000)));
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and fill ERC721 WETH sell order with revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Universe.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Universe.Addresses.Exchange[chainId]);

    const exchange = new Universe.Exchange(chainId);
    const daoFee = await exchange.getDaoFee(buyer.provider!);
    const revenueSplitBpsA = "1000";
    const revenueSplitBpsB = "1500";

    const builder = new Universe.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      hash: "",
      type: "UNIVERSE_V1",
      side: OrderSide.SELL,
      maker: seller.address,
      make: {
        assetType: {
          assetClass: "ERC721",
          contract: erc721.address,
          tokenId: soldTokenId.toString(),
        },
        value: "1",
      },
      taker: constants.AddressZero,
      take: {
        assetType: {
          assetClass: "ERC20",
          contract: Common.Addresses.Weth[chainId],
        },
        value: price.toString(),
      },
      salt: "1",
      start: "0",
      end: "0",
      data: {
        dataType: "ORDER_DATA",
        revenueSplits: [
          {
            account: charlie.address,
            value: revenueSplitBpsA,
          },
          {
            account: dan.address,
            value: revenueSplitBpsB,
          },
        ],
      },
      signature: "",
      makeBalance: price.toString(),
      makeStock: "1",
    });

    // Sign the order
    await sellOrder.sign(seller);

    // Create matching buy order (right order)
    const buyOrder = sellOrder.buildMatching(buyer.address);
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(sellerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, buyOrder, {
      referrer: "reservoir.market",
    });

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);
    let priceAfterFees = price;
    priceAfterFees = priceAfterFees.sub(
      priceAfterFees
        .mul(BigNumber.from(revenueSplitBpsA).add(revenueSplitBpsB))
        .div(10000)
    );
    priceAfterFees = priceAfterFees.sub(priceAfterFees.mul(daoFee).div(10000));

    expect(buyerBalanceAfter).to.be.eq(0);
    expect(sellerBalanceAfter).to.eq(priceAfterFees);
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and fill ERC721 ETH sell order no revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Universe.Addresses.Exchange[chainId]);

    const exchange = new Universe.Exchange(chainId);

    const daoFee = await exchange.getDaoFee(buyer.provider!);

    const builder = new Universe.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      hash: "",
      type: "UNIVERSE_V1",
      side: OrderSide.SELL,
      maker: seller.address,
      make: {
        assetType: {
          assetClass: "ERC721",
          contract: erc721.address,
          tokenId: soldTokenId.toString(),
        },
        value: "1",
      },
      taker: constants.AddressZero,
      take: {
        assetType: {
          assetClass: "ETH",
        },
        value: price.toString(),
      },
      salt: "1",
      start: "0",
      end: "0",
      data: {
        dataType: "",
        revenueSplits: [],
      },
      signature: "",
      makeBalance: price.toString(),
      makeStock: "1",
    });
    // Sign the order
    await sellOrder.sign(seller);

    // Create matching buy order (right order)
    const buyOrder = sellOrder.buildMatching(buyer.address);
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);
    expect(ownerBefore).to.eq(seller.address);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );

    // Match orders
    const tx = await exchange.fillOrder(buyer, sellOrder, buyOrder, {
      referrer: "reservoir.market",
    });

    const txReceipt = await tx.wait();

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);
    const gasUsed = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    expect(buyerBalanceAfter).to.be.eq(
      buyerBalanceBefore.sub(gasUsed).sub(price)
    );
    expect(sellerBalanceAfter).to.eq(
      sellerBalanceBefore.add(price.sub(price.mul(daoFee).div(10000)))
    );
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and fill ERC721 ETH sell order with revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Universe.Addresses.Exchange[chainId]);

    const exchange = new Universe.Exchange(chainId);

    const daoFee = await exchange.getDaoFee(buyer.provider!);
    const revenueSplitBpsA = "1000";
    const revenueSplitBpsB = "1500";

    const builder = new Universe.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      hash: "",
      type: "UNIVERSE_V1",
      side: OrderSide.SELL,
      maker: seller.address,
      make: {
        assetType: {
          assetClass: "ERC721",
          contract: erc721.address,
          tokenId: soldTokenId.toString(),
        },
        value: "1",
      },
      taker: constants.AddressZero,
      take: {
        assetType: {
          assetClass: "ETH",
        },
        value: price.toString(),
      },
      salt: "1",
      start: "0",
      end: "0",
      data: {
        dataType: "ORDER_DATA",
        revenueSplits: [
          {
            account: charlie.address,
            value: revenueSplitBpsA,
          },
          {
            account: dan.address,
            value: revenueSplitBpsB,
          },
        ],
      },
      signature: "",
      makeBalance: price.toString(),
      makeStock: "1",
    });

    // Sign the order
    await sellOrder.sign(seller);

    // Create matching buy order (right order)
    const buyOrder = sellOrder.buildMatching(buyer.address);
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);
    expect(ownerBefore).to.eq(seller.address);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );

    // Match orders
    const tx = await exchange.fillOrder(buyer, sellOrder, buyOrder, {
      referrer: "reservoir.market",
    });

    const txReceipt = await tx.wait();

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);
    const gasUsed = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    expect(buyerBalanceAfter).to.be.eq(
      buyerBalanceBefore.sub(gasUsed).sub(price)
    );

    let priceAfterFees = price;
    priceAfterFees = priceAfterFees.sub(
      priceAfterFees
        .mul(BigNumber.from(revenueSplitBpsA).add(revenueSplitBpsB))
        .div(10000)
    );
    priceAfterFees = priceAfterFees.sub(priceAfterFees.mul(daoFee).div(10000));

    expect(sellerBalanceAfter).to.eq(sellerBalanceBefore.add(priceAfterFees));
    expect(ownerAfter).to.eq(buyer.address);
  });
});
