import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Manifold from "@reservoir0x/sdk/src/manifold";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getChainId, reset, setupNFTs } from "../../../utils";
import { Flags, ListingType, Spec } from "@reservoir0x/sdk/src/manifold/types";
import * as Common from "@reservoir0x/sdk/src/common";
import { BigNumber, constants, utils } from "ethers";

describe("Manifold - SingleToken Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("Manifold - Fill sell order", async () => {
    const seller = alice;
    const buyer = bob;
    const referrer = carol;
    const tokenId = 99;
    const price = parseEther("1");

    // Mint erc721 to the seller.
    await erc721.connect(seller).mint(tokenId);

    const contract = erc721.connect(seller).address;

    const exchange = new Manifold.Exchange(chainId);

    // Approve the exchange for escrowing.
    await erc721
      .connect(seller)
      .setApprovalForAll(exchange.contract.address, true);

    expect(await erc721.ownerOf(tokenId), seller.address);

    // Create sell order.
    const order = new Manifold.Order(chainId, {
      address: seller.address,
      flags: Flags.FLAG_MASK_TOKEN_CREATOR,
      totalSold: 0,
      marketplaceBPS: 0,
      referrerBPS: 0,
      listingDetails: {
        initialAmount: price.toString(),
        type_: ListingType.FIXED_PRICE,
        totalAvailable: 1,
        totalPerSale: 1,
        extensionInterval: 0,
        minIncrementBPS: 0,
        erc20: constants.AddressZero,
        identityVerifier: constants.AddressZero,
        startTime: 0,
        endTime: Math.floor(Date.now() / 1000) + 36000,
      },
      tokenDetails: {
        id: tokenId,
        address_: contract,
        spec: Spec.ERC721,
        lazy: false,
      },
      listingReceivers: [],
      bid: null,
      deliveryFees: {
        deliverBPS: 0,
        deliverFixed: 0,
      },
    });
    const tx = await exchange.createOrder(seller, order);
    const receipt = await tx.wait();

    // Manifold escrows the NFT when creating sell orders.
    expect(await erc721.ownerOf(tokenId), exchange.contract.address);

    const sellerEthBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );
    const referrerEthBalanceBefore = await ethers.provider.getBalance(
      referrer.address
    );

    // Fill sell order.
    const tx2 = await exchange.fillOrder(
      referrer,
      596,
      order.params.listingDetails.totalAvailable,
      order.params.listingDetails.initialAmount,
      {
        source: "reservoir.market",
        nativeReferrerAddress: referrer.address,
      }
    );
    const tx2Receipt = await tx2.wait();

    expect(await erc721.ownerOf(tokenId), referrer.address);

    const sellerEthBalanceAfter = await ethers.provider.getBalance(
      seller.address
    );
    const referrerEthBalanceAfter = await ethers.provider.getBalance(
      referrer.address
    );
    tx2Receipt.gasUsed.mul(tx2Receipt.effectiveGasPrice);
    const gasPrice = tx2Receipt.gasUsed.mul(tx2Receipt.effectiveGasPrice);

    expect(sellerEthBalanceAfter.sub(price)).to.eq(sellerEthBalanceBefore);
    expect(referrerEthBalanceBefore.sub(gasPrice.add(price))).to.eq(
      referrerEthBalanceAfter
    );
  });
});
