import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  getChainId,
  getCurrentTimestamp,
  lc,
  reset,
  setupNFTs,
  setupRouter,
} from "../../utils";
import { Interface } from "ethers/lib/utils";

describe("ReservoirV6 - fill listings", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let referrer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let erc721: Contract;
  let erc1155: Contract;
  let router: Contract;
  let zeroExV4Market: Contract;
  let seaportMarket: Contract;

  beforeEach(async () => {
    [deployer, referrer, alice, bob, carol] = await ethers.getSigners();

    ({ erc721, erc1155 } = await setupNFTs(deployer));

    router = (await ethers
      .getContractFactory("ReservoirV6", deployer)
      .then((factory) => factory.deploy())) as any;
    zeroExV4Market = (await ethers
      .getContractFactory("ZeroExV4Market", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    seaportMarket = (await ethers
      .getContractFactory("SeaportMarket", deployer)
      .then((factory) => factory.deploy(router.address))) as any;

    await router.registerMarket(seaportMarket.address);
  });

  afterEach(reset);

  it("Seaport - fill single ERC721 listing", async () => {
    const seller = alice;
    const buyer = bob;
    const referrer = carol;

    const tokenId = 123;
    await erc721.connect(seller).mint(tokenId);
    await erc721
      .connect(seller)
      .setApprovalForAll(Sdk.Seaport.Addresses.Exchange[chainId], true);

    const price = parseEther("1");

    const builder = new Sdk.Seaport.Builders.SingleToken(chainId);
    const order = builder.build({
      side: "sell",
      tokenKind: "erc721",
      offerer: seller.address,
      contract: erc721.address,
      tokenId: tokenId,
      paymentToken: Sdk.Common.Addresses.Eth[chainId],
      price,
      counter: 0,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await order.sign(seller);

    const buyerEthBalanceBefore = await buyer.getBalance();
    const sellerEthBalanceBefore = await seller.getBalance();
    const referrerEthBalanceBefore = await referrer.getBalance();

    const ethPaidOnGas = await router
      .connect(buyer)
      .fillListing(
        referrer.address,
        1000,
        {
          market: seaportMarket.address,
          data: seaportMarket.interface.encodeFunctionData("buySingle", [
            {
              parameters: {
                ...order.params,
                totalOriginalConsiderationItems: 1,
              },
              numerator: 1,
              denominator: 1,
              signature: order.params.signature,
              extraData: "0x",
            },
            buyer.address,
          ]),
          value: parseEther("1"),
        },
        { value: parseEther("1.3") }
      )
      .then((tx: any) => tx.wait())
      .then((tx: any) => tx.cumulativeGasUsed.mul(tx.effectiveGasPrice));

    const buyerEthBalanceAfter = await buyer.getBalance();
    const sellerEthBalanceAfter = await seller.getBalance();
    const referrerEthBalanceAfter = await referrer.getBalance();

    expect(await erc721.ownerOf(tokenId)).to.eq(buyer.address);
    expect(
      buyerEthBalanceBefore.sub(buyerEthBalanceAfter).sub(ethPaidOnGas)
    ).to.eq(price.add(price.mul(1000).div(10000)));
    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.eq(price);
    expect(referrerEthBalanceAfter.sub(referrerEthBalanceBefore)).to.eq(
      price.mul(1000).div(10000)
    );
  });
});
