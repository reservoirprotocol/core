import { Interface } from "@ethersproject/abi";
import { Contract } from "@ethersproject/contracts";
import { ethers } from "hardhat";

import ExchangeAbi from "@reservoir/sdk/src/wyvern-v2/abis/Exchange.json";
import ProxyRegistryAbi from "@reservoir/sdk/src/wyvern-v2/abis/ProxyRegistry.json";

export const withMockTokens = async () => {
  const [deployer] = await ethers.getSigners();

  const erc20 = await ethers
    .getContractFactory("MockERC20", deployer)
    .then((factory) => factory.deploy());

  const erc721 = await ethers
    .getContractFactory("MockERC721", deployer)
    .then((factory) => factory.deploy());

  return { erc20, erc721 };
};

export const withWyvernV2 = async () => {
  const exchange = new Contract(
    "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b",
    ExchangeAbi as any,
    ethers.provider
  );

  const proxyRegistry = new Contract(
    "0xa5409ec958c83c3f309868babaca7c86dcb077c1",
    ProxyRegistryAbi as any,
    ethers.provider
  );

  const tokenTransferProxy = new Contract(
    "0xe5c783ee536cf5e63e792988335c4255169be4e1",
    new Interface([]),
    ethers.provider
  );

  return {
    exchange,
    proxyRegistry,
    tokenTransferProxy,
  };
};
