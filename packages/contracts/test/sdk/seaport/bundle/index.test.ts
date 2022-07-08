import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Seaport from "@reservoir0x/sdk/src/seaport";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  getChainId,
  getCurrentTimestamp,
  reset,
  setupNFTs,
} from "../../../utils";

describe("Seaport - Bundles", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let erc721: Contract;
  let erc1155: Contract;

  beforeEach(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    ({ erc721, erc1155 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("Build and fill sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");

    const items = [
      {
        tokenKind: "erc721",
        contract: erc721.address,
        tokenId: 1,
        amount: 1,
      },
      {
        tokenKind: "erc721",
        contract: erc721.address,
        tokenId: 2,
        amount: 1,
      },
      {
        tokenKind: "erc1155",
        contract: erc1155.address,
        tokenId: 1,
        amount: 1,
      },
    ];

    for (const item of items) {
      if (item.tokenKind === "erc721") {
        await erc721.connect(seller).mint(item.tokenId);
        await erc721
          .connect(seller)
          .setApprovalForAll(Seaport.Addresses.Exchange[chainId], true);
      } else {
        await erc1155.connect(seller).mint(item.tokenId);
        await erc1155
          .connect(seller)
          .setApprovalForAll(Seaport.Addresses.Exchange[chainId], true);
      }
    }

    const exchange = new Seaport.Exchange(chainId);
    const builder = new Seaport.Builders.Bundle(chainId);

    // Build sell order
    const sellOrder = builder.build({
      items: items as any,
      side: "sell",
      offerer: seller.address,
      paymentToken: Common.Addresses.Eth[chainId],
      price,
      counter: 0,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await sellOrder.sign(seller);

    // Create matching params
    const matchParams = sellOrder.buildMatching();

    const buyerEthBalanceBefore = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const ownerBefore1 = await erc721.ownerOf(items[0].tokenId);
    const ownerBefore2 = await erc721.ownerOf(items[1].tokenId);
    const balanceBefore3 = await erc1155.balanceOf(
      seller.address,
      items[2].tokenId
    );

    expect(ownerBefore1).to.eq(seller.address);
    expect(ownerBefore2).to.eq(seller.address);
    expect(balanceBefore3).to.eq(1);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder, matchParams);

    const buyerEthBalanceAfter = await ethers.provider.getBalance(
      buyer.address
    );
    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const ownerAfter1 = await erc721.ownerOf(items[0].tokenId);
    const ownerAfter2 = await erc721.ownerOf(items[1].tokenId);
    const balanceAfter3 = await erc1155.balanceOf(
      buyer.address,
      items[2].tokenId
    );

    expect(buyerEthBalanceBefore.sub(buyerEthBalanceAfter)).to.be.gt(price);
    expect(sellerEthBalanceAfter).to.eq(sellerEthBalanceBefore.add(price));
    expect(ownerAfter1).to.eq(buyer.address);
    expect(ownerAfter2).to.eq(buyer.address);
    expect(balanceAfter3).to.eq(1);
  });
});
