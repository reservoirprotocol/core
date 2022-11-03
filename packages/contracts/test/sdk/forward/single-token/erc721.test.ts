import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Forward from "@reservoir0x/sdk/src/forward";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  getChainId,
  getCurrentTimestamp,
  reset,
  setupNFTs,
} from "../../../utils";

describe("Forward - SingleToken Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let erc721: Contract;
  let weth: Common.Helpers.Weth;

  beforeEach(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));
    weth = new Common.Helpers.Weth(ethers.provider, chainId);
  });

  afterEach(reset);

  it("Build and fill bid", async () => {
    const buyer = alice;
    const seller = bob;
    const unitPrice = parseEther("1");
    const boughtTokenId = 1;

    const exchange = new Forward.Exchange(chainId);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(boughtTokenId);
    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);
    await nft.approve(seller, Forward.Addresses.Exchange[chainId]);

    // Mint weth to buyer
    await weth.deposit(buyer, unitPrice);
    await weth.approve(buyer, Forward.Addresses.Exchange[chainId]);

    const builder = new Forward.Builders.SingleToken(chainId);

    // Build bid
    const bid = builder.build({
      tokenKind: "erc721",
      side: "buy",
      maker: buyer.address,
      contract: erc721.address,
      tokenId: boughtTokenId,
      unitPrice,
      counter: 0,
      expiration: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await bid.sign(buyer);

    // Check the fillability
    await bid.checkFillability(ethers.provider);

    // Create matching params
    const matchParams = bid.buildMatching();

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerWethBalanceBefore = await weth.getBalance(seller.address);
    const ownerBefore = await nft.getOwner(boughtTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(seller, bid, matchParams, {
      source: "reservoir.market",
    });

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(boughtTokenId);

    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.be.eq(
      unitPrice
    );
    expect(sellerWethBalanceAfter).to.eq(
      sellerWethBalanceBefore.add(unitPrice)
    );
    expect(ownerAfter.toLowerCase()).to.eq(
      exchange.contract.address.toLowerCase()
    );
  });

  it("Build and fill external listing", async () => {
    const seller = alice;
    const buyer = bob;
    const unitPrice = parseEther("1");
    const soldTokenId = 1;

    const exchange = new Forward.Exchange(chainId);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);
    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);
    await nft.approve(seller, Forward.Addresses.Exchange[chainId]);

    const builder = new Forward.Builders.SingleToken(chainId);

    // Build listing
    const listing = builder.build({
      tokenKind: "erc721",
      side: "sell",
      external: true,
      maker: seller.address,
      contract: erc721.address,
      tokenId: soldTokenId,
      unitPrice,
      counter: 0,
      expiration: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await listing.sign(seller);

    // Check the fillability
    await listing.checkFillability(ethers.provider);

    // Create matching params
    const matchParams = listing.buildMatching();

    const buyerEthBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, listing, matchParams, {
      source: "reservoir.market",
    });

    const buyerEthBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.be.eq(
      unitPrice
    );
    expect(buyerEthBalanceBefore.sub(buyerEthBalanceAfter)).to.be.gt(unitPrice);
    expect(ownerAfter.toLowerCase()).to.eq(
      exchange.contract.address.toLowerCase()
    );
  });
});
