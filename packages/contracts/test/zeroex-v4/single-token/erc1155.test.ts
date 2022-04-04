import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as ZeroexV4 from "@reservoir0x/sdk/src/zeroex-v4";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getCurrentTimestamp } from "../../utils";

describe("ZeroEx V4 - SingleToken Erc1155", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let erc1155: Contract;

  beforeEach(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    erc1155 = await ethers
      .getContractFactory("MockERC1155", deployer)
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
    await weth.approve(buyer, ZeroexV4.Addresses.Exchange[1]);

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(boughtTokenId);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    const exchange = new ZeroexV4.Exchange(1);

    const builder = new ZeroexV4.Builders.SingleToken(1);

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

    // Sign the order
    await buyOrder.sign(buyer);

    // Create matching sell order
    const sellOrder = buyOrder.buildMatching({ amount: 1 });

    await buyOrder.checkFillability(ethers.provider);

    const buyerWethBalanceBefore = await weth.getBalance(buyer.address);
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      boughtTokenId
    );
    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      boughtTokenId
    );

    expect(buyerWethBalanceBefore).to.eq(price);
    expect(buyerNftBalanceBefore).to.eq(0);
    expect(sellerNftBalanceBefore).to.eq(1);

    // Match orders
    await exchange.match(seller, buyOrder, sellOrder);

    const buyerWethBalanceAfter = await weth.getBalance(buyer.address);
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      boughtTokenId
    );
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      boughtTokenId
    );

    expect(buyerWethBalanceAfter).to.eq(0);
    expect(buyerNftBalanceAfter).to.eq(1);
    expect(sellerNftBalanceAfter).to.eq(0);
  });

  it("build and match sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc1155 to seller
    await erc1155.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc1155(ethers.provider, erc1155.address);

    // Approve the exchange
    await nft.approve(seller, ZeroexV4.Addresses.Exchange[1]);

    const exchange = new ZeroexV4.Exchange(1);

    const builder = new ZeroexV4.Builders.SingleToken(1);

    // Build sell order
    const sellOrder = builder.build({
      direction: "sell",
      maker: seller.address,
      contract: erc1155.address,
      tokenId: soldTokenId,
      amount: 1,
      price,
      expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
    });

    // Sign the order
    await sellOrder.sign(seller);

    // Create matching buy order
    const buyOrder = sellOrder.buildMatching({ amount: 1 });

    await sellOrder.checkFillability(ethers.provider);

    const buyerEthBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const buyerNftBalanceBefore = await nft.getBalance(
      buyer.address,
      soldTokenId
    );
    const sellerNftBalanceBefore = await nft.getBalance(
      seller.address,
      soldTokenId
    );

    expect(buyerNftBalanceBefore).to.eq(0);
    expect(sellerNftBalanceBefore).to.eq(1);

    // Match orders
    await exchange.match(buyer, sellOrder, buyOrder);

    const buyerEthBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const buyerNftBalanceAfter = await nft.getBalance(
      buyer.address,
      soldTokenId
    );
    const sellerNftBalanceAfter = await nft.getBalance(
      seller.address,
      soldTokenId
    );

    expect(buyerEthBalanceBefore.sub(buyerEthBalanceAfter)).to.be.gt(price);
    expect(sellerEthBalanceAfter).to.eq(sellerEthBalanceBefore.add(price));
    expect(buyerNftBalanceAfter).to.eq(1);
    expect(sellerNftBalanceAfter).to.eq(0);
  });
});
