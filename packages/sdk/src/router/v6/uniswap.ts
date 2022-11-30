import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { BigNumberish } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { Protocol } from "@uniswap/router-sdk";
import {
  Currency,
  CurrencyAmount,
  Ether,
  Percent,
  Token,
  TradeType,
} from "@uniswap/sdk-core";
import { AlphaRouter, SwapType } from "@uniswap/smart-order-router";

import { ExecutionInfo } from "./types";
import * as Sdk from "../../index";

const getToken = async (
  chainId: number,
  provider: Provider,
  address: string
): Promise<Currency> => {
  const contract = new Contract(
    address,
    new Interface(["function decimals() view returns (uint8)"]),
    provider
  );

  return address === Sdk.Common.Addresses.Eth[chainId]
    ? Ether.onChain(chainId)
    : new Token(chainId, address, await contract.decimals());
};

export const generateSwapExecution = async (
  chainId: number,
  provider: Provider,
  fromTokenAddress: string,
  toTokenAddress: string,
  exactToTokenAmount: BigNumberish,
  uniswapV3Module: Contract,
  recipient: string,
  refundTo: string
): Promise<ExecutionInfo> => {
  const router = new AlphaRouter({
    chainId: chainId,
    provider: provider as any,
  });

  const fromToken = await getToken(chainId, provider, fromTokenAddress);
  const toToken = await getToken(chainId, provider, toTokenAddress);

  const route = await router.route(
    CurrencyAmount.fromRawAmount(toToken, exactToTokenAmount.toString()),
    fromToken,
    TradeType.EXACT_OUTPUT,
    {
      type: SwapType.SWAP_ROUTER_02,
      recipient: recipient,
      slippageTolerance: new Percent(5, 100),
      deadline: Math.floor(Date.now() / 1000 + 1800),
    },
    {
      protocols: [Protocol.V3],
      maxSwapsPerPath: 1,
    }
  );
  if (!route) {
    throw new Error("Could not generate route");
  }

  // Currently, the UniswapV3 module only supports 'exact-output-single' types of swaps
  const iface = new Interface([
    `function multicall(uint256 deadline, bytes[] calldata data)`,
    `
      function exactOutputSingle(
        tuple(
          address tokenIn,
          address tokenOut,
          uint24 fee,
          address recipient,
          uint256 amountOut,
          uint256 amountInMaximum,
          uint160 sqrtPriceLimitX96
        ) params
      )
    `,
  ]);

  let params: any;
  try {
    // Properly handle multicall-wrapping
    let calldata = route.methodParameters!.calldata;
    if (calldata.startsWith(iface.getSighash("multicall"))) {
      const decodedMulticall = iface.decodeFunctionData("multicall", calldata);
      for (const data of decodedMulticall.data) {
        if (data.startsWith(iface.getSighash("exactOutputSingle"))) {
          calldata = data;
          break;
        }
      }
    }

    params = iface.decodeFunctionData("exactOutputSingle", calldata);
  } catch {
    throw new Error("Could not generate compatible route");
  }

  return {
    module: uniswapV3Module.address,
    data: uniswapV3Module.interface.encodeFunctionData("ethToExactOutput", [
      params.params,
      refundTo,
    ]),
    value: params.params.amountInMaximum,
  };
};
