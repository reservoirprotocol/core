import { AddressZero } from "@ethersproject/constants";
import * as Sdk from "@reservoir0x/sdk/src";
import hre, { ethers } from "hardhat";

const deployV1_0_0 = async () => {
  const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
  const [deployer] = await ethers.getSigners();

  const args = [
    Sdk.Common.Addresses.Weth[chainId],
    Sdk.LooksRare.Addresses.Exchange[chainId],
    Sdk.WyvernV23.Addresses.Exchange[chainId],
    Sdk.ZeroExV4.Addresses.Exchange[chainId],
  ];

  const router = await ethers
    .getContractFactory("ReservoirV1_0_0", deployer)
    .then((factory) => factory.deploy(...args));
  console.log(`"ReservoirV1_0_0" was deployed at address ${router.address}`);

  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: args,
  });
  console.log(`"ReservoirV1" successfully verified on Etherscan`);
};

const deployV2_0_0 = async () => {
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
    .getContractFactory("ReservoirV2_0_0", deployer)
    .then((factory) => factory.deploy(...args));
  console.log(`"ReservoirV2_0_0" was deployed at address ${router.address}`);

  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: args,
  });
  console.log(`"ReservoirV2_0_0" successfully verified on Etherscan`);
};

const deployV3_0_0 = async () => {
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
    Sdk.Seaport.Addresses.Exchange[chainId],
  ];

  const router = await ethers
    .getContractFactory("ReservoirV3_0_0", deployer)
    .then((factory) => factory.deploy(...args));
  console.log(`"ReservoirV3_0_0" was deployed at address ${router.address}`);

  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: args,
  });
  console.log(`"ReservoirV3_0_0" successfully verified on Etherscan`);
};

const deployV4_0_0 = async () => {
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
    Sdk.Seaport.Addresses.Exchange[chainId],
  ];

  const router = await ethers
    .getContractFactory("ReservoirV4_0_0", deployer)
    .then((factory) => factory.deploy(...args));
  console.log(`"ReservoirV4_0_0" was deployed at address ${router.address}`);

  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: args,
  });
  console.log(`"ReservoirV4_0_0" successfully verified on Etherscan`);
};

const deployV5_0_0 = async () => {
  const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
  const [deployer] = await ethers.getSigners();

  const args = [
    Sdk.Common.Addresses.Weth[chainId],
    Sdk.LooksRare.Addresses.Exchange[chainId] ?? AddressZero,
    Sdk.WyvernV23.Addresses.Exchange[chainId] ?? AddressZero,
    Sdk.ZeroExV4.Addresses.Exchange[chainId] ?? AddressZero,
    Sdk.Foundation.Addresses.Exchange[chainId] ?? AddressZero,
    Sdk.X2Y2.Addresses.Exchange[chainId] ?? AddressZero,
    Sdk.X2Y2.Addresses.Erc721Delegate[chainId] ?? AddressZero,
    Sdk.Seaport.Addresses.Exchange[chainId] ?? AddressZero,
  ];

  const router = await ethers
    .getContractFactory("ReservoirV5_0_0", deployer)
    .then((factory) => factory.deploy(...args, { gasLimit: 10000000 }));
  console.log(`"ReservoirV5_0_0" was deployed at address ${router.address}`);

  await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

  await hre.run("verify:verify", {
    address: router.address,
    constructorArguments: args,
  });
  console.log(`"ReservoirV5_0_0" successfully verified on Etherscan`);
};

deployV5_0_0()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
