import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Manifold from "@reservoir0x/sdk/src/manifold";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { bn, getChainId, reset, setupNFTs } from "../../../utils";

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

  it("Manifold - Fill ETH order", async () => {
    const seller = alice;
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
      id: "10",
      seller: seller.address,
      details: {
        type_: 2,
        initialAmount: {
          type: "BigNumber",
          hex: bn(price).toHexString(),
        },
        totalAvailable: "1",
        totalPerSale: "1",
        erc20: null,
        identityVerifier: null,
        extensionInterval: 0,
        startTime: 0,
        endTime: 1668861821,
      },
      token: {
        spec: "erc721",
        address_: erc721.address,
        id: {
          type: "BigNumber",
          hex: bn(tokenId).toHexString(),
        },
        lazy: false,
      },
      fees: {
        deliverFixed: null,
      },
    });

    const tx = await exchange.createOrder(seller, order);
    const receipt = await tx.wait();
    const id = bn(receipt.logs[2].topics[1]).toNumber();
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
      id,
      order.params.details.totalAvailable,
      order.params.details.initialAmount,
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
