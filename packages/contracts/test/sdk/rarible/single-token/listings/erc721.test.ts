import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Rarible from "@reservoir0x/sdk/src/rarible";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getChainId, reset, setupNFTs } from "../../../../utils";
import { BigNumber, constants } from "ethers";

describe("Rarible - SingleToken Listings Erc721", () => {
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

  //TODO: Fix these
  it("Rarible V3 Order data - 0 origin fee Build and fill ERC721 WETH sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Rarible.Addresses.ERC20TransferProxy[chainId]);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.NFTTransferProxy[chainId]);

    const exchange = new Rarible.Exchange(chainId);

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order

    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc721",
      contract: erc721.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: 1,
      paymentToken: Common.Addresses.Weth[chainId],
      startTime: 0,
      endTime: 0,
      orderType: Rarible.Constants.ORDER_TYPES.V2,
      dataType: Rarible.Constants.ORDER_DATA_TYPES.V2,
      payouts: [{ account: seller.address, value: "10000" }],
      // originFeeFirst: { account: charlie.address, value: "200" },
      // originFeeSecond: { account: dan.address, value: "200" },
      // marketplaceMarker: "rarible",
      // maxFeesBasePoint: 1000,
      // isMakeFill: true,
    });

    // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(sellerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    try {
      await exchange.fillOrder(buyer, sellOrder, {
        referrer: "reservoir.market",
      });
    } catch (err) {
      console.log("fail 1");
      console.log(err);
    }

    // try {
    //   await exchange.fillOrderOld(buyer, sellOrder, {
    //     referrer: "reservoir.market",
    //   });
    // } catch (err) {
    //   console.log("fail 2");
    //   console.log(err);
    //   throw Error();
    // }

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerBalanceAfter).to.be.eq(0);
    expect(sellerBalanceAfter).to.eq(price);
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Rarible - Build and fill ERC721 WETH sell order with revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Rarible.Addresses.ERC20TransferProxy[chainId]);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.NFTTransferProxy[chainId]);

    const exchange = new Rarible.Exchange(chainId);
    const revenueSplitBpsA = "300";
    const revenueSplitBpsB = "400";

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc721",
      contract: erc721.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: 1,
      paymentToken: Common.Addresses.Weth[chainId],
      startTime: 0,
      endTime: 0,
      orderType: Rarible.Constants.ORDER_TYPES.V2,
      dataType: Rarible.Constants.ORDER_DATA_TYPES.V2,
      payouts: [{ account: seller.address, value: "10000" }],
      originFeeFirst: { account: charlie.address, value: revenueSplitBpsA },
      originFeeSecond: { account: dan.address, value: revenueSplitBpsB },
      marketplaceMarker: "rarible",
      maxFeesBasePoint: 1000,
    });

    // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(sellerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, {
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

    expect(buyerBalanceAfter).to.be.eq(0);
    expect(sellerBalanceAfter).to.eq(priceAfterFees);
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Rarible V3 Order data - 0 origin fee Build and fill ERC721 ETH sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.NFTTransferProxy[chainId]);

    const exchange = new Rarible.Exchange(chainId);

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc721",
      contract: erc721.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: 1,
      paymentToken: constants.AddressZero,
      startTime: 0,
      endTime: 0,
      orderType: Rarible.Constants.ORDER_TYPES.V2,
      dataType: Rarible.Constants.ORDER_DATA_TYPES.V2,
      payouts: [{ account: seller.address, value: "10000" }],
      // originFeeFirst: { account: charlie.address, value: "200" },
      // originFeeFirst: { account: charlie.address, value: "200" },
      // originFeeSecond: { account: dan.address, value: "200" },
      // marketplaceMarker: "rarible",
      // maxFeesBasePoint: 1000,
      // isMakeFill: false,
    }); // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);
    expect(ownerBefore).to.eq(seller.address);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );

    // Match orders
    const tx = await exchange.fillOrder(buyer, sellOrder, {
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
    expect(sellerBalanceAfter).to.eq(sellerBalanceBefore.add(price));
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Rarible - Build and fill ERC721 ETH sell order with revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);

    const revenueSplitBpsA = "1000";
    const revenueSplitBpsB = "1500";

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc721",
      contract: erc721.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: 1,
      paymentToken: constants.AddressZero,
      startTime: 0,
      endTime: 0,
      fees: [
        {
          account: charlie.address,
          value: revenueSplitBpsA,
        },
        {
          account: dan.address,
          value: revenueSplitBpsB,
        },
      ],
    });

    // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);
    expect(ownerBefore).to.eq(seller.address);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );

    // Match orders
    const tx = await exchange.fillOrder(buyer, sellOrder, {
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

    expect(sellerBalanceAfter).to.eq(sellerBalanceBefore.add(priceAfterFees));
    expect(ownerAfter).to.eq(buyer.address);
  });

  //TODO: Implement these
  it("Rarible V1 Order data - 1 payout | 2 origin fees - Build and fill ERC721 ETH sell order", async () => {});
  it("Rarible V1 Order data - 2 payouts | 0 origin fees - Build and fill ERC721 ETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 2 origin fees - Build and fill ERC721 ETH sell order", async () => {});
  it("Rarible V2 Order data - 2 payouts | 2 origin fees - Build and fill ERC721 ETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 0 origin fees - Build and fill ERC721 ETH sell order", async () => {});
  it("Rarible V3 Order data - 1 origin fee Build and fill ERC721 ETH sell order", async () => {});
  it("Rarible V3 Order data - 2 origin fees Build and fill ERC721 ETH sell order", async () => {});

  it("Rarible V1 Order data - 1 payout | 2 origin fees - Build and fill ERC721 WETH sell order", async () => {});
  it("Rarible V1 Order data - 2 payouts | 0 origin fees - Build and fill ERC721 WETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 2 origin fees - Build and fill ERC721 WETH sell order", async () => {});
  it("Rarible V2 Order data - 2 payouts | 2 origin fees - Build and fill ERC721 WETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 0 origin fees - Build and fill ERC721 WETH sell order", async () => {});
  it("Rarible V3 Order data - 1 origin fee Build and fill ERC721 WETH sell order", async () => {});
  it("Rarible V3 Order data - 2 origin fees Build and fill ERC721 WETH sell order", async () => {});
});
