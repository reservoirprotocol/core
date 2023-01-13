import { Interface } from "@ethersproject/abi";
import { Provider } from "@ethersproject/abstract-provider";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";

import * as Common from "../common";
import { bn } from "../utils";
import * as Addresses from "./addresses";

export const getPoolPrice = async (
  vault: string,
  amount: BigNumberish,
  slippage: number,
  provider: Provider
) => {
  const iface = new Interface([
    "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)",
    "function getAmountsIn(uint amountOut, address[] memory path) view returns (uint[] memory amounts)",
  ]);

  const chainId = await provider.getNetwork().then((n) => n.chainId);

  const weth = Common.Addresses.Weth[chainId];
  const sushiRouter = new Contract(
    Addresses.SushiRouter[chainId],
    iface,
    provider
  );

  const localAmount = parseEther(amount.toString());
  const fees = await getPoolFees(vault, provider);
  const unit = parseEther("1");

  let buyPrice: BigNumberish | null = null;
  let sellPrice: BigNumberish | null = null;

  try {
    const path = [weth, vault];
    const amounts = await sushiRouter.getAmountsIn(
      localAmount.add(localAmount.mul(fees.redeemFee).div(unit)),
      path
    );
    buyPrice = amounts[0].div(amount);
    if (slippage) {
      buyPrice = bn(buyPrice!).add(bn(buyPrice!).mul(slippage).div(10000));
    }
  } catch {
    // Skip errors
  }

  try {
    const path = [vault, weth];
    const amounts = await sushiRouter.getAmountsOut(localAmount, path);
    sellPrice = amounts[1].div(amount);
    if (slippage) {
      sellPrice = bn(sellPrice!).sub(bn(sellPrice!).mul(slippage).div(10000));
    }
  } catch {
    // Skip errors
  }

  return {
    amount,
    currency: weth,
    feeBps: {
      sell: bn(fees.mintFee).div("100000000000000").toString(),
      buy: bn(fees.redeemFee).div("100000000000000").toString(),
    },
    price: {
      sell: sellPrice?.toString(),
      buy: buyPrice?.toString(),
    },
  };
};

export const getPoolNFTs = async (vault: string, provider: Provider) => {
  const tokenIds: string[] = [];
  const iface = new Interface([
    "function allHoldings() external view returns (uint256[] memory)",
  ]);

  const factory = new Contract(vault, iface, provider);
  try {
    const holdingNFTs = await factory.allHoldings();
    holdingNFTs.forEach((c: BigNumber) => {
      tokenIds.push(c.toString());
    });
  } catch {
    // Skip errors
  }
  return tokenIds;
};

export const getPoolFees = async (address: string, provider: Provider) => {
  const iface = new Interface([
    "function mintFee() public view returns (uint256)",
    "function targetRedeemFee() public view returns (uint256)",
  ]);

  const vault = new Contract(address, iface, provider);
  const [mintFee, redeemFee] = await Promise.all([
    vault.mintFee(),
    vault.targetRedeemFee(),
  ]);

  return {
    mintFee: mintFee.toString(),
    redeemFee: redeemFee.toString(),
  };
};
