import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Rarible from "@reservoir0x/sdk/src/rarible";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getChainId, reset, setupNFTs } from "../../../../utils";
import { BigNumber, constants } from "ethers";

//TODO: Add check signature check
describe("Rarible - SingleToken Erc1155", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let dan: SignerWithAddress;

  let erc1155: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, charlie, dan] = await ethers.getSigners();

    ({ erc1155 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  //TODO: Fix these
  it("Rarible V3 Order data - 0 origin fee Build and fill ERC1155 WETH sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;
    const mintTokensAmount = 4;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Rarible.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    // Mint erc1155 to seller
    await erc1155.connect(seller).mintMany(soldTokenId, mintTokensAmount);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);
    const daoFee = await exchange.getDaoFee(buyer.provider!);

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc1155",
      contract: erc1155.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: mintTokensAmount,
      paymentToken: Common.Addresses.Weth[chainId],
      startTime: 0,
      endTime: 0,
    });

    // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);

    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    expect(sellerBalanceBefore).to.eq(0);
    expect(buyerBalanceBefore).to.eq(price);
    expect(sellerNftBalanceBefore).to.eq(mintTokensAmount);
    expect(buyerNftBalanceBefore).to.eq(0);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, {
      referrer: "reservoir.market",
      amount: mintTokensAmount,
    });

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    expect(buyerBalanceAfter).to.be.eq(0);
    expect(sellerBalanceAfter).to.eq(price.sub(price.mul(daoFee).div(10000)));
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(mintTokensAmount);
  });

  it("Rarible V3 Order data - 0 origin fee Build and partial fill ERC1155 WETH sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;
    const mintTokensAmount = 4;
    const fillAmount = 2;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Rarible.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    // Mint erc1155 to seller
    await erc1155.connect(seller).mintMany(soldTokenId, mintTokensAmount);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);
    const daoFee = await exchange.getDaoFee(buyer.provider!);

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc1155",
      contract: erc1155.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: mintTokensAmount,
      paymentToken: Common.Addresses.Weth[chainId],
      startTime: 0,
      endTime: 0,
    });

    // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);

    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    expect(sellerBalanceBefore).to.eq(0);
    expect(buyerBalanceBefore).to.eq(price);
    expect(sellerNftBalanceBefore).to.eq(mintTokensAmount);
    expect(buyerNftBalanceBefore).to.eq(0);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, {
      referrer: "reservoir.market",
      amount: fillAmount,
    });

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    const filledPrice = price.div(mintTokensAmount).mul(fillAmount);

    expect(buyerBalanceAfter).to.be.eq(price.sub(filledPrice));

    expect(sellerBalanceAfter).to.eq(
      filledPrice.sub(filledPrice.mul(daoFee).div(10000))
    );

    expect(sellerNftBalanceAfter).to.eq(fillAmount);
    expect(buyerNftBalanceAfter).to.eq(mintTokensAmount - fillAmount);
  });

  it("Build and fill ERC1155 WETH sell order with revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;
    const mintTokensAmount = 4;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Rarible.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    // Mint erc1155 to seller
    await erc1155.connect(seller).mintMany(soldTokenId, mintTokensAmount);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);
    const daoFee = await exchange.getDaoFee(buyer.provider!);
    const revenueSplitBpsA = "1000";
    const revenueSplitBpsB = "1500";

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc1155",
      contract: erc1155.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: mintTokensAmount,
      paymentToken: Common.Addresses.Weth[chainId],
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

    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    expect(sellerBalanceBefore).to.eq(0);
    expect(buyerBalanceBefore).to.eq(price);
    expect(sellerNftBalanceBefore).to.eq(mintTokensAmount);
    expect(buyerNftBalanceBefore).to.eq(0);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, {
      referrer: "reservoir.market",
      amount: mintTokensAmount,
    });

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    let priceAfterFees = price;
    priceAfterFees = priceAfterFees.sub(
      priceAfterFees
        .mul(BigNumber.from(revenueSplitBpsA).add(revenueSplitBpsB))
        .div(10000)
    );
    priceAfterFees = priceAfterFees.sub(priceAfterFees.mul(daoFee).div(10000));

    expect(buyerBalanceAfter).to.be.eq(0);
    expect(sellerBalanceAfter).to.eq(priceAfterFees);
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(mintTokensAmount);
  });

  it("Rarible V3 Order data - 0 origin fee Build and fill ERC1155 ETH sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;
    const mintTokensAmount = 4;
    // Mint erc1155 to seller
    await erc1155.connect(seller).mintMany(soldTokenId, mintTokensAmount);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);

    const daoFee = await exchange.getDaoFee(buyer.provider!);

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc1155",
      contract: erc1155.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: mintTokensAmount,
      paymentToken: constants.AddressZero,
      startTime: 0,
      endTime: 0,
    });
    // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    expect(sellerNftBalanceBefore).eq(mintTokensAmount.toString());
    expect(buyerNftBalanceBefore).eq(0);

    // Match orders
    const tx = await exchange.fillOrder(buyer, sellOrder, {
      referrer: "reservoir.market",
      amount: mintTokensAmount,
    });

    const txReceipt = await tx.wait();

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );
    const gasUsed = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    expect(buyerBalanceAfter).to.be.eq(
      buyerBalanceBefore.sub(gasUsed).sub(price)
    );
    expect(sellerBalanceAfter).to.eq(
      sellerBalanceBefore.add(price.sub(price.mul(daoFee).div(10000)))
    );
    expect(sellerNftBalanceAfter).eq(0);
    expect(buyerNftBalanceAfter).eq(mintTokensAmount.toString());
  });

  it("Rarible V3 Order data - 0 origin fee Build and partial fill ERC1155 ETH sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;
    const mintTokensAmount = 4;
    const fillAmount = 2;

    // Mint erc1155 to seller
    await erc1155.connect(seller).mintMany(soldTokenId, mintTokensAmount);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);

    const daoFee = await exchange.getDaoFee(buyer.provider!);

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc1155",
      contract: erc1155.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: mintTokensAmount,
      paymentToken: constants.AddressZero,
      startTime: 0,
      endTime: 0,
    });
    // Sign the order
    await sellOrder.sign(seller);
    await sellOrder.checkSignature();
    await sellOrder.checkFillability(ethers.provider);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    expect(sellerNftBalanceBefore).eq(mintTokensAmount);
    expect(buyerNftBalanceBefore).eq(0);

    // Match orders
    const tx = await exchange.fillOrder(buyer, sellOrder, {
      referrer: "reservoir.market",
      amount: fillAmount,
    });

    const txReceipt = await tx.wait();

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );
    const gasUsed = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    const filledPrice = price.div(mintTokensAmount).mul(fillAmount);
    expect(buyerBalanceAfter).to.be.eq(
      buyerBalanceBefore.sub(gasUsed).sub(filledPrice)
    );

    expect(sellerBalanceAfter).to.eq(
      sellerBalanceBefore.add(
        filledPrice.sub(filledPrice.mul(daoFee).div(10000))
      )
    );
    expect(sellerNftBalanceAfter).eq(mintTokensAmount - fillAmount);
    expect(buyerNftBalanceAfter).eq(fillAmount);
  });

  it("Build and fill ERC1155 ETH sell order with revenue splits", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;
    const mintTokensAmount = 4;
    // Mint erc1155 to seller
    await erc1155.connect(seller).mintMany(soldTokenId, mintTokensAmount);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);

    const daoFee = await exchange.getDaoFee(buyer.provider!);
    const revenueSplitBpsA = "1000";
    const revenueSplitBpsB = "1500";

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build sell order
    const sellOrder = builder.build({
      maker: seller.address,
      side: "sell",
      tokenKind: "erc1155",
      contract: erc1155.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: mintTokensAmount,
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

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );

    expect(sellerNftBalanceBefore).eq(mintTokensAmount);
    expect(buyerNftBalanceBefore).eq(0);

    // Match orders
    const tx = await exchange.fillOrder(buyer, sellOrder, {
      referrer: "reservoir.market",
      amount: mintTokensAmount,
    });

    const txReceipt = await tx.wait();

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );
    const gasUsed = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    let priceAfterFees = price;
    priceAfterFees = priceAfterFees.sub(
      priceAfterFees
        .mul(BigNumber.from(revenueSplitBpsA).add(revenueSplitBpsB))
        .div(10000)
    );
    priceAfterFees = priceAfterFees.sub(priceAfterFees.mul(daoFee).div(10000));

    expect(buyerBalanceAfter).to.be.eq(
      buyerBalanceBefore.sub(gasUsed).sub(price)
    );
    expect(sellerBalanceAfter).to.eq(sellerBalanceBefore.add(priceAfterFees));
    expect(sellerNftBalanceAfter).eq(0);
    expect(buyerNftBalanceAfter).eq(mintTokensAmount);
  });

  //TODO: Implement these
  it("Rarible V1 Order data - 1 payout | 2 origin fees - Build and fill ERC1155 WETH sell order", async () => {});
  it("Rarible V1 Order data - 1 payout | 2 origin fees - Build and partial fill ERC1155 WETH sell order", async () => {});
  it("Rarible V1 Order data - 2 payouts | 0 origin fees - Build and fill ERC1155 WETH sell order", async () => {});
  it("Rarible V1 Order data - 2 payouts | 0 origin fees - Build and partial ERC1155 WETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 2 origin fees - Build and fill ERC1155 WETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 2 origin fees - Build and partial ERC1155 WETH sell order", async () => {});
  it("Rarible V2 Order data - 2 payouts | 2 origin fees - Build and fill ERC1155 WETH sell order", async () => {});
  it("Rarible V2 Order data - 2 payouts | 2 origin fees - Build and partial ERC1155 WETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 0 origin fees - Build and fill ERC1155 WETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 0 origin fees - Build and partial ERC1155 WETH sell order", async () => {});
  it("Rarible V3 Order data - 1 origin fee Build and fill ERC1155 WETH sell order", async () => {});
  it("Rarible V3 Order data - 1 origin fee Build and partial ERC1155 WETH sell order", async () => {});
  it("Rarible V3 Order data - 2 origin fees Build and fill ERC1155 WETH sell order", async () => {});
  it("Rarible V3 Order data - 2 origin fees Build and partial ERC1155 WETH sell order", async () => {});

  it("Rarible V1 Order data - 1 payout | 2 origin fees - Build and fill ERC1155 ETH sell order", async () => {});
  it("Rarible V1 Order data - 1 payout | 2 origin fees - Build and partial fill ERC1155 ETH sell order", async () => {});
  it("Rarible V1 Order data - 2 payouts | 0 origin fees - Build and fill ERC1155 ETH sell order", async () => {});
  it("Rarible V1 Order data - 2 payouts | 0 origin fees - Build and partial ERC1155 ETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 2 origin fees - Build and fill ERC1155 ETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 2 origin fees - Build and partial ERC1155 ETH sell order", async () => {});
  it("Rarible V2 Order data - 2 payouts | 2 origin fees - Build and fill ERC1155 ETH sell order", async () => {});
  it("Rarible V2 Order data - 2 payouts | 2 origin fees - Build and partial ERC1155 ETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 0 origin fees - Build and fill ERC1155 ETH sell order", async () => {});
  it("Rarible V2 Order data - 1 payout | 0 origin fees - Build and partial ERC1155 ETH sell order", async () => {});
  it("Rarible V3 Order data - 1 origin fee Build and fill ERC1155 ETH sell order", async () => {});
  it("Rarible V3 Order data - 1 origin fee Build and partial ERC1155 ETH sell order", async () => {});
  it("Rarible V3 Order data - 2 origin fees Build and fill ERC1155 ETH sell order", async () => {});
  it("Rarible V3 Order data - 2 origin fees Build and partial ERC1155 ETH sell order", async () => {});
});
