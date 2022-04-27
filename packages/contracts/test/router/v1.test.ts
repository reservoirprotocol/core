import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getCurrentTimestamp } from "../utils";

describe("Router V1", () => {
  let chainId: number;

  let deployer: SignerWithAddress;
  let referrer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc721: Contract;
  let router: Contract;

  beforeEach(async () => {
    chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
    [deployer, referrer, alice, bob, carol] = await ethers.getSigners();

    erc721 = await ethers
      .getContractFactory("MockERC721", deployer)
      .then((factory) => factory.deploy());

    router = await ethers
      .getContractFactory("RouterV1", deployer)
      .then((factory) =>
        factory.deploy(
          Sdk.Common.Addresses.Weth[chainId],
          Sdk.LooksRare.Addresses.Exchange[chainId],
          Sdk.WyvernV23.Addresses.Exchange[chainId]
        )
      );
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

  it("fillWyvernV23 - fill listing", async () => {
    const buyer = alice;
    const seller = bob;
    const feeRecipient = carol;

    const price = parseEther("1");
    const fee = 250;
    const soldTokenId = 0;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    // Register user proxy for the seller
    const proxyRegistry = new Sdk.WyvernV23.Helpers.ProxyRegistry(
      ethers.provider,
      chainId
    );
    await proxyRegistry.registerProxy(seller);
    const proxy = await proxyRegistry.getProxy(seller.address);

    // Approve the user proxy
    await erc721.connect(seller).setApprovalForAll(proxy, true);

    const exchange = new Sdk.WyvernV23.Exchange(chainId);
    const builder = new Sdk.WyvernV23.Builders.Erc721.SingleToken.V2(chainId);

    // Build sell order
    let sellOrder = builder.build({
      maker: seller.address,
      contract: erc721.address,
      tokenId: soldTokenId,
      side: "sell",
      price,
      paymentToken: Sdk.Common.Addresses.Eth[chainId],
      fee,
      feeRecipient: feeRecipient.address,
      listingTime: await getCurrentTimestamp(ethers.provider),
      nonce: await exchange.getNonce(ethers.provider, seller.address),
    });
    await sellOrder.sign(seller);

    // Create matching buy order
    const buyOrder = sellOrder.buildMatching(router.address, {
      nonce: await exchange.getNonce(ethers.provider, router.address),
      recipient: buyer.address,
    });
    buyOrder.params.listingTime = await getCurrentTimestamp(ethers.provider);

    await sellOrder.checkFillability(ethers.provider);

    const sellerEthBalanceBefore = await seller.getBalance();
    const ownerBefore = await erc721.ownerOf(soldTokenId);
    expect(ownerBefore).to.eq(seller.address);

    const tx = exchange.matchTransaction(buyer.address, buyOrder, sellOrder);
    await router.connect(buyer).fillWyvernV23(referrer.address, tx.data, {
      value: tx.value,
    });

    const sellerEthBalanceAfter = await seller.getBalance();
    const ownerAfter = await erc721.ownerOf(soldTokenId);
    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.eq(
      price.sub(price.mul(fee).div(10000))
    );
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("fillWyvernV23 - fill bid", async () => {
    const buyer = alice;
    const seller = bob;
    const feeRecipient = carol;

    const price = parseEther("1");
    const fee = 250;
    const boughtTokenId = 0;

    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the token transfer proxy for the buyer
    await weth.approve(
      buyer,
      Sdk.WyvernV23.Addresses.TokenTransferProxy[chainId]
    );

    // Mint erc721 to seller
    await erc721.connect(seller).mint(boughtTokenId);

    const exchange = new Sdk.WyvernV23.Exchange(chainId);
    const builder = new Sdk.WyvernV23.Builders.Erc721.SingleToken.V2(chainId);

    // Build buy order
    let buyOrder = builder.build({
      maker: buyer.address,
      contract: erc721.address,
      tokenId: boughtTokenId,
      side: "buy",
      price,
      paymentToken: Sdk.Common.Addresses.Weth[chainId],
      fee,
      feeRecipient: feeRecipient.address,
      listingTime: await getCurrentTimestamp(ethers.provider),
      nonce: await exchange.getNonce(ethers.provider, buyer.address),
    });
    await buyOrder.sign(buyer);

    // Create matching sell order
    const sellOrder = buyOrder.buildMatching(router.address, {
      nonce: await exchange.getNonce(ethers.provider, router.address),
    });
    sellOrder.params.listingTime = await getCurrentTimestamp(ethers.provider);

    await buyOrder.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const ownerBefore = await erc721.ownerOf(boughtTokenId);
    expect(ownerBefore).to.eq(seller.address);

    const tx = exchange.matchTransaction(seller.address, buyOrder, sellOrder);
    await erc721
      .connect(seller)
      ["safeTransferFrom(address,address,uint256,bytes)"](
        seller.address,
        router.address,
        boughtTokenId,
        router.interface.encodeFunctionData("fillWyvernV23", [
          referrer.address,
          tx.data,
        ])
      );

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const ownerAfter = await erc721.ownerOf(boughtTokenId);
    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.eq(price);
    expect(ownerAfter).to.eq(buyer.address);
  });
});
