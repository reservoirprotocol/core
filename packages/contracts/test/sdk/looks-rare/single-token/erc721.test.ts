import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as LooksRare from "@reservoir0x/sdk/src/looks-rare";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getCurrentTimestamp } from "../../../utils";

describe("LooksRare - SingleToken Erc721", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    erc721 = await ethers
      .getContractFactory("MockERC721", deployer)
      .then((factory) => factory.deploy());
  });

  afterEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: (network.config as any).forking.url,
            blockNumber: (network.config as any).forking.blockNumber,
          },
        },
      ],
    });
  });

  it("build and match buy order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const boughtTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, 1);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, LooksRare.Addresses.Exchange[1]);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(boughtTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, LooksRare.Addresses.TransferManagerErc721[1]);

    const exchange = new LooksRare.Exchange(1);

    const builder = new LooksRare.Builders.SingleToken(1);

    // Build buy order
    const buyOrder = builder.build({
      isOrderAsk: false,
      signer: buyer.address,
      collection: erc721.address,
      tokenId: boughtTokenId,
      price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: await exchange.getNonce(ethers.provider, buyer.address),
    });

    // Sign the order
    await buyOrder.sign(buyer);

    // Create matching sell order
    const sellOrder = buyOrder.buildMatching(seller.address);

    await buyOrder.checkFillability(ethers.provider);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    const ownerBefore = await nft.getOwner(boughtTokenId);

    expect(buyerBalanceBefore).to.eq(price);
    expect(sellerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.match(seller, buyOrder, sellOrder);

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(boughtTokenId);

    expect(buyerBalanceAfter).to.eq(0);
    expect(sellerBalanceAfter).to.eq(price.sub(price.mul(200).div(10000)));
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("build and match sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, 1);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, LooksRare.Addresses.TransferManagerErc721[1]);

    const exchange = new LooksRare.Exchange(1);

    const builder = new LooksRare.Builders.SingleToken(1);

    // Build sell order
    const sellOrder = builder.build({
      isOrderAsk: true,
      signer: seller.address,
      collection: erc721.address,
      tokenId: soldTokenId,
      price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: await exchange.getNonce(ethers.provider, seller.address),
    });

    // Sign the order
    await sellOrder.sign(seller);

    // Create matching buy order
    const buyOrder = sellOrder.buildMatching(buyer.address);

    await sellOrder.checkFillability(ethers.provider);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(sellerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.match(buyer, sellOrder, buyOrder);

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerBalanceAfter).to.be.lt(buyerBalanceBefore.sub(price));
    expect(sellerBalanceAfter).to.eq(price.sub(price.mul(200).div(10000)));
    expect(ownerAfter).to.eq(buyer.address);
  });
});
