import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as WyvernV2 from "@reservoir0x/sdk/src/wyvern-v2";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getCurrentTimestamp } from "../utils";

describe("WyvernV2 - TokenListErc1155", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc1155: Contract;

  let verifier: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    erc1155 = await ethers
      .getContractFactory("MockERC1155", deployer)
      .then((factory) => factory.deploy());

    const bytesUtils = await ethers
      .getContractFactory("BytesUtils", deployer)
      .then((factory) => factory.deploy());

    verifier = await ethers
      .getContractFactory("TokenListVerifier", {
        signer: deployer,
        libraries: {
          BytesUtils: bytesUtils.address,
        },
      })
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
    const boughtTokenIds = Array.from(Array(100).keys());
    const soldTokenId = 50;

    const weth = new Common.Helpers.Weth(ethers.provider, 1);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the token transfer proxy for the buyer
    await weth.approve(buyer, WyvernV2.Addresses.TokenTransferProxy[1]);

    // Approve the token transfer proxy for the seller
    await weth.approve(seller, WyvernV2.Addresses.TokenTransferProxy[1]);

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(soldTokenId);

    // Register user proxy for the seller
    const proxyRegistry = new WyvernV2.Helpers.ProxyRegistry(
      ethers.provider,
      1
    );
    await proxyRegistry.registerProxy(seller);
    const proxy = await proxyRegistry.getProxy(seller.address);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the user proxy
    await nft.approve(seller, proxy);

    const builder = new WyvernV2.Builders.Erc1155.TokenList(1);

    // Build buy order
    let buyOrder = builder.build({
      maker: buyer.address,
      contract: erc1155.address,
      tokenIds: boughtTokenIds,
      side: "buy",
      price,
      paymentToken: Common.Addresses.Weth[1],
      fee,
      feeRecipient: feeRecipient.address,
      listingTime: await getCurrentTimestamp(ethers.provider),
    });
    buyOrder.params.staticTarget = verifier.address;

    // buyOrder.checkValidity();

    // Sign the order
    await buyOrder.sign(buyer);

    // Create matching sell order
    const sellOrder = buyOrder.buildMatching(seller.address, [
      soldTokenId,
      boughtTokenIds,
    ]);
    sellOrder.params.listingTime = await getCurrentTimestamp(ethers.provider);

    await buyOrder.checkFillability(ethers.provider);
    await sellOrder.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const sellerWethBalanceBefore = await weth.getBalance(seller.address);
    const feeRecipientWethBalanceBefore = await weth.getBalance(
      feeRecipient.address
    );
    const buyerErc1155BalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );
    const sellerErc1155BalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );

    expect(buyerWethBalanceBefore).to.eq(price);
    expect(sellerWethBalanceBefore).to.eq(0);
    expect(feeRecipientWethBalanceBefore).to.eq(0);
    expect(buyerErc1155BalanceBefore).to.eq(0);
    expect(sellerErc1155BalanceBefore).to.eq(1);

    const exchange = new WyvernV2.Exchange(1);

    // Match orders
    await exchange.match(seller, buyOrder, sellOrder);

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const sellerWethBalanceAfter = await weth.getBalance(seller.address);
    const feeRecipientWethBalanceAfter = await weth.getBalance(
      feeRecipient.address
    );
    const buyerErc1155BalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );
    const sellerErc1155BalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );

    expect(buyerWethBalanceAfter).to.eq(0);
    expect(sellerWethBalanceAfter).to.eq(price.sub(price.mul(fee).div(10000)));
    expect(feeRecipientWethBalanceAfter).to.eq(price.mul(fee).div(10000));
    expect(buyerErc1155BalanceAfter).to.eq(1);
    expect(sellerErc1155BalanceAfter).to.eq(0);
  });
});
