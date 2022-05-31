import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { HashZero } from "@ethersproject/constants";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { TxData, bn } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";

export class Exchange {
  public chainId: number;
  public contract: Contract;

  constructor(chainId: number) {
    if (chainId !== 1) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
    this.contract = new Contract(Addresses.Exchange[this.chainId], ExchangeAbi);
  }

  // --- Fill order ---

  public async fillOrder(
    taker: Signer,
    order: Order,
    conduitKey = HashZero,
    feesOnTop: {
      amount: string;
      recipient: BigNumberish;
    }[] = []
  ): Promise<ContractTransaction> {
    const info = order.getInfo()!;

    if (info.side === "sell") {
      return this.contract.connect(taker).fulfillBasicOrder(
        {
          considerationToken: info.paymentToken,
          considerationIdentifier: "0",
          considerationAmount: info.price,
          offerer: order.params.offerer,
          zone: order.params.zone,
          offerToken: info.contract,
          offerIdentifier: info.tokenId,
          offerAmount: info.amount,
          basicOrderType:
            (info.tokenKind === "erc721"
              ? Types.BasicOrderType.ETH_TO_ERC721_FULL_OPEN
              : Types.BasicOrderType.ETH_TO_ERC1155_FULL_OPEN) +
            order.params.orderType,
          startTime: order.params.startTime,
          endTime: order.params.endTime,
          zoneHash: order.params.zoneHash,
          salt: order.params.salt,
          offererConduitKey: order.params.conduitKey,
          fulfillerConduitKey: conduitKey,
          totalOriginalAdditionalRecipients:
            order.params.consideration.length - 1,
          additionalRecipients: [
            ...order.params.consideration
              .slice(1)
              .map(({ startAmount, recipient }) => ({
                amount: startAmount,
                recipient,
              })),
            ...feesOnTop,
          ],
          signature: order.params.signature!,
        },
        { value: bn(info.price).add(order.getFeeAmount()) }
      );
    } else {
      return this.contract.connect(taker).fulfillBasicOrder({
        considerationToken: info.contract,
        considerationIdentifier: info.tokenId,
        considerationAmount: info.amount,
        offerer: order.params.offerer,
        zone: order.params.zone,
        offerToken: info.paymentToken,
        offerIdentifier: "0",
        offerAmount: info.price,
        basicOrderType:
          (info.tokenKind === "erc721"
            ? Types.BasicOrderType.ERC721_TO_ERC20_FULL_OPEN
            : Types.BasicOrderType.ERC1155_TO_ERC20_FULL_OPEN) +
          order.params.orderType,
        startTime: order.params.startTime,
        endTime: order.params.endTime,
        zoneHash: order.params.zoneHash,
        salt: order.params.salt,
        offererConduitKey: order.params.conduitKey,
        fulfillerConduitKey: conduitKey,
        totalOriginalAdditionalRecipients:
          order.params.consideration.length - 1,
        additionalRecipients: [
          ...order.params.consideration
            .slice(1)
            .map(({ startAmount, recipient }) => ({
              amount: startAmount,
              recipient,
            })),
          ...feesOnTop,
        ],
        signature: order.params.signature!,
      });
    }
  }
}
