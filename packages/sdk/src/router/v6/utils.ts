import { Interface } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";

import * as Sdk from "../../index";
import { getCurrentTimestamp, TxData } from "../../utils";
import * as Addresses from "./addresses";
import { NFTPermit } from "./types";

import RouterAbi from "./abis/ReservoirV6_0_0.json";
import SeaportModuleAbi from "./abis/SeaportModule.json";

export const isETH = (chainId: number, address: string) =>
  address.toLowerCase() === Sdk.Common.Addresses.Eth[chainId];

export const isWETH = (chainId: number, address: string) =>
  address.toLowerCase() === Sdk.Common.Addresses.Weth[chainId];

export const generateApprovalTxData = (
  contract: string,
  owner: string,
  operator: string
): TxData => ({
  from: owner,
  to: contract,
  data: new Interface([
    "function setApprovalForAll(address operator, bool isApproved)",
  ]).encodeFunctionData("setApprovalForAll", [operator, true]),
});

export const prependNFTPermits = (
  chainId: number,
  txData: TxData,
  permits: NFTPermit[]
): TxData => {
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
          module: Addresses.SeaportModule[chainId],
          data: seaportModuleIface.encodeFunctionData("matchOrders", [
            [
              ...permits
                .map(({ data: { order, mirrorOrder } }) => [
                  // Regular order
                  {
                    parameters: {
                      ...order.params,
                      totalOriginalConsiderationItems:
                        order.params.consideration.length,
                    },
                    signature: order.params.signature,
                  },
                  // Mirror order
                  {
                    parameters: {
                      ...mirrorOrder.params,
                      totalOriginalConsiderationItems:
                        mirrorOrder.params.consideration.length,
                    },
                    signature: "0x",
                  },
                ])
                .flat(),
            ],
            // For each regular order, match the single offer item to the single consideration item
            [
              ...permits.map((_, i) => ({
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
};

export const generateSeaportApprovalOrder = (
  chainId: number,
  giver: string,
  receiver: string,
  token: {
    kind: "erc721" | "erc1155";
    contract: string;
    tokenId: BigNumberish;
    amount?: BigNumberish;
  },
  expiresIn = 10 * 60
) => {
  const now = getCurrentTimestamp();

  // Build and sign the approval order (in a hacky way)
  const builder = new Sdk.Seaport.Builders.SingleToken(chainId);
  const order = builder.build({
    side: "sell",
    tokenKind: "erc721",
    offerer: giver,
    contract: giver,
    tokenId: 0,
    paymentToken: giver,
    price: 1,
    counter: 0,
    startTime: now,
    endTime: now + expiresIn,
    zone: Sdk.Seaport.Addresses.ApprovalOrderZone[chainId],
    conduitKey: Sdk.Seaport.Addresses.OpenseaConduitKey[chainId],
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

  return { order, mirrorOrder };
};
