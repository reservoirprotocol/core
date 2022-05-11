import { BigNumberish } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";

import { Order } from "../../order";
import { SettleDetail, SettleShared } from "../../types";
import { getCurrentTimestamp, getRandomBytes } from "../../../utils";

export interface BaseBuildParams {
  side: "sell" | "buy";
  tokenKind: "erc721" | "erc1155";
  maker: string;
  price: BigNumberish;
  salt?: string;
  network?: number;
  deadline?: number;
  v?: number;
  r?: string;
  s?: string;
}

export abstract class BaseBuilder {
  public chainId: number;

  constructor(chainId: number) {
    if (chainId !== 1) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  protected defaultInitialize(params: BaseBuildParams) {
    params.deadline =
      params.deadline ?? getCurrentTimestamp(365 * 24 * 60 * 60);
    params.salt = params.salt ?? getRandomBytes(8).toString();
    params.v = params.v ?? 0;
    params.r = params.r ?? HashZero;
    params.s = params.s ?? HashZero;
  }

  public abstract isValid(order: Order): boolean;
  public abstract build(params: BaseBuildParams): Order;
  public abstract buildMatching(
    order: Order,
    taker: string,
    data: any
  ): { detail: SettleDetail; shared: SettleShared };
}
