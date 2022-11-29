import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";
import { Token } from "@uniswap/sdk-core";

export const getToken = async (
  chainId: number,
  provider: Provider,
  address: string
): Promise<Token> => {
  const contract = new Contract(
    address,
    new Interface(["function decimals() view returns (uint8)"]),
    provider
  );

  return new Token(chainId, address, await contract.decimals());
};
