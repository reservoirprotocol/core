import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { randomBytes } from "@ethersproject/random";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";
import { keccak256 } from "ethers/lib/utils";

// Constants

export const BytesEmpty = "0x";
export const MaxUint256 = BigNumber.from("0x" + "f".repeat(64));

// Random

export const getRandomBytes = (numBytes = 32) => bn(randomBytes(numBytes));

// BigNumber

export const bn = (value: BigNumberish) => BigNumber.from(value);

// Time

export const getCurrentTimestamp = (delay = 0) =>
  Math.floor(Date.now() / 1000 + delay);

// Ease of use

export const lc = (x: string) => x?.toLowerCase();
export const n = (x: any) => (x ? Number(x) : x);
export const s = (x: any) => (x ? String(x) : x);

// Misc

// Use the ASCII US (unit separator) character (code = 31) as a delimiter
const SEPARATOR = "1f";

// Only allow printable ASCII characters
const isPrintableASCII = (value: string) => /^[\x20-\x7F]*$/.test(value);

export const generateSourceBytesV1 = (source?: string) => {
  if (source && !isPrintableASCII(source)) {
    throw new Error("Not a printable ASCII string");
  }

  return source
    ? `${SEPARATOR}${Buffer.from(toUtf8Bytes(source)).toString(
        "hex"
      )}${SEPARATOR}`
    : "";
};

export const generateSourceBytes = (source?: string) => {
  return source ? keccak256(toUtf8Bytes(source)).slice(2, 10) : "";
};

export const getSource = (calldata: string) => {
  try {
    if (calldata.endsWith(SEPARATOR)) {
      const index = calldata.slice(0, -2).lastIndexOf(SEPARATOR);
      // If we cannot find the separated source string within the last
      // 32 bytes of the calldata, we simply assume it is missing
      if (index === -1 || calldata.length - index - 5 > 64) {
        return undefined;
      } else {
        const result = toUtf8String("0x" + calldata.slice(index + 2, -2));
        if (isPrintableASCII(result)) {
          return result;
        } else {
          return undefined;
        }
      }
    }
  } catch {
    return undefined;
  }
};

// Types

export type TxData = {
  from: string;
  to: string;
  data: string;
  value?: string;
};

export enum Network {
  // Ethereum
  Ethereum = 1,
  EthereumRinkeby = 4,
  EthereumGoerli = 5,
  EthereumKovan = 42,
  // Optimism
  Optimism = 10,
  OptimismKovan = 69,
  // Gnosis
  Gnosis = 100,
  // Polygon
  Polygon = 137,
  PolygonMumbai = 80001,
  // Arbitrum
  Arbitrum = 42161,
  // Avalanche
  Avalanche = 43114,
  AvalancheFuji = 43113,
}

export type ChainIdToAddress = { [chainId: number]: string };
export type ChainIdToAddressList = { [chainId: number]: string[] };
export type ChainIdToAddressMap = {
  [chainId: number]: { [address: string]: string };
};
