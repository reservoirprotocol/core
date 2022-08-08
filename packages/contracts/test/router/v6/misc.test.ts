import { Contract } from "@ethersproject/contracts";
import { parseUnits } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { ExecutionInfo } from "../helpers/router";
import {
  SeaportListing,
  SeaportOffer,
  setupSeaportListings,
  setupSeaportOffers,
} from "../helpers/seaport";
import { bn, getChainId, reset, setupNFTs } from "../../utils";

describe("[ReservoirV6_0_0] Misc", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let david: SignerWithAddress;
  let emilio: SignerWithAddress;

  let erc721: Contract;
  let router: Contract;
  let seaportModule: Contract;
  let uniswapV3Module: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, david, emilio] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));

    router = (await ethers
      .getContractFactory("ReservoirV6_0_0", deployer)
      .then((factory) => factory.deploy())) as any;
    seaportModule = (await ethers
      .getContractFactory("SeaportModule", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    uniswapV3Module = (await ethers
      .getContractFactory("UniswapV3Module", deployer)
      .then((factory) => factory.deploy(router.address))) as any;

    await router.registerModule(seaportModule.address);
    await router.registerModule(uniswapV3Module.address);
  });

  const getBalances = async (token: string) => {
    if (token === Sdk.Common.Addresses.Eth[chainId]) {
      return {
        alice: await ethers.provider.getBalance(alice.address),
        bob: await ethers.provider.getBalance(bob.address),
        carol: await ethers.provider.getBalance(carol.address),
        david: await ethers.provider.getBalance(david.address),
        emilio: await ethers.provider.getBalance(emilio.address),
        router: await ethers.provider.getBalance(router.address),
        seaportModule: await ethers.provider.getBalance(seaportModule.address),
        uniswapV3Module: await ethers.provider.getBalance(
          uniswapV3Module.address
        ),
      };
    } else {
      const contract = new Sdk.Common.Helpers.Erc20(ethers.provider, token);
      return {
        alice: await contract.getBalance(alice.address),
        bob: await contract.getBalance(bob.address),
        carol: await contract.getBalance(carol.address),
        david: await contract.getBalance(david.address),
        emilio: await contract.getBalance(emilio.address),
        router: await contract.getBalance(router.address),
        seaportModule: await contract.getBalance(seaportModule.address),
        uniswapV3Module: await contract.getBalance(uniswapV3Module.address),
      };
    }
  };

  afterEach(reset);

  it("Atomically buy and sell", async () => {
    // Setup

    const listing: SeaportListing = {
      seller: alice,
      nft: {
        kind: "erc721",
        contract: erc721,
        id: 9876,
      },
      price: parseUnits("2.576", 18),
    };
    await setupSeaportListings([listing]);

    const offer: SeaportOffer = {
      buyer: bob,
      nft: {
        kind: "erc721",
        contract: erc721,
        id: 9876,
      },
      price: parseUnits("3", 18),
    };
    await setupSeaportOffers([offer]);

    // Prepare executions

    const executions: ExecutionInfo[] = [
      // 1. Buy via listing, sending the NFT to the Seaport module
      {
        module: seaportModule.address,
        data: seaportModule.interface.encodeFunctionData("acceptETHListing", [
          {
            parameters: {
              ...listing.order!.params,
              totalOriginalConsiderationItems:
                listing.order!.params.consideration.length,
            },
            numerator: 1,
            denominator: 1,
            signature: listing.order!.params.signature,
            extraData: "0x",
          },
          {
            fillTo: seaportModule.address,
            refundTo: carol.address,
            revertIfIncomplete: true,
            amount: listing.price,
          },
        ]),
        value: listing.price,
      },
      // 2. Sell via offer
      {
        module: seaportModule.address,
        data: seaportModule.interface.encodeFunctionData("acceptERC721Offer", [
          {
            parameters: {
              ...offer.order!.params,
              totalOriginalConsiderationItems:
                offer.order!.params.consideration.length,
            },
            numerator: 1,
            denominator: 1,
            signature: offer.order!.params.signature,
            extraData: "0x",
          },
          [],
          {
            fillTo: carol.address,
            refundTo: carol.address,
            revertIfIncomplete: true,
          },
          {
            token: erc721.address,
            id: offer.nft.id,
          },
        ]),
        value: 0,
      },
    ];

    // Fetch pre-state

    const ethBalancesBefore = await getBalances(
      Sdk.Common.Addresses.Eth[chainId]
    );
    const wethBalancesBefore = await getBalances(
      Sdk.Common.Addresses.Weth[chainId]
    );

    // Execute

    await router.connect(carol).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b)),
    });

    // Fetch post-state

    const ethBalancesAfter = await getBalances(
      Sdk.Common.Addresses.Eth[chainId]
    );
    const wethBalancesAfter = await getBalances(
      Sdk.Common.Addresses.Weth[chainId]
    );

    // Checks

    // Alice got the ETH
    expect(ethBalancesAfter.alice.sub(ethBalancesBefore.alice)).to.eq(
      listing.price
    );

    // Bob got the NFT
    expect(await erc721.ownerOf(offer.nft.id)).to.eq(bob.address);

    // Carol got the WETH
    expect(wethBalancesAfter.carol.sub(wethBalancesBefore.carol)).to.eq(
      offer.price
    );

    // Router is stateless
    expect(ethBalancesAfter.router).to.eq(0);
    expect(ethBalancesAfter.seaportModule).to.eq(0);
    expect(wethBalancesAfter.router).to.eq(0);
    expect(wethBalancesAfter.seaportModule).to.eq(0);
  });
});
