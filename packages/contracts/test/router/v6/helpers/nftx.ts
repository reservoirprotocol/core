import { BigNumberish } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";
import { getChainId } from "../../../utils";

import FactoryAbi from "@reservoir0x/sdk/src/nftx/abis/Factory.json";
import NFTXStakingZapAbi from "@reservoir0x/sdk/src/nftx/abis/NFTXStakingZap.json";
import { parseEther } from "@ethersproject/units";
import { BigNumber } from "ethers";

function addSlippage(price: BigNumber, percent: number) {
  return price;
}

function subSlippage(price: BigNumber, percent: number) {
  return price;
}

// --- Listings ---

export type SudoswapListing = {
  seller: SignerWithAddress;
  nft: {
    contract: Contract;
    id: number;
  };
  price: BigNumberish;
  // Whether the order is to be cancelled
  isCancelled?: boolean;
  order?: Sdk.Nftx.Order;
  vault?: string;
};

export const setupNFTXListings = async (listings: SudoswapListing[]) => {
  const chainId = getChainId();

  const factory = new Contract(
    Sdk.Nftx.Addresses.VaultFactory[chainId],
    FactoryAbi,
    ethers.provider
  );
  for (const listing of listings) {
    const { seller, nft, price, isCancelled } = listing;

    const newId = nft.id;
    const newId2 = nft.id + 10002;
    const newId3 = nft.id + 10003;
    const newId4 = nft.id + 10004;

    const poolIds = [newId, newId2, newId3, newId4];

    // Approve the factory contract
    const txs = await Promise.all(
      poolIds.map((c) => nft.contract.connect(seller).mint(c))
    );
    await Promise.all(txs.map((c) => c.wait()));

    if (!isCancelled) {
      const _vaultId = await factory
        .connect(seller)
        .callStatic.createVault(
          "TestNFT",
          "TEST",
          nft.contract.address,
          false,
          true
        );

      await factory
        .connect(seller)
        .createVault("TestNFT", "TEST", nft.contract.address, false, true);

      await nft.contract
        .connect(seller)
        .setApprovalForAll(Sdk.Nftx.Addresses.NFTXStakingZap[chainId], true);

      const NFTXStakingZap = new Contract(
        Sdk.Nftx.Addresses.NFTXStakingZap[chainId],
        NFTXStakingZapAbi,
        ethers.provider
      );

      const ethProvide = price as BigNumber;
      const liquidity = await NFTXStakingZap.connect(
        seller
      ).callStatic.addLiquidity721ETH(_vaultId, poolIds, ethProvide, {
        value: ethProvide,
      });

      const tx = await NFTXStakingZap.connect(seller).addLiquidity721ETH(
        _vaultId,
        poolIds,
        price,
        {
          value: price,
        }
      );

      const recipient = await tx.wait();
      const vaultAddress = await factory.vault(_vaultId.toString());

      const [poolPrice, nftIds] = await Promise.all([
        Sdk.Nftx.helpers.getPoolPrice(
          vaultAddress,
          2,
          getChainId(),
          ethers.provider
        ),
        Sdk.Nftx.helpers.getPoolNFTs(vaultAddress, ethers.provider),
      ]);

      if (poolPrice.buy) {
        listing.price = addSlippage(parseEther(poolPrice.buy), 8);
        listing.vault = vaultAddress;
        listing.order = new Sdk.Nftx.Order(chainId, {
          vaultId: _vaultId.toString(),
          collection: nft.contract.address,
          specificIds: [newId.toString()],
          amount: "1",
          path: [Sdk.Common.Addresses.Weth[chainId], vaultAddress],
          price: listing.price.toString(),
        });
      }
    }
  }
};

// --- Offers ---

export type SudoswapOffer = {
  buyer: SignerWithAddress;
  nft: {
    contract: Contract;
    id: number;
  };
  price: BigNumberish;
  // Whether the order is to be cancelled
  isCancelled?: boolean;
  order?: Sdk.Nftx.Order;
  vault?: string;
};

export const setupNFTXOffers = async (offers: SudoswapOffer[]) => {
  const chainId = getChainId();

  const factory = new Contract(
    Sdk.Nftx.Addresses.VaultFactory[chainId],
    FactoryAbi,
    ethers.provider
  );

  for (const offer of offers) {
    const { buyer, nft, price, isCancelled } = offer;

    const newId = nft.id;
    const newId2 = nft.id + 10002;
    const newId3 = nft.id + 10003;
    const newId4 = nft.id + 10004;

    const poolIds = [newId2, newId3, newId4];

    // Approve the factory contract
    const txs = await Promise.all(
      poolIds.map((c) => nft.contract.connect(buyer).mint(c))
    );
    await Promise.all(txs.map((c) => c.wait()));

    if (!isCancelled) {
      const _vaultId = await factory
        .connect(buyer)
        .callStatic.createVault(
          "TestNFT",
          "TEST",
          nft.contract.address,
          false,
          true
        );

      await factory
        .connect(buyer)
        .createVault("TestNFT", "TEST", nft.contract.address, false, true);

      await nft.contract
        .connect(buyer)
        .setApprovalForAll(Sdk.Nftx.Addresses.NFTXStakingZap[chainId], true);

      const NFTXStakingZap = new Contract(
        Sdk.Nftx.Addresses.NFTXStakingZap[chainId],
        NFTXStakingZapAbi,
        ethers.provider
      );

      const ethProvide = price as BigNumber;

      const liquidity = await NFTXStakingZap.connect(
        buyer
      ).callStatic.addLiquidity721ETH(_vaultId, poolIds, ethProvide, {
        value: ethProvide,
      });

      const tx = await NFTXStakingZap.connect(buyer).addLiquidity721ETH(
        _vaultId,
        poolIds,
        price,
        {
          value: price,
        }
      );

      const vaultAddress = await factory.vault(_vaultId.toString());

      const [poolPrice, nftIds] = await Promise.all([
        Sdk.Nftx.helpers.getPoolPrice(
          vaultAddress,
          2,
          getChainId(),
          ethers.provider
        ),
        Sdk.Nftx.helpers.getPoolNFTs(vaultAddress, ethers.provider),
      ]);

      if (poolPrice.sell) {
        offer.price = subSlippage(parseEther(poolPrice.sell), 8);
        offer.vault = vaultAddress;
        offer.order = new Sdk.Nftx.Order(chainId, {
          vaultId: _vaultId.toString(),
          collection: nft.contract.address,
          currency: Sdk.Common.Addresses.Weth[chainId],
          specificIds: [newId.toString()],
          price: offer.price.toString(),
          path: [vaultAddress, Sdk.Common.Addresses.Weth[chainId]],
          // minEthOut: offer.price.toString(),
        });
      }
    }
  }
};
