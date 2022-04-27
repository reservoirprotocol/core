import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as WyvernV23 from "@reservoir0x/sdk/src/wyvern-v2.3";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getCurrentTimestamp } from "../../../utils";

describe("WyvernV2.3 - TokenListErc721", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

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
    const feeRecipient = carol;

    const price = parseEther("1");
    const fee = 250;
    const boughtTokenIds = Array.from(Array(1000).keys());
    const soldTokenId = 999;

    const weth = new Common.Helpers.Weth(ethers.provider, 1);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the token transfer proxy for the buyer
    await weth.approve(buyer, WyvernV23.Addresses.TokenTransferProxy[1]);

    // Approve the token transfer proxy for the seller
    await weth.approve(seller, WyvernV23.Addresses.TokenTransferProxy[1]);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    // Register user proxy for the seller
    const proxyRegistry = new WyvernV23.Helpers.ProxyRegistry(
      ethers.provider,
      1
    );
    await proxyRegistry.registerProxy(seller);
    const proxy = await proxyRegistry.getProxy(seller.address);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the user proxy
    await nft.approve(seller, proxy);

    const exchange = new WyvernV23.Exchange(1);

    const builder = new WyvernV23.Builders.Erc721.TokenList(1);

    // Build buy order
    let buyOrder = builder.build({
      maker: buyer.address,
      contract: erc721.address,
      tokenIds: boughtTokenIds,
      side: "buy",
      price,
      paymentToken: Common.Addresses.Weth[1],
      fee,
      feeRecipient: feeRecipient.address,
      listingTime: await getCurrentTimestamp(ethers.provider),
      nonce: await exchange.getNonce(ethers.provider, buyer.address),
    });

    buyOrder.checkValidity();

    // Sign the order
    await buyOrder.sign(buyer);

    // Create matching sell order
    const sellOrder = buyOrder.buildMatching(seller.address, {
      tokenId: soldTokenId,
      tokenIds: boughtTokenIds,
      nonce: await exchange.getNonce(ethers.provider, seller.address),
    });
    sellOrder.params.listingTime = await getCurrentTimestamp(ethers.provider);

    await buyOrder.checkFillability(ethers.provider);

    const buyerBalanceBefore = await weth.getBalance(buyer.address);
    const sellerBalanceBefore = await weth.getBalance(seller.address);
    const feeRecipientBalanceBefore = await weth.getBalance(
      feeRecipient.address
    );
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(buyerBalanceBefore).to.eq(price);
    expect(sellerBalanceBefore).to.eq(0);
    expect(feeRecipientBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.match(seller, buyOrder, sellOrder);

    const buyerBalanceAfter = await weth.getBalance(buyer.address);
    const sellerBalanceAfter = await weth.getBalance(seller.address);
    const feeRecipientBalanceAfter = await weth.getBalance(
      feeRecipient.address
    );
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerBalanceAfter).to.eq(0);
    expect(sellerBalanceAfter).to.eq(price.sub(price.mul(fee).div(10000)));
    expect(feeRecipientBalanceAfter).to.eq(price.mul(fee).div(10000));
    expect(ownerAfter).to.eq(buyer.address);
  });
});
