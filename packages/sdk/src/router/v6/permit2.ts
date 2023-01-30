import { AllowanceTransfer } from "@uniswap/permit2-sdk";
import * as Sdk from "@reservoir0x/sdk/src";

export const generatePermitSignature = async (
  token: string,
  module: string,
  amount: string,
  chainId: number
) => {
  const permitBatch = {
    details: [
      {
        token,
        amount,
        expiration: Math.floor(new Date().getTime() / 1000) + 86400,
        nonce: 0,
      },
    ],
    spender: module,
    sigDeadline: Math.floor(new Date().getTime() / 1000) + 86400,
  };

  const signatureData = AllowanceTransfer.getPermitData(
    permitBatch,
    Sdk.Common.Addresses.Permit2[chainId],
    chainId
  );

  return signatureData;
};
