import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "../../../../../sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { setupSudoswapTestContract, addresTokenPDB, addresPoolPDB } from "../helpers/sudoswap";

import { ExecutionInfo } from "../helpers/router";

import SudoswapModuleAbi from "../../../../../sdk/src/router/v6/abis/SudoswapModule.json";

import {
  bn,
  getChainId,
  getCurrentTimestamp,
  reset,
  setupNFTs,
  setupRouterWithModules,
} from "../../../utils";
import { ListingDetails } from "@reservoir0x/sdk/src/router/v6/types";

describe("[ReservoirV6_0_0] - filling listings via the SDK", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let david: SignerWithAddress;
  let emilio: SignerWithAddress;

  let router: Contract;
  let sudoswapModule: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, david, emilio] = await ethers.getSigners();

    let ReservoirV6_0_0 = await ethers.getContractFactory("ReservoirV6_0_0");
    router = await ReservoirV6_0_0.deploy() as any;

    let SudoswapModule = await ethers.getContractFactory("SudoswapModule");
    sudoswapModule = await SudoswapModule.deploy(deployer.address) as any;
  });

  afterEach(reset);

  it("Router method", async () => {

    // Setup

    const buyer = alice;

    const contractPDB = await setupSudoswapTestContract();

    const tokenId: number = 6113; //example token

    const seller = await contractPDB.ownerOf(tokenId);
    
    const pairFactory = new Sdk.Sudoswap.Exchange(chainId); //selling/deposit 
    
    const impersonatedSigner = await ethers.getImpersonatedSigner(seller);
    
    // List nft
    
    await pairFactory.depositNFTs(impersonatedSigner, addresTokenPDB, [tokenId], addresPoolPDB);

    let value = parseEther("1.0").toString();

    let orderParams: Sdk.Sudoswap.OrderParams = { 
      pair: addresPoolPDB,
      price: value
    };

    let sellOrder: Sdk.Sudoswap.Order = {
        chainId: chainId,
        params: orderParams
    };

    let feeRecipient = emilio;
    const feesOnTop = [
      {
        recipient: feeRecipient.address,
        amount: parseEther("0.03"),
      }
    ];

    const sellOrders: ListingDetails[] = [];
    sellOrders.push({
        kind: "sudoswap",
        contractKind: "erc721",
        contract: addresPoolPDB,
        tokenId: tokenId.toString(),
        order: sellOrder,
        currency: Sdk.Common.Addresses.Eth[chainId],
    });


    const router = new Sdk.RouterV6.Router(chainId, ethers.provider);
    router.contracts.sudoswapModule = new Contract(
        sudoswapModule.address, 
        SudoswapModuleAbi,
        ethers.provider
    )
    //TODO: ^remove once mainnet deployed


    const { txData } = await router.fillListingsTx(
      sellOrders,
      buyer.address,
      Sdk.Common.Addresses.Eth[chainId],
      {
        source: "reservoir.market",
        globalFees: feesOnTop,
      }
    );
    await alice.sendTransaction(txData);

    const feeRecipientEthBalanceAfter = await feeRecipient.getBalance();
    const sellerEthBalanceAfter = await seller.getBalance();
    const tokenOwnerAfter = await contractPDB.ownerOf(tokenId);
    
    expect(feeRecipientEthBalanceAfter.sub(feeRecipientEthBalanceBefore)).to.eq(
      feesOnTop.map(({ amount }) => bn(amount)).reduce((a, b) => a.add(b))
    );
    expect(seller1EthBalanceAfter.sub(seller1EthBalanceBefore)).to.eq(
      price1.sub(price1.mul(fee1).div(10000))
    );
    expect(seller2WethBalanceAfter.sub(seller2WethBalanceBefore)).to.eq(
      price2.sub(price2.mul(fee2).div(10000))
    );
    expect(seller3EthBalanceAfter.sub(seller3EthBalanceBefore)).to.eq(
      price3
        .mul(amount3)
        .add(totalAmount3 + 1)
        .div(totalAmount3)
    );
    expect(tokenOwnerAfter).to.eq(buyer.address);
    expect(token2OwnerAfter).to.eq(buyer.address);
    expect(token3BuyerBalanceAfter).to.eq(amount3);

    // Router is stateless (it shouldn't keep any funds)
    expect(
      await ethers.provider.getBalance(router.contracts.router.address)
    ).to.eq(0);
    expect(
      await ethers.provider.getBalance(router.contracts.looksRareModule.address)
    ).to.eq(0);
    expect(
      await ethers.provider.getBalance(router.contracts.seaportModule.address)
    ).to.eq(0);
    expect(
      await ethers.provider.getBalance(router.contracts.zeroExV4Module.address)
    ).to.eq(0);


  });

});
