import { Provider } from "@ethersproject/abstract-provider";
import { BigNumberish, BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as Sdk from "@reservoir0x/sdk/src";
import { ethers, network, upgrades } from "hardhat";

// --- MISC UTILS ---

export const bn = (value: BigNumberish) => BigNumber.from(value);

export const lc = (value: string) => value.toLowerCase();

export const getCurrentTimestamp = async (provider: Provider) =>
  provider.getBlock("latest").then((b) => b.timestamp);

// --- NETWORK UTILS ---

// Reset forked network state
export const reset = async () => {
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
};

// Retrieve the forked network's chain id
export const getChainId = () =>
  (network.config as any).forking?.url.includes("rinkeby") ? 4 : 1;

// --- CONTRACT UTILS ---

// Deploy mock ERC721/1155 contracts
export const setupNFTs = async (deployer: SignerWithAddress) => {
  const erc721 = await ethers
    .getContractFactory("MockERC721", deployer)
    .then((factory) => factory.deploy());
  const erc1155 = await ethers
    .getContractFactory("MockERC1155", deployer)
    .then((factory) => factory.deploy());

  return { erc721, erc1155 };
};

export enum ExchangeKind {
  WYVERN_V23,
  LOOKS_RARE,
  ZEROEX_V4,
  FOUNDATION,
  X2Y2,
  SEAPORT,
}

// Deploy and upgrade router up to the latest version
export const setupRouter = async (
  chainId: number,
  deployer: SignerWithAddress
) => {
  // Make sure testing will not override any mainnet OZ manifest files
  process.chdir("/tmp");

  let router: Contract;

  // V1
  router = await upgrades.deployProxy(
    await ethers.getContractFactory("RouterV1", deployer),
    [
      Sdk.Common.Addresses.Weth[chainId],
      Sdk.LooksRare.Addresses.Exchange[chainId],
      Sdk.WyvernV23.Addresses.Exchange[chainId],
      Sdk.ZeroExV4.Addresses.Exchange[chainId],
    ]
  );

  // V2
  router = await upgrades.upgradeProxy(
    router.address,
    await ethers.getContractFactory("RouterV2", deployer),
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

  // V3
  router = await upgrades.upgradeProxy(
    router.address,
    await ethers.getContractFactory("RouterV3", deployer),
    {
      call: {
        fn: "initializeV3",
        args: [Sdk.Seaport.Addresses.Exchange[chainId]],
      },
    }
  );

  return router;
};
