import * as Sdk from "@reservoir0x/sdk/src";
import hre, { ethers } from "hardhat";

const deployV1 = async () => {
  const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
  const [deployer] = await ethers.getSigners();

  const args = [
    Sdk.Common.Addresses.Weth[chainId],
    Sdk.LooksRare.Addresses.Exchange[chainId],
    Sdk.WyvernV23.Addresses.Exchange[chainId],
    Sdk.ZeroExV4.Addresses.Exchange[chainId],
  ];

  const router = await ethers
    .getContractFactory("ReservoirV1", deployer)
    .then((factory) => factory.deploy(...args));
  console.log(`"ReservoirV1" was deployed at address ${router.address}`);

  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: args,
  });
  console.log(`"ReservoirV1" successfully verified on Etherscan`);
};

const deployV2 = async () => {
  const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
  const [deployer] = await ethers.getSigners();

  const args = [
    Sdk.Common.Addresses.Weth[chainId],
    Sdk.LooksRare.Addresses.Exchange[chainId],
    Sdk.WyvernV23.Addresses.Exchange[chainId],
    Sdk.ZeroExV4.Addresses.Exchange[chainId],
    Sdk.Foundation.Addresses.Exchange[chainId],
    Sdk.X2Y2.Addresses.Exchange[chainId],
    Sdk.X2Y2.Addresses.Erc721Delegate[chainId],
  ];

  const router = await ethers
    .getContractFactory("ReservoirV2", deployer)
    .then((factory) => factory.deploy(...args));
  console.log(`"ReservoirV2" was deployed at address ${router.address}`);

  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: args,
  });
  console.log(`"ReservoirV2" successfully verified on Etherscan`);
};

deployV2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
