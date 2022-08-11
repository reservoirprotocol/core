import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { ExecutionInfo } from "../helpers/router";
import { SeaportListing, setupSeaportListings } from "../helpers/seaport";
import {
  bn,
  getChainId,
  getRandomBoolean,
  getRandomFloat,
  getRandomInteger,
  reset,
  setupNFTs,
} from "../../utils";

describe("[ReservoirV6_0_0] Router executions with amount checks", () => {
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

  it("Fill ETH listings with slippage", async () => {
    // Setup

    // Makers: Alice and Bob
    // Taker: Carol

    // Create four listings (with two out of four being unfillable)
    const listings: SeaportListing[] = [];
    for (let i = 0; i < 5; i++) {
      listings.push({
        seller: getRandomBoolean() ? alice : bob,
        nft: {
          kind: "erc721",
          contract: erc721,
          id: getRandomInteger(1, 10000),
        },
        price: parseEther(getRandomFloat(0.0001, 2).toFixed(6)),
        isCancelled: i % 2 === 0,
      });
    }
    await setupSeaportListings(listings);

    // Prepare executions

    const executions: ExecutionInfo[] = [
      // 1. Fill listings
      ...listings.map((listing) => ({
        module: seaportModule.address,
        data: seaportModule.interface.encodeFunctionData(`acceptETHListing`, [
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
            fillTo: carol.address,
            // ETH should get refunded to the router to cover any other further listings
            refundTo: router.address,
            revertIfIncomplete: false,
            amount: listing.price,
          },
          [],
        ]),
        value: listings
          .map(({ price }) => price)
          .reduce((a, b) => bn(a).add(b), bn(0)),
      })),
    ];

    // Fetch pre-state

    const balancesBefore = await getBalances(Sdk.Common.Addresses.Eth[chainId]);

    // Execute

    await router.connect(carol).executeWithAmountCheck(
      executions,
      {
        // Check Carol's total ERC721 balance
        checkContract: erc721.address,
        checkData: erc721.interface.encodeFunctionData("balanceOf", [
          carol.address,
        ]),
        // We want to buy two tokens
        maxAmount: 2,
      },
      {
        // Since we only want to get two tokens out of four, it's enough
        // to only provide the price of the two most expensive orders we
        // are trying to fill
        value: executions
          .map(({ value }) => value)
          .sort((a, b) => (bn(a).sub(b).lt(0) ? 1 : -1))
          .slice(0, 2)
          .reduce((a, b) => bn(a).add(b), bn(0)),
      }
    );

    // Fetch post-state

    const balancesAfter = await getBalances(Sdk.Common.Addresses.Eth[chainId]);

    // Checks

    // Alice got the payment
    expect(balancesAfter.alice.sub(balancesBefore.alice)).to.eq(
      listings
        .filter(({ isCancelled }) => !isCancelled)
        .slice(0, 2)
        .filter(({ seller }) => seller.address === alice.address)
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0))
    );
    // Bob got the payment
    expect(balancesAfter.bob.sub(balancesBefore.bob)).to.eq(
      listings
        .filter(({ isCancelled }) => !isCancelled)
        .slice(0, 2)
        .filter(({ seller }) => seller.address === bob.address)
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0))
    );

    // Carol got the number of NFTs they wanted
    expect(await erc721.balanceOf(carol.address)).to.eq(2);

    // Router is stateless
    expect(balancesAfter.router).to.eq(0);
    expect(balancesAfter.seaportModule).to.eq(0);
  });
});
