import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Rarible from "@reservoir0x/sdk/src/rarible";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getChainId, reset, setupNFTs } from "../../../../utils";
import { BigNumber, constants } from "ethers";

describe("Rarible - SingleToken Bids Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let dan: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, charlie, dan] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("Rarible - Build and fill ERC721 WETH buy order no revenue splits", async () => {
    const seller = alice;
    const buyer = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Rarible.Addresses.ERC20TransferProxy[chainId]);

    const buyerBalanceBefore = await weth.getBalance(seller.address);
    const sellerBalanceBefore = await weth.getBalance(buyer.address);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.NFTTransferProxy[chainId]);

    const exchange = new Rarible.Exchange(chainId);

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build buy order
    const buyOrder = builder.build({
      maker: buyer.address,
      side: "buy",
      tokenKind: "erc721",
      contract: erc721.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: 1,
      paymentToken: Common.Addresses.Weth[chainId],
      startTime: 0,
      endTime: 0,
      orderType: Rarible.Constants.ORDER_TYPES.V2,
      dataType: Rarible.Constants.ORDER_DATA_TYPES.V3_BUY,
      payouts: [{ account: buyer.address, value: "10000" }],
      marketplaceMarker: "rarible",
    });

    // Sign the order
    await buyOrder.sign(buyer);
    await buyOrder.checkSignature();
    await buyOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(buyerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(seller, buyOrder, {
      referrer: "reservoir.market",
    });
    const buyerBalanceAfter = await weth.getBalance(seller.address);
    const sellerBalanceAfter = await weth.getBalance(buyer.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(sellerBalanceAfter).to.be.eq(0);
    expect(buyerBalanceAfter).to.eq(price);
    expect(ownerAfter).to.eq(buyer.address);
  });

  it("Rarible - Build and fill ERC721 WETH buy order with revenue splits", async () => {
    const seller = alice;
    const buyer = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    const weth = new Common.Helpers.Weth(ethers.provider, chainId);

    // Mint weth to buyer
    await weth.deposit(buyer, price);

    // Approve the exchange contract for the buyer
    await weth.approve(buyer, Rarible.Addresses.Exchange[chainId]);

    const buyerBalanceBefore = await weth.getBalance(seller.address);
    const sellerBalanceBefore = await weth.getBalance(buyer.address);

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the transfer manager
    await nft.approve(seller, Rarible.Addresses.Exchange[chainId]);

    const exchange = new Rarible.Exchange(chainId);
    const revenueSplitBpsA = "100";
    const revenueSplitBpsB = "150";

    const builder = new Rarible.Builders.SingleToken(chainId);
    // Build buy order
    const buyOrder = builder.build({
      maker: buyer.address,
      side: "buy",
      tokenKind: "erc721",
      contract: erc721.address,
      tokenId: soldTokenId.toString(),
      price: price.toString(),
      tokenAmount: 1,
      paymentToken: Common.Addresses.Weth[chainId],
      startTime: 0,
      endTime: 0,
      maxFeesBasePoint: "1000",
      fees: [
        `${charlie.address}:${revenueSplitBpsA}`,
        `${dan.address}:${revenueSplitBpsB}`,
        // {
        //   account: charlie.address,
        //   value: revenueSplitBpsA,
        // },
        // {
        //   account: dan.address,
        //   value: revenueSplitBpsB,
        // },
      ],
      payouts: [``],
    });

    // Sign the order
    await buyOrder.sign(buyer);
    await buyOrder.checkSignature();
    await buyOrder.checkFillability(ethers.provider);
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(buyerBalanceBefore).to.eq(0);
    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(seller, buyOrder, {
      referrer: "reservoir.market",
    });

    const buyerBalanceAfter = await weth.getBalance(seller.address);
    const sellerBalanceAfter = await weth.getBalance(buyer.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    let priceAfterFees = price;
    priceAfterFees = priceAfterFees.sub(
      priceAfterFees
        .mul(BigNumber.from(revenueSplitBpsA).add(revenueSplitBpsB))
        .div(10000)
    );

    expect(sellerBalanceAfter).to.be.eq(0);
    expect(buyerBalanceAfter).to.eq(priceAfterFees);
    expect(ownerAfter).to.eq(buyer.address);
  });
});
