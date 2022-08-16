import { defaultAbiCoder } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import * as Types from "../types";
import { getRandomBytes } from "../../utils";

type BuildParams = {
  user: string;
  network: number;
  deadline: number;
  currency: string;
  price: BigNumberish;
  nft: {
    contract: string;
  };
};

export const buildOrder = async (params: BuildParams) => {
  return {
    salt: getRandomBytes(32).toHexString(),
    user: params.user,
    network: params.network,
    intent: Types.Intent.BUY,
    // At the moment, X2Y2 only supports ERC721 tokens
    delegateType: Types.DelegationType.ERC721,
    deadline: params.deadline,
    currency: params.currency,
    dataMask: defaultAbiCoder.encode(
      ["(address token, uint256 tokenId)[]"],
      [
        [
          {
            token: AddressZero,
            tokenId: "0x" + "1".repeat(64),
          },
        ],
      ]
    ),
    items: [
      {
        price: params.price.toString(),
        data: defaultAbiCoder.encode(
          ["(address token, uint256 tokenId)[]"],
          [
            [
              {
                token: params.nft.contract,
                tokenId: 0,
              },
            ],
          ]
        ),
      },
    ],
    signVersion: 1,
  };
};
