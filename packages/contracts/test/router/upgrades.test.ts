import { AddressZero } from "@ethersproject/constants";
import { Contract } from "@ethersproject/contracts";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";

import { lc } from "../utils";

describe("Router - upgrades", () => {
  let chainId: number;

  let deployer: SignerWithAddress;

  beforeEach(async () => {
    chainId = (network.config as any).forking?.url.includes("rinkeby") ? 4 : 1;
    [deployer] = await ethers.getSigners();

    // Make sure testing will not override any mainnet manifest files.
    process.chdir("/tmp");
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

  it("v1 deployment", async () => {
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

  it("v2 upgrade", async () => {
    const routerV1 = await deployV1();
    const routerV2 = await upgradeV2(routerV1);

    await checkV1(routerV2);
    await checkV2(routerV2);
  });
});
