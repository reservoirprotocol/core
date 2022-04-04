import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractTransaction } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { Order } from "./order";
import * as Types from "./types";
import { TxData, bn, BytesEmpty } from "../utils";

import ExchangeAbi from "./abis/Exchange.json";
import Erc721Abi from "../common/abis/Erc721.json";
import Erc1155Abi from "../common/abis/Erc1155.json";

export class Exchange {
  public chainId: number;

  constructor(chainId: number) {
    if (chainId !== 1 && chainId !== 3) {
      throw new Error("Unsupported chain id");
    }

    this.chainId = chainId;
  }

  public async match(
    taker: Signer,
    order: Order,
    matchParams: Types.MatchParams
  ): Promise<ContractTransaction | undefined> {
    const exchange = new Contract(
      Addresses.Exchange[this.chainId],
      ExchangeAbi,
      taker
    );

    if (order.params.kind?.startsWith("erc721")) {
      const erc721 = new Contract(order.params.nft, Erc721Abi, taker);
      if (order.params.direction === Types.TradeDirection.BUY) {
        return erc721["safeTransferFrom(address,address,uint256,bytes)"](
          await taker.getAddress(),
          exchange.address,
          matchParams.nftId!,
          defaultAbiCoder.encode(
            [Erc721OrderAbiType, SignatureAbiType, "bool"],
            [order.getRaw(), order.getRaw(), true]
          )
        );
      } else {
        return exchange.buyERC721(order.getRaw(), order.getRaw(), BytesEmpty, {
          value: order.params.erc20TokenAmount,
        });
      }
    } else {
      const erc1155 = new Contract(order.params.nft, Erc1155Abi, taker);
      if (order.params.direction === Types.TradeDirection.BUY) {
        return erc1155.safeTransferFrom(
          await taker.getAddress(),
          exchange.address,
          matchParams.nftId!,
          matchParams.nftAmount!,
          defaultAbiCoder.encode(
            [Erc1155OrderAbiType, SignatureAbiType, "bool"],
            [order.getRaw(), order.getRaw(), true]
          )
        );
      } else {
        return exchange.buyERC1155(
          order.getRaw(),
          order.getRaw(),
          matchParams.nftAmount!,
          BytesEmpty,
          {
            value: bn(order.params.erc20TokenAmount).div(
              matchParams.nftAmount!
            ),
          }
        );
      }
    }
  }
}

const Erc721OrderAbiType = `(
  uint8 direction,
  address maker,
  address taker,
  uint256 expiry,
  uint256 nonce,
  address erc20Token,
  uint256 erc20TokenAmount,
  (address recipient, uint256 amount, bytes feeData)[] fees,
  address erc721Token,
  uint256 erc721TokenId,
  (address propertyValidator, bytes propertyData)[] erc721TokenProperties
)`;

const Erc1155OrderAbiType = `(
  uint8 direction,
  address maker,
  address taker,
  uint256 expiry,
  uint256 nonce,
  address erc20Token,
  uint256 erc20TokenAmount,
  (address recipient, uint256 amount, bytes feeData)[] fees,
  address erc1155Token,
  uint256 erc1155TokenId,
  (address propertyValidator, bytes propertyData)[] erc1155TokenProperties,
  uint128 erc1155TokenAmount
)`;

const SignatureAbiType = `(
  uint8 signatureType,
  uint8 v,
  bytes32 r,
  bytes32 s
)`;
