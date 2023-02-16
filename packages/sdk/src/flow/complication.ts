import ComplicationAbi from "./abis/Complication.json";
import * as Addresses from "./addresses";

export function getComplicationAbi(
  complicationAddress: string,
  chainId: number
) {
  if (Addresses.Complication[chainId] === complicationAddress) {
    return ComplicationAbi;
  } else if (Addresses.ComplicationV2[chainId] === complicationAddress) {
    return ComplicationAbi;
  }
}
