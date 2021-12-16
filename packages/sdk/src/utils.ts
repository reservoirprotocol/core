import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { randomBytes } from "@ethersproject/random";

// Constants

export const AddressZero = "0x0000000000000000000000000000000000000000";
export const Bytes32Zero =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
export const BytesEmpty = "0x";

export const MaxUint256 = BigNumber.from("0x" + "f".repeat(64));

// Random

export const getRandomBytes32 = () => bn(randomBytes(32));

// BigNumber

export const bn = (value: BigNumberish) => BigNumber.from(value);

// Time

export const getCurrentTimestamp = (delay = 0) =>
  Math.floor(Date.now() / 1000 + delay);

// Ease of use

export const lc = (x: string) => x?.toLowerCase();
export const n = (x: any) => Number(x);
export const s = (x: any) => String(x);
