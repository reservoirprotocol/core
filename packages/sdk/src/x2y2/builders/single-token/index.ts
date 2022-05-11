import { defaultAbiCoder } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";

import { BaseBuildParams, BaseBuilder } from "../base";
import * as Addresses from "../../addresses";
import { Order } from "../../order";
import * as Types from "../../types";
import * as CommonAddresses from "../../../common/addresses";
import { getCurrentTimestamp, getRandomBytes, s } from "../../../utils";

interface BuildParams extends BaseBuildParams {
  contract: string;
  tokenId: BigNumberish;
}

export class SingleTokenBuilder extends BaseBuilder {
  public isValid(order: Order, itemId = 0): boolean {
    try {
      const [contract, tokenId] = defaultAbiCoder.decode(
        ["(address,uint256)[]"],
        order.params.items[itemId].data
      );

      const copyOrder = this.build({
        side: order.params.intent === Types.Intent.BUY ? "buy" : "sell",
        tokenKind:
          order.params.delegateType === Types.DelegationType.ERC721
            ? "erc721"
            : "erc1155",
        maker: order.params.user,
        price: order.params.items[itemId].price,
        contract,
        tokenId,
        ...order.params,
      });

      if (!copyOrder) {
        return false;
      }

      if (copyOrder.hash() !== order.hash()) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public build(params: BuildParams) {
    this.defaultInitialize(params);

    return new Order(this.chainId, {
      kind: "single-token",
      salt: params.salt!,
      user: params.maker,
      network: this.chainId,
      intent: params.side === "buy" ? Types.Intent.BUY : Types.Intent.SELL,
      delegateType:
        params.tokenKind === "erc721"
          ? Types.DelegationType.ERC721
          : Types.DelegationType.ERC1155,
      deadline: params.deadline!,
      currency:
        params.side === "buy"
          ? CommonAddresses.Weth[this.chainId]
          : CommonAddresses.Eth[this.chainId],
      dataMask: "0x",
      items: [
        {
          price: s(params.price),
          data: defaultAbiCoder.encode(
            ["(address,uint256)[]"],
            [[[params.contract, params.tokenId]]]
          ),
        },
      ],
    });
  }

  public buildMatching(
    order: Order,
    taker: string,
    data?: { itemId?: number; fees?: Types.Fee[] }
  ) {
    const itemId = data?.itemId ?? 0;
    const item = order.params.items[itemId];

    const detail = {
      op:
        order.params.intent === Types.Intent.BUY
          ? Types.MarketOp.COMPLETE_BUY_OFFER
          : Types.MarketOp.COMPLETE_SELL_OFFER,
      orderIdx: 0,
      itemIdx: data?.itemId ?? 0,
      price: item.price,
      itemHash: order.itemHash(itemId),
      executionDelegate: Addresses.Erc721Delegate[this.chainId],
      dataReplacement: "0x",
      bidIncentivePct: 0,
      aucMinIncrementPct: 0,
      aucIncDurationSecs: 0,
      fees: [
        {
          to: Addresses.FeeManager[this.chainId],
          percentage: 500,
        },
        ...(data?.fees || []),
      ],
    };

    const shared = {
      salt: s(getRandomBytes(8)),
      deadline: getCurrentTimestamp() + 5 * 60,
      amountToEth: "0",
      amountToWeth: "0",
      user: taker,
      canFail: false,
    };

    return { detail, shared };
  }
}
