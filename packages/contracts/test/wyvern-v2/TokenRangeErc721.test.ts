import { Interface } from "@ethersproject/abi";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { Builders, Exchange, Order, Types } from "@reservoir/sdk/src/wyvern-v2";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getCurrentTimestamp, maxUint256 } from "../utils";

import ExchangeAbi from "@reservoir/sdk/src/wyvern-v2/abis/Exchange.json";
import ProxyRegistryAbi from "@reservoir/sdk/src/wyvern-v2/abis/ProxyRegistry.json";

describe("WyvernV2 - TokenRangeErc721", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let proxyRegistry: Contract;
  let tokenTransferProxy: Contract;
  let exchange: Contract;

  let erc20: Contract;
  let erc721: Contract;

  let verifier: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    exchange = new Contract(
      "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b",
      ExchangeAbi as any,
      ethers.provider
    );

    proxyRegistry = new Contract(
      "0xa5409ec958c83c3f309868babaca7c86dcb077c1",
      ProxyRegistryAbi as any,
      ethers.provider
    );

    tokenTransferProxy = new Contract(
      "0xe5c783ee536cf5e63e792988335c4255169be4e1",
      new Interface([]),
      ethers.provider
    );

    erc20 = await ethers
      .getContractFactory("MockERC20", deployer)
      .then((factory) => factory.deploy());

    erc721 = await ethers
      .getContractFactory("MockERC721", deployer)
      .then((factory) => factory.deploy());

    const bytesUtils = await ethers
      .getContractFactory("BytesUtils", deployer)
      .then((factory) => factory.deploy());

    verifier = await ethers
      .getContractFactory("TokenRangeVerifier", {
        signer: deployer,
        libraries: {
          BytesUtils: bytesUtils.address,
        },
      })
      .then((factory) => factory.deploy());
  });

  it("build and match buy order", async () => {
    const buyer = alice;
    const seller = bob;
    const feeRecipient = carol;

    const price = parseEther("1");
    const fee = 250;
    const soldTokenId = 1;

    // Mint erc20 to buyer
    await erc20.connect(buyer).mint(price);

    // Approve the token transfer proxy for the buyer
    await erc20.connect(buyer).approve(tokenTransferProxy.address, maxUint256);

    // Approve the token transfer proxy for the seller
    await erc20.connect(seller).approve(tokenTransferProxy.address, maxUint256);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    // Register user proxy for the seller
    await proxyRegistry.connect(seller).registerProxy();
    const proxy = await proxyRegistry.proxies(seller.address);

    // Approve the user proxy
    await erc721.connect(seller).setApprovalForAll(proxy, true);

    // Build buy order
    let buyOrder = Builders.TokenRangeErc721.build({
      exchange: exchange.address,
      maker: buyer.address,
      target: erc721.address,
      startTokenId: 0,
      endTokenId: 2,
      staticTarget: verifier.address,
      side: Types.Side.BUY,
      paymentToken: erc20.address,
      basePrice: price,
      fee,
      feeRecipient: feeRecipient.address,
      listingTime: await getCurrentTimestamp(ethers.provider),
    })!;

    // Sign the order
    buyOrder = await Order.sign(buyer, buyOrder);

    // Create matching sell order
    const sellOrder = Builders.TokenRangeErc721.buildMatching({
      order: buyOrder,
      taker: seller.address,
      tokenId: soldTokenId,
    })!;
    sellOrder.listingTime = await getCurrentTimestamp(ethers.provider);

    const buyerBalanceBefore = await erc20.balanceOf(buyer.address);
    const sellerBalanceBefore = await erc20.balanceOf(seller.address);
    const feeRecipientBalanceBefore = await erc20.balanceOf(
      feeRecipient.address
    );
    const ownerBefore = await erc721.ownerOf(soldTokenId);

    expect(buyerBalanceBefore).to.eq(price);
    expect(sellerBalanceBefore).to.eq(0);
    expect(feeRecipientBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await Exchange.match(seller, buyOrder, sellOrder);

    const buyerBalanceAfter = await erc20.balanceOf(buyer.address);
    const sellerBalanceAfter = await erc20.balanceOf(seller.address);
    const feeRecipientBalanceAfter = await erc20.balanceOf(
      feeRecipient.address
    );
    const ownerAfter = await erc721.ownerOf(soldTokenId);

    expect(buyerBalanceAfter).to.eq(0);
    expect(sellerBalanceAfter).to.eq(price.sub(price.mul(fee).div(10000)));
    expect(feeRecipientBalanceAfter).to.eq(price.mul(fee).div(10000));
    expect(ownerAfter).to.eq(buyer.address);
  });
});
