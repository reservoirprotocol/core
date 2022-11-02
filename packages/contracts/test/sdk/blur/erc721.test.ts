import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Blur from "@reservoir0x/sdk/src/blur";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  getChainId,
  getCurrentTimestamp,
  reset,
  setupNFTs,
} from "../../utils";

describe("Blur - SingleToken Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let ted: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, ted] = await ethers.getSigners();
    ({ erc721 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("Build and fill buy order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const boughtTokenId = 0;

    // const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // // Mint weth to buyer
    // await weth.deposit(buyer, price);

    // // Approve the exchange contract for the buyer
    // await weth.approve(buyer, Blur.Addresses.Exchange[chainId]);

    // // Mint erc721 to seller
    // await erc721.connect(seller).mint(boughtTokenId);

    // const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    console.log("chainId", chainId)
    const exchange = new Blur.Exchange(chainId);

    const builder = new Blur.Builders.SingleToken(chainId);

    const inputData = exchange.contract.interface.decodeFunctionData("execute", `0x9a1fc3a70000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000001b602a8015af4f4f897adde7cc5ec0701f422789b4828ac0f1899ee245764c3884739c1b50aaddb4b4f2a1c602976997d99e9968f39dff0ec282eea5b753534a2c000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f23eb100000000000000000000000029e44b41e191531b07d6b5cb9e03c3bece1373aa000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000006411739da1c40b106f8511de5d1fac0000000000000000000000003fe1a4c1481c8351e91b64d5c398b159de07cbc50000000000000000000000000000000000000000000000000000000000000c820000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003311fc80a57000000000000000000000000000000000000000000000000000000000000635e83ff000000000000000000000000000000000000000000000000000000006367be7e00000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000002b909f741233a66b1750c4e867ae7675000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000064000000000000000000000000aae014af95d811ad7dbff60209e74551a338f64c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f23eb10000000000000000000000002128f6d85dfdd6cf1b92eebf38eab41716e5becd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006411739da1c40b106f8511de5d1fac0000000000000000000000003fe1a4c1481c8351e91b64d5c398b159de07cbc50000000000000000000000000000000000000000000000000000000000000c820000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003311fc80a5700000000000000000000000000000000000000000000000000000000000063611e6a0000000000000000000000000000000000000000000000000000000063613a8a00000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000009a0ed79db7e1083b50890a647607f64900000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`);

    console.log('sell', inputData.sell[0])
    console.log('buy', inputData.buy[0])

    const sellOrder = inputData.sell[0]

    const curTimestamp = (await getCurrentTimestamp(ethers.provider));
    console.log("curTimestamp", curTimestamp)

    function getOrder(sellOrder: any) {
      return {
        side: sellOrder.side === 1 ? "sell" : "buy",
        trader: sellOrder.trader,
        collection: sellOrder.collection,
        tokenId: sellOrder.tokenId.toString(),
        amount: sellOrder.amount.toString(),
        paymentToken: sellOrder.paymentToken,
        price: sellOrder.price.toString(),
        listingTime: sellOrder.listingTime.toString(),
        matchingPolicy: sellOrder.matchingPolicy,
        nonce: 0,
        expirationTime: sellOrder.expirationTime.toString(),
        fees: sellOrder.fees.map((_:any) => {
          return {
            rate: _.rate,
            recipient: _.recipient
          }
        }),
        salt: sellOrder.salt.toString(),
        extraParams: sellOrder.extraParams
      }
    }

    console.log('sellOrder', getOrder(sellOrder))
    console.log('buyOrder', getOrder(inputData.buy[0]))

    // Build buy order
    const buyOrder = builder.build({
      side: "sell",
      trader: sellOrder.trader,
      collection: sellOrder.collection,
      tokenId: sellOrder.tokenId.toString(),
      amount: sellOrder.amount.toString(),
      paymentToken: sellOrder.paymentToken,
      price: sellOrder.price.toString(),
      listingTime: sellOrder.listingTime.toString(),
      matchingPolicy: sellOrder.matchingPolicy,
      nonce: 0,
      expirationTime: sellOrder.expirationTime.toString(),
      fees: sellOrder.fees.map((_:any) => {
        return {
          rate: _.rate,
          recipient: _.recipient
        }
      }),
      salt: sellOrder.salt.toString(),
      extraParams: sellOrder.extraParams
    });

    const tx = await ethers.provider.getTransactionReceipt('0xc02aa94cd1b594d93afd2e5ea7890402f3b38329abdb5f188bf449ebb4dbd12a');

    console.log(buyOrder.hash())

    const eventData = exchange.contract.interface.decodeEventLog('OrdersMatched', tx.logs[3].data);
    console.log("OrdersMatched",eventData.sellHash)
    // console.log("OrdersMatched",eventData.sell)
    // const buyOrder = new Blur.Order(chainId, {
    //   side: Blur.Types.TradeDirection.BUY,
    //   collection: erc721.address,
    //   tokenId: String(boughtTokenId),
    // })

    // Sign the order
    // await buyOrder.sign(buyer);

    // // Approve the exchange for escrowing.
    // await erc721
    //   .connect(seller)
    //   .setApprovalForAll(Element.Addresses.Exchange[chainId], true);

    // // Create matching sell order
    // const sellOrder = buyOrder.buildMatching();

    // await buyOrder.checkFillability(ethers.provider);

    // const buyerBalanceBefore = await weth.getBalance(buyer.address);

    // const ownerBefore = await nft.getOwner(boughtTokenId);

    // expect(buyerBalanceBefore).to.eq(price);
    // expect(ownerBefore).to.eq(seller.address);

    // // Match orders
    // await exchange.fillOrder(seller, buyOrder, sellOrder);

    // const buyerBalanceAfter = await weth.getBalance(buyer.address);
    // const ownerAfter = await nft.getOwner(boughtTokenId);

    // expect(buyerBalanceAfter).to.eq(0);
    // expect(ownerAfter).to.eq(buyer.address);
  });

  it("Build and fill sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Blur.Addresses.Exchange[chainId]);


    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the exchange
    await nft.approve(seller, Blur.Addresses.ExecutionDelegate[chainId]);

    const exchange = new Blur.Exchange(chainId);

    const curTimestamp = (await getCurrentTimestamp(ethers.provider));
    console.log("curTimestamp", curTimestamp)

    const builder = new Blur.Builders.SingleToken(chainId);

    // Build sell order
    // const sellOrder = builder.build({
    //   direction: "sell",
    //   maker: seller.address,
    //   contract: erc721.address,
    //   tokenId: soldTokenId,
    //   paymentToken: Element.Addresses.Eth[chainId],
    //   price,
    //   hashNonce: 0,
    //   expiry: (await getCurrentTimestamp(ethers.provider)) + 100,
    // });


    const sellOrder = builder.build({
      side: "sell",
      trader: seller.address,
      collection: erc721.address,
      tokenId: soldTokenId,
      amount: 1,
      paymentToken: Common.Addresses.Eth[chainId],
      price,
      listingTime: curTimestamp,
      matchingPolicy: Blur.Addresses.StandardPolicyERC721[chainId],
      nonce: 0,
      expirationTime: curTimestamp + 86400,
      fees: [],
      salt: 0,
      extraParams: '0x'
    });

    // Sign the order
    await sellOrder.sign(seller);

    // Approve the exchange for escrowing.
    await erc721
      .connect(seller)
      .setApprovalForAll(Blur.Addresses.ExecutionDelegate[chainId], true);

    // Create matching buy order
    const buyOrder = sellOrder.buildMatching();
    console.log("buyOrder", buyOrder)
    // return;

    // await sellOrder.checkFillability(ethers.provider);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, buyOrder);

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerBalanceBefore.sub(buyerBalanceAfter)).to.be.gt(price);
    expect(sellerBalanceAfter).to.eq(sellerBalanceBefore.add(price));
    expect(ownerAfter).to.eq(buyer.address);
  });

  // it("Build and fill buy order with fees", async () => {
  //   const buyer = alice;
  //   const seller = bob;
  //   const price = parseEther("1");
  //   const boughtTokenId = 0;

  //   const weth = new Common.Helpers.Weth(ethers.provider, chainId);

  //   // Mint weth to buyer
  //   await weth.deposit(buyer, price.add(parseEther("0.15")));

  //   // Approve the exchange contract for the buyer
  //   await weth.approve(buyer, Element.Addresses.Exchange[chainId]);

  //   // Mint erc721 to seller
  //   await erc721.connect(seller).mint(boughtTokenId);

  //   const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

  //   const exchange = new Element.Exchange(chainId);

  //   const builder = new Element.Builders.SingleToken(chainId);

  //   // Build buy order
  //   const buyOrder = builder.build({
  //     direction: "buy",
  //     maker: buyer.address,
  //     contract: erc721.address,
  //     tokenId: boughtTokenId,
  //     paymentToken: Common.Addresses.Weth[chainId],
  //     price,
  //     hashNonce: 0,
  //     fees: [
  //       {
  //         recipient: carol.address,
  //         amount: parseEther("0.1"),
  //       },
  //       {
  //         recipient: ted.address,
  //         amount: parseEther("0.05"),
  //       },
  //     ],
  //     expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
  //   });

  //   // Sign the order
  //   await buyOrder.sign(buyer);

  //   // Approve the exchange for escrowing.
  //   await erc721
  //   .connect(seller)
  //   .setApprovalForAll(Element.Addresses.Exchange[chainId], true);

  //   // Create matching sell order
  //   const sellOrder = buyOrder.buildMatching();

  //   await buyOrder.checkFillability(ethers.provider);

  //   const buyerBalanceBefore = await weth.getBalance(buyer.address);
  //   const ownerBefore = await nft.getOwner(boughtTokenId);

  //   expect(buyerBalanceBefore).to.eq(price.add(parseEther("0.15")));
  //   expect(ownerBefore).to.eq(seller.address);

  //   // Match orders
  //   await exchange.fillOrder(seller, buyOrder, sellOrder);

  //   const buyerBalanceAfter = await weth.getBalance(buyer.address);
  //   const carolBalanceAfter = await weth.getBalance(carol.address);
  //   const tedBalanceAfter = await weth.getBalance(ted.address);
  //   const ownerAfter = await nft.getOwner(boughtTokenId);

  //   expect(buyerBalanceAfter).to.eq(0);
  //   expect(carolBalanceAfter).to.eq(parseEther("0.1"));
  //   expect(tedBalanceAfter).to.eq(parseEther("0.05"));
  //   expect(ownerAfter).to.eq(buyer.address);
  // });

  // it("Build and fill sell order with fees", async () => {
  //   const buyer = alice;
  //   const seller = bob;
  //   const price = parseEther("1");
  //   const soldTokenId = 0;

  //   // Mint erc721 to seller
  //   await erc721.connect(seller).mint(soldTokenId);

  //   const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

  //   // Approve the exchange
  //   await nft.approve(seller, Element.Addresses.Exchange[chainId]);

  //   const exchange = new Element.Exchange(chainId);

  //   const builder = new Element.Builders.SingleToken(chainId);

  //   // Build sell order
  //   const sellOrder = builder.build({
  //     direction: "sell",
  //     maker: seller.address,
  //     contract: erc721.address,
  //     tokenId: soldTokenId,
  //     paymentToken: Element.Addresses.Eth[chainId],
  //     price,
  //     hashNonce: 0,
  //     fees: [
  //       {
  //         recipient: carol.address,
  //         amount: parseEther("0.1"),
  //       },
  //       {
  //         recipient: ted.address,
  //         amount: parseEther("0.05"),
  //       },
  //     ],
  //     expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
  //   });

  //   // Sign the order
  //   await sellOrder.sign(seller);

  //   // Approve the exchange for escrowing.
  //   await erc721
  //   .connect(seller)
  //   .setApprovalForAll(Element.Addresses.Exchange[chainId], true);

  //   // Create matching buy order
  //   const buyOrder = sellOrder.buildMatching();

  //   await sellOrder.checkFillability(ethers.provider);

  //   const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
  //   const sellerBalanceBefore = await ethers.provider.getBalance(
  //     seller.address
  //   );
  //   const carolBalanceBefore = await ethers.provider.getBalance(carol.address);
  //   const tedBalanceBefore = await ethers.provider.getBalance(ted.address);
  //   const ownerBefore = await nft.getOwner(soldTokenId);

  //   expect(ownerBefore).to.eq(seller.address);

  //   // Match orders
  //   await exchange.fillOrder(buyer, sellOrder, buyOrder, {
  //     referrer: "reservoir.market",
  //   });

  //   const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
  //   const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
  //   const carolBalanceAfter = await ethers.provider.getBalance(carol.address);
  //   const tedBalanceAfter = await ethers.provider.getBalance(ted.address);
  //   const ownerAfter = await nft.getOwner(soldTokenId);

  //   expect(buyerBalanceBefore.sub(buyerBalanceAfter)).to.be.gt(
  //     price.add(parseEther("0.15"))
  //   );
  //   expect(carolBalanceAfter.sub(carolBalanceBefore)).to.eq(parseEther("0.1"));
  //   expect(tedBalanceAfter.sub(tedBalanceBefore)).to.eq(parseEther("0.05"));
  //   expect(sellerBalanceAfter).to.eq(sellerBalanceBefore.add(price));
  //   expect(ownerAfter).to.eq(buyer.address);
  // });
});
