import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { ExecutionInfo } from "../../helpers/router";
import {
  ZeroExV4Listing,
  setupZeroExV4Listings,
} from "../../helpers/zeroex-v4";
import {
  bn,
  getChainId,
  getRandomBoolean,
  getRandomFloat,
  getRandomInteger,
  reset,
  setupNFTs,
} from "../../../utils";

describe("[ReservoirV6_0_0] ZeroExV4 listings", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let david: SignerWithAddress;
  let emilio: SignerWithAddress;

  let erc721: Contract;
  let router: Contract;
  let uniswapV3Module: Contract;
  let zeroExV4Module: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, david, emilio] = await ethers.getSigners();

    ({ erc721 } = await setupNFTs(deployer));

    router = (await ethers
      .getContractFactory("ReservoirV6_0_0", deployer)
      .then((factory) => factory.deploy())) as any;
    uniswapV3Module = (await ethers
      .getContractFactory("UniswapV3Module", deployer)
      .then((factory) => factory.deploy(router.address))) as any;
    zeroExV4Module = (await ethers
      .getContractFactory("ZeroExV4Module", deployer)
      .then((factory) => factory.deploy(router.address))) as any;

    await router.registerModule(uniswapV3Module.address);
    await router.registerModule(zeroExV4Module.address);
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
        uniswapV3Module: await ethers.provider.getBalance(
          uniswapV3Module.address
        ),
        zeroExV4Module: await ethers.provider.getBalance(
          zeroExV4Module.address
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
        uniswapV3Module: await contract.getBalance(uniswapV3Module.address),
        zeroExV4Module: await contract.getBalance(zeroExV4Module.address),
      };
    }
  };

  afterEach(reset);

  const testAcceptListings = async (
    // Whether to include fees on top
    chargeFees: boolean,
    // Whether to revert or not in case of any failures
    revertIfIncomplete: boolean,
    // Whether to cancel some orders in order to trigger partial filling
    partial: boolean,
    // Number of listings to fill
    listingsCount: number
  ) => {
    // Setup

    // Makers: Alice and Bob
    // Taker: Carol
    // Fee recipient: Emilio

    const listings: ZeroExV4Listing[] = [];
    const feesOnTop: BigNumber[] = [];
    for (let i = 0; i < listingsCount; i++) {
      listings.push({
        seller: getRandomBoolean() ? alice : bob,
        nft: {
          kind: "erc721",
          contract: erc721,
          id: getRandomInteger(1, 10000),
        },
        price: parseEther(getRandomFloat(0.0001, 2).toFixed(6)),
        isCancelled: partial && getRandomBoolean(),
      });
      if (chargeFees) {
        feesOnTop.push(parseEther(getRandomFloat(0.0001, 0.1).toFixed(6)));
      }
    }
    await setupZeroExV4Listings(listings);

    // Prepare executions

    const executions: ExecutionInfo[] = [
      // 1. Fill listings
      ...listings.map((listing, i) => ({
        module: zeroExV4Module.address,
        data: zeroExV4Module.interface.encodeFunctionData(
          `acceptETHListingERC721`,
          [
            listing.order!.getRaw(),
            listing.order!.getRaw(),
            {
              fillTo: carol.address,
              refundTo: carol.address,
              revertIfIncomplete,
              amount: listing.price,
            },
            chargeFees
              ? [
                  {
                    recipient: emilio.address,
                    amount: feesOnTop[i],
                  },
                ]
              : [],
          ]
        ),
        value: bn(listing.price)
          .add(chargeFees ? feesOnTop[i] : 0)
          .add(
            // Anything on top should be refunded
            parseEther("0.1")
          ),
      })),
    ];

    // Checks

    // If the `revertIfIncomplete` option is enabled and we have any
    // orders that are not fillable, the whole transaction should be
    // reverted
    if (
      partial &&
      revertIfIncomplete &&
      listings.some(({ isCancelled }) => isCancelled)
    ) {
      await expect(
        router.connect(carol).execute(executions, {
          value: executions
            .map(({ value }) => value)
            .reduce((a, b) => bn(a).add(b), bn(0)),
        })
      ).to.be.revertedWith(
        "reverted with custom error 'UnsuccessfulExecution()'"
      );

      return;
    }

    // Fetch pre-state

    const balancesBefore = await getBalances(Sdk.Common.Addresses.Eth[chainId]);

    // Execute

    await router.connect(carol).execute(executions, {
      value: executions
        .map(({ value }) => value)
        .reduce((a, b) => bn(a).add(b), bn(0)),
    });

    // Fetch post-state

    const balancesAfter = await getBalances(Sdk.Common.Addresses.Eth[chainId]);

    // Checks

    // Alice got the payment
    expect(balancesAfter.alice.sub(balancesBefore.alice)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            !isCancelled && seller.address === alice.address
        )
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0))
    );
    // Bob got the payment
    expect(balancesAfter.bob.sub(balancesBefore.bob)).to.eq(
      listings
        .filter(
          ({ seller, isCancelled }) =>
            !isCancelled && seller.address === bob.address
        )
        .map(({ price }) => price)
        .reduce((a, b) => bn(a).add(b), bn(0))
    );

    // Emilio got the fee payments
    if (chargeFees) {
      expect(balancesAfter.emilio.sub(balancesBefore.emilio)).to.eq(
        listings
          .map(({ isCancelled }, i) => (!isCancelled ? feesOnTop[i] : 0))
          .reduce((a, b) => bn(a).add(b), bn(0))
      );
    }

    // Carol got the NFTs from all filled orders
    for (let i = 0; i < listings.length; i++) {
      if (!listings[i].isCancelled) {
        expect(await erc721.ownerOf(listings[i].nft.id)).to.eq(carol.address);
      } else {
        expect(await erc721.ownerOf(listings[i].nft.id)).to.eq(
          listings[i].seller.address
        );
      }
    }

    // Router is stateless
    expect(balancesAfter.router).to.eq(0);
    expect(balancesAfter.uniswapV3Module).to.eq(0);
    expect(balancesAfter.zeroExV4Module).to.eq(0);
  };

  for (let multiple of [false, true]) {
    for (let partial of [false, true]) {
      for (let chargeFees of [false, true]) {
        for (let revertIfIncomplete of [false, true]) {
          it(
            "[eth]" +
              `${multiple ? "[multiple-orders]" : "[single-order]"}` +
              `${partial ? "[partial]" : "[full]"}` +
              `${chargeFees ? "[fees]" : "[no-fees]"}` +
              `${revertIfIncomplete ? "[reverts]" : "[skip-reverts]"}`,
            async () =>
              testAcceptListings(
                chargeFees,
                revertIfIncomplete,
                partial,
                multiple ? getRandomInteger(2, 6) : 1
              )
          );
        }
      }
    }
  }
});
