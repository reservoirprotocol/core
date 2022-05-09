import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Foundation from "@reservoir0x/sdk/src/foundation";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("Foundation - SingleToken Erc721", () => {
  let chainId: number;

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    if (process.env.CHAIN_ID) {
      chainId = Number(process.env.CHAIN_ID);
    } else {
      chainId = (network.config as any).forking?.url.includes("rinkeby")
        ? 4
        : 1;
    }

    [deployer, alice, bob, carol] = await ethers.getSigners();

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

  it("fill sell order", async () => {
    const seller = alice;
    const buyer = bob;
    const referrer = carol;
    const tokenId = 99;
    const price = parseEther("1");

    // Mint erc721 to the seller.
    await erc721.connect(seller).mint(tokenId);

    const exchange = new Foundation.Exchange(chainId);

    // Approve the exchange for escrowing.
    await erc721
      .connect(seller)
      .setApprovalForAll(exchange.contract.address, true);

    expect(await erc721.ownerOf(tokenId), seller.address);

    // Create sell order.
    await exchange.createOrder(seller, erc721.address, tokenId, price);

    // Foundation escrows the NFT when creating sell orders.
    expect(await erc721.ownerOf(tokenId), exchange.contract.address);

    const sellerEthBalanceBefore = await seller.getBalance();
    const referrerEthBalanceBefore = await referrer.getBalance();

    // Fill sell order.
    await exchange.fillOrder(
      buyer,
      erc721.address,
      tokenId,
      price,
      referrer.address
    );

    const sellerEthBalanceAfter = await seller.getBalance();
    const referrerEthBalanceAfter = await referrer.getBalance();

    // The protocol fee is 5% of the price (minus the referrer fee).
    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.eq(
      price.mul(9500).div(10000)
    );
    // The referrer (if set) gets 20% of the protocol fee.
    expect(referrerEthBalanceAfter.sub(referrerEthBalanceBefore)).to.eq(
      price.mul(100).div(10000)
    );
  });
});
