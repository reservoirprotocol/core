import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "@reservoir0x/sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";

describe("Router V1 - ERC721", () => {
  let chainId: number;

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;

  let router: Contract;

  beforeEach(async () => {
    chainId = (network.config as any).forking.url.includes("mainnet") ? 1 : 4;
    [deployer, alice] = await ethers.getSigners();

    router = await upgrades.deployProxy(
      await ethers.getContractFactory("RouterV1", deployer),
      [
        Sdk.Common.Addresses.Weth[chainId],
        Sdk.LooksRare.Addresses.Exchange[chainId],
        Sdk.WyvernV23.Addresses.Exchange[chainId],
        Sdk.ZeroExV4.Addresses.Exchange[chainId],
      ]
    );
  });

  afterEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: (network.config as any).forking.url,
            blockNumber: (network.config as any).forking.blockNumber,
          },
        },
      ],
    });
  });

  it("Recover stucked ETH and WETH", async () => {
    // Send ETH to the router
    const ethAmount = parseEther("1");
    await deployer.sendTransaction({
      to: router.address,
      value: ethAmount,
    });

    expect(await ethers.provider.getBalance(router.address)).to.eq(ethAmount);

    // Send WETH to the router
    const wethAmount = parseEther("0.5");
    const weth = new Sdk.Common.Helpers.Weth(ethers.provider, chainId);
    await weth.deposit(deployer, wethAmount);
    await weth.transfer(deployer, router.address, wethAmount);

    expect(await weth.getBalance(router.address)).to.eq(wethAmount);

    const targets = [alice.address, weth.contract.address];
    const data = [
      "0x",
      weth.transferTransaction(router.address, alice.address, wethAmount).data,
    ];
    const values = [ethAmount, 0];

    // Only admin can trigger calls
    await expect(
      router.connect(alice).makeCalls(targets, data, values)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    const aliceEthBalanceBefore = await alice.getBalance();

    await router.connect(deployer).makeCalls(targets, data, values);

    const aliceEthBalanceAfter = await alice.getBalance();
    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
    expect(aliceEthBalanceAfter.sub(aliceEthBalanceBefore)).to.eq(ethAmount);
    expect(await weth.getBalance(router.address)).to.eq(0);
    expect(await weth.getBalance(alice.address)).to.eq(wethAmount);
  });
});
