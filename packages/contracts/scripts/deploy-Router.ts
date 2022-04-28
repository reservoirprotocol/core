import * as Sdk from "@reservoir0x/sdk/src";
import { ethers, upgrades } from "hardhat";

const main = async () => {
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
      Sdk.OpenDao.Addresses.Exchange[chainId],
    ]
  );
  console.log(`"RouterV1" was deployed at address ${router.address}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
