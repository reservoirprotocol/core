import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Seaport from "@reservoir0x/sdk/src/seaport";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getCurrentTimestamp } from "../../../utils";

describe("Seaport - SingleToken Erc721", () => {
  let chainId: number;

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    chainId = (network.config as any).forking?.url.includes("rinkeby") ? 4 : 1;
    [deployer, alice, bob] = await ethers.getSigners();

    erc721 = await ethers
      .getContractFactory("MockERC721", deployer)
      .then((factory) => factory.deploy());
  });

  afterEach(async () => {
    if ((network.config as any).forking) {
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
    }
  });

  it("build and match sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const soldTokenId = 0;

    // Mint erc721 to seller
    await erc721.connect(seller).mint(soldTokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the exchange
    await nft.approve(seller, Seaport.Addresses.Exchange[chainId]);

    const exchange = new Seaport.Exchange(chainId);

    const builder = new Seaport.Builders.SingleToken(chainId);

    // Build sell order
    const sellOrder = builder.build({
      side: "sell",
      tokenKind: "erc721",
      offerer: seller.address,
      contract: erc721.address,
      tokenId: soldTokenId,
      paymentToken: Common.Addresses.Eth[chainId],
      price,
      nonce: 0,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });

    // Sign the order
    await sellOrder.sign(seller);

    await sellOrder.checkFillability(ethers.provider);

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const ownerBefore = await nft.getOwner(soldTokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Match orders
    await exchange.fillOrder(buyer, sellOrder);

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const ownerAfter = await nft.getOwner(soldTokenId);

    expect(buyerBalanceBefore.sub(buyerBalanceAfter)).to.be.gt(price);
    expect(sellerBalanceAfter).to.eq(sellerBalanceBefore.add(price));
    expect(ownerAfter).to.eq(buyer.address);
  });
});
