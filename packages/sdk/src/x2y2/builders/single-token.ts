import { defaultAbiCoder } from "@ethersproject/abi";
import { BigNumberish } from "@ethersproject/bignumber";

import * as Types from "../types";
import { getRandomBytes } from "../../utils";

type BuildParams = {
  user: string;
  network: number;
  side: "sell" | "buy";
  deadline: number;
  currency: string;
  price: BigNumberish;
  nft: {
    contract: string;
    id: BigNumberish;
  };
};

export const buildOrder = async (params: BuildParams) => {
  return {
    salt: getRandomBytes(32).toHexString(),
    user: params.user,
    network: params.network,
    intent: params.side === "sell" ? Types.Intent.SELL : Types.Intent.BUY,
    // At the moment, X2Y2 only supports ERC721 tokens
    delegateType: Types.DelegationType.ERC721,
    deadline: params.deadline,
    currency: params.currency,
    dataMask: "0x",
    items: [
      {
        price: params.price.toString(),
        data: defaultAbiCoder.encode(
          ["(address token, uint256 tokenId)[]"],
          [
            [
              {
                token: params.nft.contract,
                tokenId: params.nft.id,
              },
            ],
          ]
        ),
      },
    ],
    signVersion: 1,
  };
};
