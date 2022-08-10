import { BigNumberish } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";

import { getChainId, getCurrentTimestamp } from "../../utils";

// --- Listings ---

export type LooksRareListing = {
  seller: SignerWithAddress;
  nft: {
    kind: "erc721" | "erc1155";
    contract: Contract;
    id: number;
    // A single quantity if missing
    amount?: number;
  };
  // For the moment, all orders are in ETH
  price: BigNumberish;
  // Whether the order is to be cancelled
  isCancelled?: boolean;
  order?: Sdk.LooksRare.Order;
};

export const setupLooksRareListings = async (listings: LooksRareListing[]) => {
  const chainId = getChainId();

  for (const listing of listings) {
    const { seller, nft, price } = listing;

    // Approve the exchange contract
    if (nft.kind === "erc721") {
      await nft.contract.connect(seller).mint(nft.id);
      await nft.contract
        .connect(seller)
        .setApprovalForAll(
          Sdk.LooksRare.Addresses.TransferManagerErc721[chainId],
          true
        );
    } else {
      await nft.contract.connect(seller).mint(nft.id, nft.amount ?? 1);
      await nft.contract
        .connect(seller)
        .setApprovalForAll(
          Sdk.LooksRare.Addresses.TransferManagerErc1155[chainId],
          true
        );
    }

    // Build and sign the order
    const builder = new Sdk.LooksRare.Builders.SingleToken(chainId);
    const order = builder.build({
      isOrderAsk: true,
      signer: seller.address,
      collection: nft.contract.address,
      tokenId: nft.id,
      price,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await order.sign(seller);

    listing.order = order;

    // Cancel the order if requested
    if (listing.isCancelled) {
      const exchange = new Sdk.LooksRare.Exchange(chainId);
      await exchange.cancelOrder(seller, order);
    }
  }
};

// --- Offers ---

export type ZeroExV4Offer = {
  buyer: SignerWithAddress;
  nft: {
    kind: "erc721" | "erc1155";
    contract: Contract;
    id: number;
  };
  // For the moment, all orders are in WETH
  price: BigNumberish;
  // Whether the order is to be cancelled
  isCancelled?: boolean;
  order?: Sdk.ZeroExV4.Order;
};

export const setupZeroExV4Offers = async (offers: ZeroExV4Offer[]) => {
  const chainId = getChainId();

  for (const offer of offers) {
    const { buyer, nft, price } = offer;

    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, chainId);
    await weth.deposit(buyer, price);
    await weth.approve(buyer, Sdk.ZeroExV4.Addresses.Exchange[chainId]);

    // Build and sign the order
    const builder = new Sdk.ZeroExV4.Builders.SingleToken(chainId);
    const order = builder.build({
      direction: "buy",
      maker: buyer.address,
      contract: nft.contract.address,
      tokenId: nft.id,
      price,
      expiry: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await order.sign(buyer);

    offer.order = order;

    // Cancel the order if requested
    if (offer.isCancelled) {
      const exchange = new Sdk.ZeroExV4.Exchange(chainId);
      await exchange.cancelOrder(buyer, order);
    }
  }
};
