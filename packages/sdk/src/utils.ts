import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { randomBytes } from "@ethersproject/random";

export const AddressZero = "0x0000000000000000000000000000000000000000";
export const Bytes32Zero =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
export const BytesEmpty = "0x";

export const getRandomBytes32 = () => bn(randomBytes(32));

export const bn = (value: BigNumberish) => BigNumber.from(value);

export const getCurrentTimestamp = (delay = 0) =>
  Math.floor(Date.now() / 1000 + delay);

export const l = (x: string) => x?.toLowerCase();
export const s = (x: any) => x?.toString();
