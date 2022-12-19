import { Contract } from "@ethersproject/contracts";
import * as Common from "../common";
import * as Addresses from "./addresses";
import { Provider } from "@ethersproject/abstract-provider";
import { formatEther, parseEther } from "@ethersproject/units";
import { Interface } from "@ethersproject/abi";
import { BigNumber } from "ethers";
import { bn } from "../utils";

export async function getPoolPrice(
  vault: string,
  amount = 1,
  chainId: number,
  provider: Provider
) {
  let buyPrice = null;
  let sellPrice = null;
  let randomBuyPrice = null;

  const iface = new Interface([
    "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)",
    "function getAmountsIn(uint amountOut, address[] memory path) view returns (uint[] memory amounts)",
  ]);

  const WETH = Common.Addresses.Weth[chainId];
  const SUSHI_ROUTER = Addresses.SushiRouter[chainId];

  const sushiRouter = new Contract(SUSHI_ROUTER, iface, provider);

  try {
    const path = [WETH, vault];
    const amounts = await sushiRouter.getAmountsIn(
      parseEther(`${amount}`),
      path
    );
    buyPrice = formatEther(amounts[0]);
  } catch (error) {
    //
  }

  try {
    const path = [vault, WETH];
    const amounts = await sushiRouter.getAmountsOut(
      parseEther(`${amount}`),
      path
    );
    sellPrice = formatEther(amounts[1]);
  } catch (error) {
    //
  }

  const fees = await getPoolFees(vault, provider);
  const base = parseEther(`1`);
  let feeBpsSell = null;
  let feeBpsBuy = null;
  let feeBpsRandomBuy = null;

  if (sellPrice) {
    const price = parseEther(sellPrice).div(bn(amount));
    const mintFeeInETH = bn(fees.mintFee).mul(price).div(base);

    sellPrice = formatEther(price.sub(mintFeeInETH));
    feeBpsSell = mintFeeInETH
      .mul(bn(10000))
      .div(parseEther(sellPrice))
      .toString();
  }

  if (buyPrice) {
    // 1 ETH = x Vault Token
    const price = parseEther(buyPrice).div(bn(amount));
    const targetBuyFeeInETH = bn(fees.targetRedeemFee).mul(price).div(base);
    const randomBuyFeeInETH = bn(fees.randomRedeemFee).mul(price).div(base);

    buyPrice = formatEther(price.add(targetBuyFeeInETH));
    randomBuyPrice = formatEther(price.add(randomBuyFeeInETH));
    feeBpsBuy = targetBuyFeeInETH
      .mul(bn(10000))
      .div(parseEther(buyPrice))
      .toString();
    feeBpsRandomBuy = randomBuyFeeInETH
      .mul(bn(10000))
      .div(parseEther(randomBuyPrice))
      .toString();
  }

  return {
    fees,
    amount,
    bps: {
      sell: feeBpsSell,
      buy: feeBpsBuy,
      randomBuy: feeBpsRandomBuy,
    },
    currency: WETH,
    sell: sellPrice,
    buy: buyPrice,
    buyRandom: randomBuyPrice,
  };
}

export async function getPoolNFTs(vault: string, provider: Provider) {
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
}

export async function getPoolFees(address: string, provider: Provider) {
  const iface = new Interface([
    "function mintFee() public view returns (uint256)",
    "function targetRedeemFee() public view returns (uint256)",
    "function randomRedeemFee() public view returns (uint256)",
  ]);

  const vault = new Contract(address, iface, provider);

  const [mintFee, targetRedeemFee, randomRedeemFee] = await Promise.all([
    vault.mintFee(),
    vault.targetRedeemFee(),
    vault.randomRedeemFee(),
  ]);

  return {
    mintFee: mintFee.toString(),
    randomRedeemFee: randomRedeemFee.toString(),
    targetRedeemFee: targetRedeemFee.toString(),
  };
}
