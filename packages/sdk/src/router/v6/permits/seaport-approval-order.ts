import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { AddressZero, HashZero } from "@ethersproject/constants";

import { Token } from "../types";
import * as Sdk from "../../../index";
import { TxData, getCurrentTimestamp, getRandomBytes } from "../../../utils";

import RouterAbi from "../abis/ReservoirV6_0_0.json";
import SeaportModuleAbi from "../abis/SeaportModule.json";

export type SeaportApprovalOrder = {
  order: Sdk.Seaport.Types.OrderComponents;
  mirrorOrder: Sdk.Seaport.Types.OrderComponents;
};

export class SeaportApprovalOrderHandler {
  public chainId: number;
  public provider: Provider;

  constructor(chainId: number, provider: Provider) {
    this.chainId = chainId;
    this.provider = provider;
  }

  public async generate(
    giver: string,
    receiver: string,
    tokens: Token[],
    expiresIn = 10 * 60
  ): Promise<SeaportApprovalOrder> {
    const now = getCurrentTimestamp();

    // Build approval order
    const offer = tokens.map((token) => ({
      itemType: token.kind === "erc721" ? 2 : 3,
      token: token.contract,
      identifierOrCriteria: token.tokenId.toString(),
      startAmount: (token.amount ?? "1").toString(),
      endAmount: (token.amount ?? "1").toString(),
    }));
    const order = new Sdk.Seaport.Order(this.chainId, {
      kind: "single-token",
      offerer: giver,
      zone: Sdk.Seaport.Addresses.ApprovalOrderZone[this.chainId],
      offer,
      consideration: offer.map((o) => ({ ...o, recipient: receiver })),
      orderType: Sdk.Seaport.Types.OrderType.FULL_RESTRICTED,
      startTime: now,
      endTime: now + expiresIn,
      zoneHash: HashZero,
      salt: getRandomBytes().toHexString(),
      conduitKey: Sdk.Seaport.Addresses.OpenseaConduitKey[this.chainId],
      counter: await new Sdk.Seaport.Exchange(this.chainId)
        .getCounter(this.provider, giver)
        .then((c) => c.toString()),
    });

    // Build mirror order
    const mirrorOrder = new Sdk.Seaport.Order(this.chainId, {
      kind: "single-token",
      offerer: receiver,
      zone: AddressZero,
      offer: [],
      consideration: [],
      orderType: Sdk.Seaport.Types.OrderType.PARTIAL_OPEN,
      startTime: now,
      endTime: now + expiresIn,
      zoneHash: HashZero,
      salt: getRandomBytes().toHexString(),
      conduitKey: Sdk.Seaport.Addresses.OpenseaConduitKey[this.chainId],
      counter: await new Sdk.Seaport.Exchange(this.chainId)
        .getCounter(this.provider, receiver)
        .then((c) => c.toString()),
    });

    return { order: order.params, mirrorOrder: mirrorOrder.params };
  }

  public getSignatureData(seaportApprovalOrder: SeaportApprovalOrder) {
    return new Sdk.Seaport.Order(
      this.chainId,
      seaportApprovalOrder.order
    ).getSignatureData();
  }

  public attachAndCheckSignature(
    seaportApprovalOrder: SeaportApprovalOrder,
    signature: string
  ) {
    seaportApprovalOrder.order.signature = signature;
    new Sdk.Seaport.Order(
      this.chainId,
      seaportApprovalOrder.order
    ).checkSignature();
  }

  // Given an already encoded router execution, attach a list of permits to it
  public attachToRouterExecution(
    txData: TxData,
    seaportApprovalOrders: SeaportApprovalOrder[]
  ): TxData {
    const routerIface = new Interface(RouterAbi);
    const executionInfos = routerIface.decodeFunctionData(
      "execute",
      txData.data
    ).executionInfos;

    const seaportModuleIface = new Interface(SeaportModuleAbi);
    return {
      ...txData,
      data: routerIface.encodeFunctionData("execute", [
        [
          {
            module: Sdk.RouterV6.Addresses.SeaportModule[this.chainId],
            data: seaportModuleIface.encodeFunctionData("matchOrders", [
              [
                ...seaportApprovalOrders
                  .map(({ order, mirrorOrder }) => [
                    // Regular order
                    {
                      parameters: {
                        ...order,
                        totalOriginalConsiderationItems:
                          order.consideration.length,
                      },
                      signature: order.signature,
                    },
                    // Mirror order
                    {
                      parameters: {
                        ...mirrorOrder,
                        totalOriginalConsiderationItems:
                          mirrorOrder.consideration.length,
                      },
                      signature: "0x",
                    },
                  ])
                  .flat(),
              ],
              // For each regular order, match the single offer item to the single consideration item
              [
                ...seaportApprovalOrders
                  .map(({ order }, i) =>
                    order.offer.map((_, j) => ({
                      offerComponents: [
                        {
                          orderIndex: i * 2,
                          itemIndex: j,
                        },
                      ],
                      considerationComponents: [
                        {
                          orderIndex: i * 2,
                          itemIndex: j,
                        },
                      ],
                    }))
                  )
                  .flat(),
              ],
            ]),
            value: 0,
          },
          ...executionInfos,
        ],
      ]),
    };
  }
}
