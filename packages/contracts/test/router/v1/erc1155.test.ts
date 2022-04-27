import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getCurrentTimestamp } from "../../utils";

describe("Router V1 - ERC1155", () => {
  let chainId: number;

  let deployer: SignerWithAddress;
  let referrer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc1155: Contract;
  let router: Contract;

  enum ExchangeKind {
    WYVERN_V23,
    LOOKS_RARE,
    ZEROEX_V4,
  }

  beforeEach(async () => {
    chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
    [deployer, referrer, alice, bob, carol] = await ethers.getSigners();

    erc1155 = await ethers
      .getContractFactory("MockERC1155", deployer)
      .then((factory) => factory.deploy());

    router = await ethers
      .getContractFactory("RouterV1", deployer)
      .then((factory) =>
        factory.deploy(
          Sdk.Common.Addresses.Weth[chainId],
          Sdk.LooksRare.Addresses.Exchange[chainId],
          Sdk.WyvernV23.Addresses.Exchange[chainId],
          Sdk.ZeroExV4.Addresses.Exchange[chainId]
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

  it("WyvernV23 - fill listing", async () => {
    const buyer = alice;
    const seller = bob;
    const feeRecipient = carol;

    const price = parseEther("1");
    const fee = 250;
    const soldTokenId = 0;

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(soldTokenId);

    // Register user proxy for the seller
    const proxyRegistry = new Sdk.WyvernV23.Helpers.ProxyRegistry(
      ethers.provider,
      chainId
    );
    await proxyRegistry.registerProxy(seller);
    const proxy = await proxyRegistry.getProxy(seller.address);

    // Approve the user proxy
    await erc1155.connect(seller).setApprovalForAll(proxy, true);

    const exchange = new Sdk.WyvernV23.Exchange(chainId);
    const builder = new Sdk.WyvernV23.Builders.Erc1155.SingleToken.V2(chainId);

    // Build sell order
    let sellOrder = builder.build({
      maker: seller.address,
      contract: erc1155.address,
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
    const sellerNftBalanceBefore = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerNftBalanceBefore).to.eq(1);
    expect(buyerNftBalanceBefore).to.eq(0);

    const tx = exchange.matchTransaction(buyer.address, buyOrder, sellOrder);
    await router
      .connect(buyer)
      .singleERC1155ListingFill(
        referrer.address,
        tx.data,
        ExchangeKind.WYVERN_V23,
        erc1155.address,
        soldTokenId,
        1,
        {
          value: tx.value,
        }
      );

    const sellerEthBalanceAfter = await seller.getBalance();
    const sellerNftBalanceAfter = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.eq(
      price.sub(price.mul(fee).div(10000))
    );
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(1);
  });

  it("WyvernV23 - fill bid", async () => {
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

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(boughtTokenId);

    const exchange = new Sdk.WyvernV23.Exchange(chainId);
    const builder = new Sdk.WyvernV23.Builders.Erc1155.SingleToken.V2(chainId);

    // Build buy order
    let buyOrder = builder.build({
      maker: buyer.address,
      contract: erc1155.address,
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
    const sellerNftBalanceBefore = await erc1155.balanceOf(
      seller.address,
      boughtTokenId
    );
    const buyerNftBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      boughtTokenId
    );
    expect(sellerNftBalanceBefore).to.eq(1);
    expect(buyerNftBalanceBefore).to.eq(0);

    const tx = exchange.matchTransaction(seller.address, buyOrder, sellOrder);
    await erc1155
      .connect(seller)
      ["safeTransferFrom(address,address,uint256,uint256,bytes)"](
        seller.address,
        router.address,
        boughtTokenId,
        1,
        router.interface.encodeFunctionData("singleERC1155BidFill", [
          referrer.address,
          tx.data,
          ExchangeKind.WYVERN_V23,
          erc1155.address,
          true,
        ])
      );

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerNftBalanceAfter = await erc1155.balanceOf(
      seller.address,
      boughtTokenId
    );
    const buyerNftBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      boughtTokenId
    );
    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.eq(price);
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(1);
  });

  it("LooksRare - fill listing", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1");
    const fee = 200;
    const soldTokenId = 0;

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(soldTokenId);

    // Approve the transfer manager
    await erc1155
      .connect(seller)
      .setApprovalForAll(
        Sdk.LooksRare.Addresses.TransferManagerErc1155[chainId],
        true
      );

    const exchange = new Sdk.LooksRare.Exchange(chainId);
    const builder = new Sdk.LooksRare.Builders.SingleToken(chainId);

    // Build sell order
    let sellOrder = builder.build({
      isOrderAsk: true,
      signer: seller.address,
      collection: erc1155.address,
      tokenId: soldTokenId,
      price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: await exchange.getNonce(ethers.provider, seller.address),
    });
    await sellOrder.sign(seller);

    // Create matching buy order
    const buyOrder = sellOrder.buildMatching(router.address);

    await sellOrder.checkFillability(ethers.provider);

    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, chainId);

    const sellerWethBalanceBefore = await weth.getBalance(seller.address);
    const sellerNftBalanceBefore = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerNftBalanceBefore).to.eq(1);
    expect(buyerNftBalanceBefore).to.eq(0);

    const tx = exchange.matchTransaction(buyer.address, sellOrder, buyOrder);
    await router
      .connect(buyer)
      .singleERC1155ListingFill(
        referrer.address,
        tx.data,
        ExchangeKind.LOOKS_RARE,
        sellOrder.params.collection,
        sellOrder.params.tokenId,
        1,
        {
          value: tx.value,
        }
      );

    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const sellerNftBalanceAfter = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerWethBalanceAfter.sub(sellerWethBalanceBefore)).to.eq(
      price.sub(price.mul(fee).div(10000))
    );
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(1);
  });

  it("LooksRare - fill bid", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1");
    const boughtTokenId = 0;

    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the token transfer proxy for the buyer
    await weth.approve(buyer, Sdk.LooksRare.Addresses.Exchange[chainId]);

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(boughtTokenId);

    const exchange = new Sdk.LooksRare.Exchange(chainId);
    const builder = new Sdk.LooksRare.Builders.SingleToken(chainId);

    // Build buy order
    let buyOrder = builder.build({
      isOrderAsk: false,
      signer: buyer.address,
      collection: erc1155.address,
      tokenId: boughtTokenId,
      price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
      nonce: await exchange.getNonce(ethers.provider, buyer.address),
    });
    await buyOrder.sign(buyer);

    // Create matching sell order
    const sellOrder = buyOrder.buildMatching(router.address);

    await buyOrder.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerNftBalanceBefore = await erc1155.balanceOf(
      seller.address,
      boughtTokenId
    );
    const buyerNftBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      boughtTokenId
    );
    expect(sellerNftBalanceBefore).to.eq(1);
    expect(buyerNftBalanceBefore).to.eq(0);

    const tx = exchange.matchTransaction(buyer.address, buyOrder, sellOrder);
    await erc1155
      .connect(seller)
      ["safeTransferFrom(address,address,uint256,uint256,bytes)"](
        seller.address,
        router.address,
        boughtTokenId,
        1,
        router.interface.encodeFunctionData("singleERC1155BidFill", [
          referrer.address,
          tx.data,
          ExchangeKind.LOOKS_RARE,
          buyOrder.params.collection,
          true,
        ])
      );

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerNftBalanceAfter = await erc1155.balanceOf(
      seller.address,
      boughtTokenId
    );
    const buyerNftBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      boughtTokenId
    );
    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.eq(price);
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(1);
  });

  it("ZeroExV4 - fill listing", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(soldTokenId);

    // Approve the exchange
    await erc1155
      .connect(seller)
      .setApprovalForAll(Sdk.ZeroExV4.Addresses.Exchange[chainId], true);

    const exchange = new Sdk.ZeroExV4.Exchange(chainId);
    const builder = new Sdk.ZeroExV4.Builders.SingleToken(chainId);

    // Build sell order
    let sellOrder = builder.build({
      direction: "sell",
      maker: seller.address,
      contract: erc1155.address,
      tokenId: soldTokenId,
      amount: 1,
      price,
      expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await sellOrder.sign(seller);

    // Create matching buy order
    const buyOrder = sellOrder.buildMatching({ amount: 1 });

    await sellOrder.checkFillability(ethers.provider);

    const sellerEthBalanceBefore = await seller.getBalance();
    const sellerNftBalanceBefore = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerNftBalanceBefore).to.eq(1);
    expect(buyerNftBalanceBefore).to.eq(0);

    const tx = exchange.matchTransaction(buyer.address, sellOrder, buyOrder, {
      noDirectTransfer: true,
    });
    await router
      .connect(buyer)
      .singleERC1155ListingFill(
        referrer.address,
        tx.data,
        ExchangeKind.ZEROEX_V4,
        sellOrder.params.nft,
        sellOrder.params.nftId,
        1,
        {
          value: tx.value,
        }
      );

    const sellerEthBalanceAfter = await seller.getBalance();
    const sellerNftBalanceAfter = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.eq(price);
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(1);
  });

  it.only("ZeroExV4 - fill listings (batch buy)", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(soldTokenId);
    await erc1155.connect(seller).mint(soldTokenId);

    // Approve the exchange
    await erc1155
      .connect(seller)
      .setApprovalForAll(Sdk.ZeroExV4.Addresses.Exchange[chainId], true);

    const exchange = new Sdk.ZeroExV4.Exchange(chainId);
    const builder = new Sdk.ZeroExV4.Builders.SingleToken(chainId);

    const sellOrders: Sdk.ZeroExV4.Order[] = [];
    const buyOrders: Sdk.ZeroExV4.Types.MatchParams[] = [];
    for (let i = 0; i < 2; i++) {
      // Build sell order
      let sellOrder = builder.build({
        direction: "sell",
        maker: seller.address,
        contract: erc1155.address,
        tokenId: soldTokenId,
        amount: 1,
        price,
        expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
      });
      await sellOrder.sign(seller);

      await sellOrder.checkFillability(ethers.provider);

      sellOrders.push(sellOrder);

      const buyOrder = sellOrder.buildMatching({ amount: 1 });
      buyOrders.push(buyOrder);
    }

    const sellerEthBalanceBefore = await seller.getBalance();
    const sellerNftBalanceBefore = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerNftBalanceBefore).to.eq(2);
    expect(buyerNftBalanceBefore).to.eq(0);

    const tx = exchange.batchBuyTransaction(
      buyer.address,
      sellOrders,
      buyOrders
    );
    await router.connect(buyer).batchERC1155ListingFill(
      referrer.address,
      tx.data,
      ExchangeKind.ZEROEX_V4,
      sellOrders.map((sellOrder) => sellOrder.params.nft),
      sellOrders.map((sellOrder) => sellOrder.params.nftId),
      sellOrders.map((_) => 1),
      {
        value: tx.value,
      }
    );

    const sellerEthBalanceAfter = await seller.getBalance();
    const sellerNftBalanceAfter = await erc1155.balanceOf(
      seller.address,
      soldTokenId
    );
    const buyerNftBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      soldTokenId
    );
    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.eq(
      price.mul(2)
    );
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(2);
  });

  it("ZeroExV4 - fill bid", async () => {
    const buyer = alice;
    const seller = bob;

    const price = parseEther("1");
    const boughtTokenId = 0;

    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, 1);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Sdk.ZeroExV4.Addresses.Exchange[1]);

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(boughtTokenId);

    const exchange = new Sdk.ZeroExV4.Exchange(chainId);
    const builder = new Sdk.ZeroExV4.Builders.SingleToken(chainId);

    // Build buy order
    const buyOrder = builder.build({
      direction: "buy",
      maker: buyer.address,
      contract: erc1155.address,
      tokenId: boughtTokenId,
      amount: 1,
      price,
      expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await buyOrder.sign(buyer);

    // Create matching sell order
    const sellOrder = buyOrder.buildMatching({
      amount: 1,
      unwrapNativeToken: false,
    });

    await buyOrder.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerNftBalanceBefore = await erc1155.balanceOf(
      seller.address,
      boughtTokenId
    );
    const buyerNftBalanceBefore = await erc1155.balanceOf(
      buyer.address,
      boughtTokenId
    );
    expect(sellerNftBalanceBefore).to.eq(1);
    expect(buyerNftBalanceBefore).to.eq(0);

    const tx = exchange.matchTransaction(buyer.address, buyOrder, sellOrder, {
      noDirectTransfer: true,
    });
    await erc1155
      .connect(seller)
      ["safeTransferFrom(address,address,uint256,uint256,bytes)"](
        seller.address,
        router.address,
        boughtTokenId,
        1,
        router.interface.encodeFunctionData("singleERC1155BidFill", [
          referrer.address,
          tx.data,
          ExchangeKind.ZEROEX_V4,
          buyOrder.params.nft,
          true,
        ])
      );

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerNftBalanceAfter = await erc1155.balanceOf(
      seller.address,
      boughtTokenId
    );
    const buyerNftBalanceAfter = await erc1155.balanceOf(
      buyer.address,
      boughtTokenId
    );
    expect(buyerWethBalanceBefore.sub(buyerWethBalanceAfter)).to.eq(price);
    expect(sellerNftBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(1);
  });
});
