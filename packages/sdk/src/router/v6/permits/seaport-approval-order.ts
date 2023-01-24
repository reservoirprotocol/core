import { Interface } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import * as Sdk from "../../../index";
import { TxData, getCurrentTimestamp } from "../../../utils";

import RouterAbi from "../abis/ReservoirV6_0_0.json";
import SeaportModuleAbi from "../abis/SeaportModule.json";

export type SeaportApprovalOrder = {
  order: Sdk.Seaport.Types.OrderComponents;
  mirrorOrder: Sdk.Seaport.Types.OrderComponents;
};

export class SeaportApprovalOrderHandler {
  public chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  public generate(
    giver: string,
    receiver: string,
    token: {
      kind: "erc721" | "erc1155";
      contract: string;
      tokenId: BigNumberish;
      amount?: BigNumberish;
    },
    expiresIn = 10 * 60
  ): SeaportApprovalOrder {
    const now = getCurrentTimestamp();

    // Build approval order
    const builder = new Sdk.Seaport.Builders.SingleToken(this.chainId);
    const order = builder.build({
      side: "sell",
      tokenKind: token.kind,
      offerer: giver,
      contract: token.contract,
      tokenId: token.tokenId,
      paymentToken: AddressZero,
      price: 0,
      counter: 0,
      amount: (token.amount ?? "1").toString(),
      startTime: now,
      endTime: now + expiresIn,
      zone: Sdk.Seaport.Addresses.ApprovalOrderZone[this.chainId],
      conduitKey: Sdk.Seaport.Addresses.OpenseaConduitKey[this.chainId],
    });

    // Tweak the offer and consideration items
    order.params.offer = [
      {
        itemType: token.kind === "erc721" ? 2 : 3,
        token: token.contract,
        identifierOrCriteria: token.tokenId.toString(),
        startAmount: (token.amount ?? "1").toString(),
        endAmount: (token.amount ?? "1").toString(),
      },
    ];
    order.params.consideration = [
      {
        ...order.params.offer[0],
        recipient: receiver,
      },
    ];

    // Build mirror order
    const mirrorOrder = builder.build({
      side: "sell",
      tokenKind: "erc721",
      offerer: receiver,
      contract: giver,
      tokenId: 0,
      paymentToken: giver,
      price: 1,
      counter: 0,
      startTime: now,
      endTime: now + expiresIn,
    });

    // Tweak the offer and consideration items
    mirrorOrder.params.offer = [];
    mirrorOrder.params.consideration = [];

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
                ...seaportApprovalOrders.map((_, i) => ({
                  offerComponents: [
                    {
                      orderIndex: i * 2,
                      itemIndex: 0,
                    },
                  ],
                  considerationComponents: [
                    {
                      orderIndex: i * 2,
                      itemIndex: 0,
                    },
                  ],
                })),
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
