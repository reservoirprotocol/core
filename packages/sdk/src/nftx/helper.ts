import { Contract } from "@ethersproject/contracts";
import * as Common from "../common";
import * as Addresses from "./addresses";
import { Provider } from "@ethersproject/abstract-provider";
import { formatEther, parseEther } from "@ethersproject/units";
import { Interface } from "@ethersproject/abi";
import { BigNumber, BigNumberish } from "ethers";
import { bn } from "../utils";

export const DEFAULT_SLIPPAGE = 5; 

function addSlippage(price: BigNumber, percent: number) {
  return price.add(price.mul(percent).div(bn(100)));
}

function subSlippage(price: BigNumber, percent: number) {
  return price.sub(price.mul(percent).div(bn(100)))
}

export async function getPoolPrice(
  vault: string,
  amount = 1,
  slippage = DEFAULT_SLIPPAGE,
  chainId: number,
  provider: Provider
) {

  let buyPrice: BigNumberish | null = null;
  let sellPrice: BigNumberish | null = null;
  let randomBuyPrice: BigNumberish | null = null;

  let buyPriceRaw: BigNumberish | null = null;
  let sellPriceRaw: BigNumberish | null = null;
  let randomBuyPriceRaw: BigNumberish | null = null;

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
    buyPrice = amounts[0]
  } catch (error) {
    //
  }

  try {
    const path = [vault, WETH];
    const amounts = await sushiRouter.getAmountsOut(
      parseEther(`${amount}`),
      path
    );
    sellPrice = amounts[1];
  } catch (error) {
    //
  }

  const fees = await getPoolFees(vault, provider);
  const base = parseEther(`1`);

  let feeBpsSell = null;
  let feeBpsBuy = null;
  let feeBpsRandomBuy = null;

  if (sellPrice) {
    const price = bn(sellPrice).div(bn(amount));
    const mintFeeInETH = bn(fees.mintFee).mul(price).div(base);
    sellPriceRaw = price.sub(mintFeeInETH)
    sellPrice = subSlippage(sellPriceRaw, slippage);
    feeBpsSell = mintFeeInETH
      .mul(bn(10000))
      .div(
        sellPriceRaw
      )
      .toString();
  }

  if (buyPrice) {
    // 1 ETH = x Vault Token
    const price = bn(buyPrice).div(bn(amount));
    const targetBuyFeeInETH = bn(fees.targetRedeemFee).mul(price).div(base);
    const randomBuyFeeInETH = bn(fees.randomRedeemFee).mul(price).div(base);

    buyPriceRaw = price.add(targetBuyFeeInETH);
    randomBuyPriceRaw = price.add(randomBuyFeeInETH);

    buyPrice = addSlippage(buyPriceRaw, slippage);
    randomBuyPrice = addSlippage(randomBuyPriceRaw, slippage);
 
    feeBpsBuy = targetBuyFeeInETH
      .mul(bn(10000))
      .div(buyPriceRaw)
      .toString();

    feeBpsRandomBuy = randomBuyFeeInETH
      .mul(bn(10000))
      .div(randomBuyPriceRaw)
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
    slippage,
    raw: {
      sell: sellPriceRaw?.toString(),
      buy: buyPriceRaw?.toString(),
      buyRandom: randomBuyPriceRaw?.toString(),
    },
    currency: WETH,
    sell: sellPrice?.toString(),
    buy: buyPrice?.toString(),
    buyRandom: randomBuyPrice?.toString(),
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
