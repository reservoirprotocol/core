import * as Types from "./types";
import { Provider } from "@ethersproject/abstract-provider";
import { bn, getCurrentTimestamp } from "../utils";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import {
  keccak256,
  solidityKeccak256,
  defaultAbiCoder,
  splitSignature,
  _TypedDataEncoder,
} from "ethers/lib/utils";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { OrderParams } from "./order-params";
import * as CommonAddresses from "../common/addresses";
import { Addresses } from ".";
import ExchangeAbi from "./abis/Exchange.json";
import ComplicationAbi from "./abis/Complication.json";

export class Order extends OrderParams {
  constructor(chainId: number, params: Types.OrderInput) {
    super(chainId, params);
  }

  public async sign(signer: TypedDataSigner) {
    const [types, value] = this._getEip712TypesAndValue();
    const sig = splitSignature(
      await signer._signTypedData(this._domain, types, value)
    );
    this.sig = sig;
  }

  public hash() {
    return orderHash(this.getInternalOrder(this));
  }

  public checkValidity() {
    if (
      !this.isSellOrder &&
      this.currency === CommonAddresses.Eth[this.chainId]
    ) {
      throw new Error("Offers cannot be made in ETH");
    }

    const complicationValid =
      this.complication === Addresses.Complication[this.chainId];

    if (!complicationValid) {
      throw new Error("Invalid complication address");
    }
  }

  public async checkFillability(provider: Provider) {
    const chainId = (await provider.getNetwork()).chainId;

    const exchange = new Contract(
      Addresses.Exchange[chainId],
      ExchangeAbi,
      provider
    );

    const complication = new Contract(
      Addresses.Complication[chainId],
      ComplicationAbi,
      provider
    );

    const isNonceValid = await exchange.isNonceValid(this.signer, this.nonce);

    if (!isNonceValid) {
      throw new Error("not-fillable");
    }
  }

  public getMatchingPrice(timestampOverride?: number): BigNumberish {
    const startPrice = bn(this.startPrice);
    const endPrice = bn(this.endPrice);

    if (startPrice.gt(endPrice)) {
      // price is decreasing
      return this.getPrice(timestampOverride ?? getCurrentTimestamp(-60));
    } else if (endPrice.gt(startPrice)) {
      // price is increasing
      return this.getPrice(timestampOverride ?? getCurrentTimestamp(120));
    }
    // price is constant
    return this.getPrice(timestampOverride ?? getCurrentTimestamp());
  }

  protected getPrice(timestamp: number, precision = 4): BigNumberish {
    const startTime = bn(this.startTime);
    const endTime = bn(this.endTime);
    const startPrice = bn(this.startPrice);
    const endPrice = bn(this.endPrice);
    const duration = endTime.sub(startTime);
    let priceDiff: BigNumber;
    if (startPrice.gt(endPrice)) {
      priceDiff = startPrice.sub(endPrice);
    } else {
      priceDiff = endPrice.sub(startPrice);
    }

    if (priceDiff.eq(0) || duration.eq(0)) {
      return startPrice;
    }

    const elapsedTime = bn(timestamp).sub(startTime);
    const precisionMultiplier = bn(10).pow(precision);
    const portion = elapsedTime.gt(duration)
      ? precisionMultiplier
      : elapsedTime.mul(precisionMultiplier).div(duration);
    priceDiff = priceDiff.mul(portion).div(precisionMultiplier);
    const isPriceDecreasing = startPrice.gt(endPrice);

    const priceAtTime = isPriceDecreasing
      ? startPrice.sub(priceDiff)
      : startPrice.add(priceDiff);
    return priceAtTime;
  }
}

export function orderHash(order: Types.InternalOrder): string {
  const fnSign =
    "Order(bool isSellOrder,address signer,uint256[] constraints,OrderItem[] nfts,address[] execParams,bytes extraParams)OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)";
  const orderTypeHash = solidityKeccak256(["string"], [fnSign]);

  const constraints = order.constraints;
  const execParams = order.execParams;
  const extraParams = order.extraParams;

  const constraintsHash = keccak256(
    defaultAbiCoder.encode(
      [
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
      ],
      constraints
    )
  );

  const orderItemsHash = nftsHash(order.nfts);
  const execParamsHash = keccak256(
    defaultAbiCoder.encode(["address", "address"], execParams)
  );

  const calcEncode = defaultAbiCoder.encode(
    ["bytes32", "bool", "address", "bytes32", "bytes32", "bytes32", "bytes32"],
    [
      orderTypeHash,
      order.isSellOrder,
      order.signer,
      constraintsHash,
      orderItemsHash,
      execParamsHash,
      keccak256(extraParams),
    ]
  );

  return keccak256(calcEncode);
}

export function nftsHash(nfts: Types.OrderNFTs[]): string {
  const fnSign =
    "OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)";
  const typeHash = solidityKeccak256(["string"], [fnSign]);

  const hashes = [];
  for (const nft of nfts) {
    const hash = keccak256(
      defaultAbiCoder.encode(
        ["bytes32", "uint256", "bytes32"],
        [typeHash, nft.collection, tokensHash(nft.tokens)]
      )
    );
    hashes.push(hash);
  }
  const encodeTypeArray = hashes.map(() => "bytes32");
  const nftsHash = keccak256(defaultAbiCoder.encode(encodeTypeArray, hashes));

  return nftsHash;
}

export function tokensHash(tokens: Types.OrderNFTs["tokens"]): string {
  const fnSign = "TokenInfo(uint256 tokenId,uint256 numTokens)";
  const typeHash = solidityKeccak256(["string"], [fnSign]);

  const hashes = [];
  for (const token of tokens) {
    const hash = keccak256(
      defaultAbiCoder.encode(
        ["bytes32", "uint256", "uint256"],
        [typeHash, token.tokenId, token.numTokens]
      )
    );
    hashes.push(hash);
  }
  const encodeTypeArray = hashes.map(() => "bytes32");
  const tokensHash = keccak256(defaultAbiCoder.encode(encodeTypeArray, hashes));
  return tokensHash;
}
