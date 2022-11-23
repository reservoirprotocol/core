import { constants } from "ethers";
import { bn, lc, n } from "../utils";
import * as Types from "./types";

export class Order {
  public chainId: number;
  public params: Types.ContractListing;

  constructor(chainId: number, params: Types.ApiListing) {
    this.chainId = chainId;

    try {
      this.params = normalize(params);
    } catch (err) {
      console.log(err);
      throw new Error("Invalid params");
    }

    if (this.params.details.startTime > this.params.details.endTime) {
      throw new Error("Invalid listing  start and/or expiration time");
    }
  }
}

const bnHexToString = (bnHex: Types.BNHex) => {
  return bn(bnHex.hex).toString();
};

const normalize = (order: Types.ApiListing): Types.ContractListing => {
  // Perform some normalization operations on the order:
  // - convert bignumbers to strings where needed
  // - convert strings to numbers where needed
  // - lowercase all strings

  //TODO: Verify which params can be undefined and handle accordingly
  return {
    id: order.id,
    seller: lc(order.seller),
    details: {
      ...order.details,
      initialAmount: bnHexToString(order.details.initialAmount),
      erc20: lc(order.details.erc20 || constants.AddressZero),
      identityVerifier: lc(
        order.details.identityVerifier || constants.AddressZero
      ),
      totalAvailable: n(order.details.totalAvailable || 0),
      totalPerSale: n(order.details.totalPerSale || 0),
      minIncrementBPS: n(order.details.minIncrementBPS || 0),
    },
    token: {
      ...order.token,
      id: bnHexToString(order.token.id),
      address_: lc(order.token.address_),
      spec:
        order.token.spec.toLowerCase() === "erc721"
          ? Types.Spec.ERC721
          : order.token.spec.toLowerCase() === "erc1155"
          ? Types.Spec.ERC1155
          : Types.Spec.NONE,
    },
    fees: {
      deliverFixed: order.fees.deliverFixed || 0,
      deliverBPS: order.fees.deliverBPS || 0,
    },
  };
};
