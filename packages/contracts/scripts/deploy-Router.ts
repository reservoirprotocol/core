import * as Sdk from "@reservoir0x/sdk/src";
import { ethers, upgrades } from "hardhat";

const deployV1 = async () => {
  const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
  const [deployer] = await ethers.getSigners();

  const router = await upgrades.deployProxy(
    await ethers.getContractFactory("RouterV1", {
      signer: deployer,
    }),
    [
      Sdk.Common.Addresses.Weth[chainId],
      Sdk.LooksRare.Addresses.Exchange[chainId],
      Sdk.WyvernV23.Addresses.Exchange[chainId],
      Sdk.ZeroExV4.Addresses.Exchange[chainId],
    ]
  );
  console.log(`"RouterV1" was deployed at address ${router.address}`);
};

const upgradeV2 = async () => {
  const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
  const [deployer] = await ethers.getSigners();

  const manifest = require(`../.openzeppelin/${
    chainId === 1 ? "mainnet" : "rinkeby"
  }.json`);

  const router = await upgrades.upgradeProxy(
    manifest.proxies[0].address,
    await ethers.getContractFactory("RouterV2", {
      signer: deployer,
    }),
    {
      call: {
        fn: "initializeV2",
        args: [
          Sdk.Foundation.Addresses.Exchange[chainId],
          Sdk.X2Y2.Addresses.Exchange[chainId],
          Sdk.X2Y2.Addresses.Erc721Delegate[chainId],
        ],
      },
    }
  );
  console.log(`"RouterV2" was deployed at address ${router.address}`);
};

upgradeV2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
