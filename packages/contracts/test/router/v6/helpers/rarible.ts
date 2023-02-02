import { BigNumberish } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";

import { getChainId, getCurrentTimestamp } from "../../../utils";

// --- Listings ---

export interface IPart {
  account: string;
  value: string;
}

export enum ORDER_DATA_TYPES {
  DEFAULT_DATA_TYPE = "0xffffffff",
  LEGACY = "LEGACY",
  V1 = "V1",
  API_V1 = "ETH_RARIBLE_V1",
  V2 = "V2",
  API_V2 = "ETH_RARIBLE_V2",
  V3_SELL = "V3_SELL",
  API_V3_SELL = "ETH_RARIBLE_V2_DATA_V3_SELL",
  V3_BUY = "V3_BUY",
  API_V3_BUY = "ETH_RARIBLE_V2_DATA_V3_BUY",
}

export enum ORDER_TYPES {
  V1 = "RARIBLE_V1",
  V2 = "RARIBLE_V2",
}

export type OrderKind = "single-token" | "contract-wide";

export type RaribleListing = {
  orderType: ORDER_TYPES;
  maker: SignerWithAddress;
  side: "buy" | "sell";
  tokenKind: "erc721" | "erc1155" | "erc721_lazy" | "erc1155_lazy";
  contract: Contract;
  tokenId: string;
  tokenAmount?: number;
  price: string;
  paymentToken: string;
  salt?: BigNumberish;
  startTime: number;
  endTime: number;
  dataType: ORDER_DATA_TYPES;

  // Lazy mint options
  uri?: string;
  supply?: string;
  creators?: IPart[];
  royalties?: IPart[];
  signatures?: string[];
  // Fields below should be based on the data type of the order
  // They are optional currently and we assume they're passed correctly
  // TODO: Validation should be added to ensure correct all params exist and are passed correctly
  originFees?: IPart[];
  payouts?: IPart[];
  originFeeFirst?: IPart;
  originFeeSecond?: IPart;
  marketplaceMarker?: string;
  fee?: number;
  maxFeesBasePoint?: number;
  order?: Sdk.Rarible.Order;
};

export interface IV3OrderSellData {
  "@type"?: string;
  dataType: ORDER_DATA_TYPES;
  payouts: IPart;
  originFeeFirst: IPart;
  originFeeSecond: IPart;
  maxFeesBasePoint: number;
  marketplaceMarker: string;
}

export interface IV3OrderBuyData {
  "@type"?: string;
  dataType: ORDER_DATA_TYPES;
  payouts: IPart;
  originFeeFirst: IPart;
  originFeeSecond: IPart;
  marketplaceMarker: string;
}

export type LocalAssetType = {
  assetClass: string;
  contract: Contract;
  tokenId: string;
  uri?: string;
  supply?: string;
  creators?: IPart[];
  royalties?: IPart[];
  signatures?: string[];
};

export type LocalAsset = {
  // Comes from API
  type?: any;
  assetType: LocalAssetType;
  value: string;
};

export const setupRaribleListings = async (listings: RaribleListing[]) => {
  const chainId = getChainId();
  const exchange = new Sdk.LooksRare.Exchange(chainId);

  for (const listing of listings) {
    const { maker, tokenId, tokenKind, contract } = listing;

    // Approve the exchange contract
    await contract.connect(maker).mint(tokenId);
    await contract
      .connect(maker)
      .setApprovalForAll(Sdk.Rarible.Addresses.NFTTransferProxy[chainId], true);

    // Build and sign the order
    const builder = new Sdk.Rarible.Builders.SingleToken(chainId);
    const order = builder.build({
      orderType: ORDER_TYPES.V2,
      maker: maker.address,
      side: "sell",
      tokenKind: tokenKind,
      contract: contract.address,
      price: listing.price,
      dataType: listing.dataType,
      tokenId,
      paymentToken: listing.paymentToken,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await order.sign(maker);
  }
};

// --- Offers ---

export const setupRaribleOffers = async (offers: RaribleListing[]) => {
  const chainId = getChainId();
  const exchange = new Sdk.Rarible.Exchange(chainId);

  for (const offer of offers) {
    const { maker, tokenId, tokenKind, contract, price } = offer;

    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, chainId);
    await weth.deposit(maker, price);
    await weth.approve(
      maker,
      Sdk.Rarible.Addresses.ERC20TransferProxy[chainId]
    );

    // Build and sign the order
    const builder = new Sdk.Rarible.Builders.SingleToken(chainId);
    const order = builder.build({
      orderType: ORDER_TYPES.V2,
      maker: maker.address,
      side: offer.side,
      tokenKind: tokenKind,
      contract: contract.address,
      price: price,
      dataType: offer.dataType,
      tokenId,
      paymentToken: offer.paymentToken,
      startTime: await getCurrentTimestamp(ethers.provider),
      endTime: (await getCurrentTimestamp(ethers.provider)) + 60,
    });
    await order.sign(maker);
  }
};
