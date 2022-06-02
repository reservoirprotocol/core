import { AddressZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { getChainId, lc, reset } from "../utils";

describe("Router - upgrades", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();

    // Make sure testing will not override any mainnet manifest files
    process.chdir("/tmp");
  });

  afterEach(reset);

  // --- V1 deployment ---

  const deployV1 = async () => {
    const v1InitializationParams = [
      Sdk.Common.Addresses.Weth[chainId],
      Sdk.LooksRare.Addresses.Exchange[chainId],
      Sdk.WyvernV23.Addresses.Exchange[chainId],
      Sdk.ZeroExV4.Addresses.Exchange[chainId],
    ];

    const router = await upgrades.deployProxy(
      await ethers.getContractFactory("RouterV1", deployer),
      v1InitializationParams,
      {}
    );

    await expect(
      router.initialize(...[AddressZero, AddressZero, AddressZero, AddressZero])
    ).to.be.revertedWith("Initializable: contract is already initialized");

    return router;
  };

  const checkV1 = async (router: Contract) => {
    expect(lc(await router.weth())).to.eq(
      lc(Sdk.Common.Addresses.Weth[chainId])
    );
    expect(lc(await router.looksRare())).to.eq(
      lc(Sdk.LooksRare.Addresses.Exchange[chainId])
    );
    expect(lc(await router.wyvernV23())).to.eq(
      lc(Sdk.WyvernV23.Addresses.Exchange[chainId])
    );
    expect(lc(await router.zeroExV4())).to.eq(
      lc(Sdk.ZeroExV4.Addresses.Exchange[chainId])
    );
  };

  it("V1 deployment", async () => {
    const routerV1 = await deployV1();
    await checkV1(routerV1);
  });

  // --- V2 upgrade ---

  const upgradeV2 = async (routerV1: Contract) => {
    const v2InitializationParams = [
      Sdk.Foundation.Addresses.Exchange[chainId],
      Sdk.X2Y2.Addresses.Exchange[chainId],
      Sdk.X2Y2.Addresses.Erc721Delegate[chainId],
    ];

    const router = await upgrades.upgradeProxy(
      routerV1.address,
      await ethers.getContractFactory("RouterV2", deployer),
      {
        call: {
          fn: "initializeV2",
          args: v2InitializationParams,
        },
      }
    );

    await expect(
      router.initializeV2(...[AddressZero, AddressZero, AddressZero])
    ).to.be.revertedWith("V2: Already initialized");

    return router;
  };

  const checkV2 = async (router: Contract) => {
    expect(lc(await router.foundation())).to.eq(
      lc(Sdk.Foundation.Addresses.Exchange[chainId])
    );
    expect(lc(await router.x2y2())).to.eq(
      lc(Sdk.X2Y2.Addresses.Exchange[chainId])
    );
    expect(lc(await router.x2y2ERC721Delegate())).to.eq(
      lc(Sdk.X2Y2.Addresses.Erc721Delegate[chainId])
    );
  };

  it("V2 upgrade", async () => {
    const routerV1 = await deployV1();
    const routerV2 = await upgradeV2(routerV1);

    await checkV1(routerV2);
    await checkV2(routerV2);
  });

  // --- V3 upgrade ---

  const upgradeV3 = async (routerV2: Contract) => {
    const v3InitializationParams = [Sdk.Seaport.Addresses.Exchange[chainId]];

    const router = await upgrades.upgradeProxy(
      routerV2.address,
      await ethers.getContractFactory("RouterV3", deployer),
      {
        call: {
          fn: "initializeV3",
          args: v3InitializationParams,
        },
      }
    );

    await expect(router.initializeV3(...[AddressZero])).to.be.revertedWith(
      "V3: Already initialized"
    );

    return router;
  };

  const checkV3 = async (router: Contract) => {
    expect(lc(await router.seaport())).to.eq(
      lc(Sdk.Seaport.Addresses.Exchange[chainId])
    );
  };

  it("V3 upgrade", async () => {
    const routerV1 = await deployV1();
    const routerV2 = await upgradeV2(routerV1);
    const routerV3 = await upgradeV3(routerV2);

    await checkV1(routerV2);
    await checkV2(routerV2);
    await checkV3(routerV3);
  });
});
