import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";

import { BundleOrder } from "../../bundle-order";
import * as Types from "../../types";
import { getCurrentTimestamp, getRandomBytes } from "../../../utils";

export interface BaseBundleBuildParams {
  offerer: string;
  offerItems: {
    tokenKind: "erc20" | "erc721" | "erc1155";
    contract: string;
    tokenId?: string;
    amount?: string;
  }[];
  considerationItems: {
    tokenKind: "erc20" | "erc721" | "erc1155";
    contract: string;
    tokenId?: string;
    amount?: string;
  }[];
  counter: BigNumberish;
  fees?: {
    recipient: string;
    amount: BigNumberish;
  }[];
  taker?: string;
  orderType?: number;
  zone?: string;
  zoneHash?: string;
  conduitKey?: string;
  salt?: BigNumberish;
  startTime?: number;
  endTime?: number;
  signature?: string;
}

export interface BaseBundleOrderInfo {
  taker: string;
  offerItems: {
    tokenKind: "erc20" | "erc721" | "erc1155";
    contract: string;
    tokenId?: string;
    amount?: string;
  }[];
  considerationItems: {
    tokenKind: "erc20" | "erc721" | "erc1155";
    contract: string;
    tokenId?: string;
    amount?: string;
  }[];
  fees?: {
    recipient: string;
    amount: BigNumberish;
  }[];
}

export abstract class BaseBundleBuilder {
  public chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  protected defaultInitialize(params: BaseBundleBuildParams) {
    // Default listing time is 5 minutes in the past to allow for any
    // time discrepancies when checking the order's validity on-chain
    params.startTime = params.startTime ?? getCurrentTimestamp(-5 * 60);
    params.endTime = params.endTime ?? 0;
    params.taker = params.taker ?? AddressZero;
    params.conduitKey = params.conduitKey ?? HashZero;
    params.zone = params.zone ?? AddressZero;
    params.zoneHash = params.zoneHash ?? HashZero;
    params.salt = params.salt ?? getRandomBytes();
    params.signature = params.signature ?? HashZero;
  }

  public abstract getInfo(order: BundleOrder): BaseBundleOrderInfo | undefined;
  public abstract isValid(order: BundleOrder): boolean;
  public abstract build(params: BaseBundleBuildParams): BundleOrder;
  public abstract buildMatching(
    order: BundleOrder,
    data: any
  ): Types.MatchParams;
}
