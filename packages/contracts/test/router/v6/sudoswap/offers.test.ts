import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "../../../../../sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { setupSudoswapTestContract, addresTokenPDB, addresPoolPDB } from "../../helpers/sudoswap";

import { ExecutionInfo } from "../../helpers/router";
import {
  getChainId
} from "../../../utils";

describe("[ReservoirV6_0_0] Sudoswap offers", () => {
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

    router = (await ethers
      .getContractFactory("ReservoirV6_0_0", deployer)
      .then((factory) => factory.deploy())) as any;
    sudoswapModule = (await ethers
      .getContractFactory("SudoswapModule", deployer)
      .then((factory) =>
        factory.deploy(router.address, router.address)
      )) as any;
  });

  const getBalances = async (tokenOwner00: string, tokenOwner01?: string) => {
      return {
        seller: await ethers.provider.getBalance(tokenOwner00),
        tokenOwner01: tokenOwner01 == null ? ethers.BigNumber.from("0") : await ethers.provider.getBalance(tokenOwner01), 
        sudoswapModule: await ethers.provider.getBalance(
          sudoswapModule.address
        ),
      };
  };

  /**
   * npx hardhat test test/router/v6/sudoswap/offers.test.ts
   */
  it("Sudoswap router test", async () => {
    // Setup

    const contractPDB = await setupSudoswapTestContract();

    const tokenId: number = 6113; //example token

    const owner00 = await contractPDB.ownerOf(tokenId);

    let makerBalance00 = await getBalances(owner00);
    
    const pairFactory = new Sdk.Sudoswap.Exchange(chainId); //selling/deposit 
    
    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);
  
    // List nft
  
    let txnPre = await pairFactory.depositNFTs(impersonatedSigner, addresTokenPDB, [tokenId], addresPoolPDB);
    let txnPost = await txnPre.wait();
    let txnCost = txnPost.cumulativeGasUsed.mul(txnPost.effectiveGasPrice);

    let makerBalance01 = await getBalances(owner00);
    let balanceAfterTxnBN = makerBalance01.seller;
    let balanceAfterTxn = balanceAfterTxnBN.toString();
    let startingBalanceSubTxnCost = makerBalance00.seller.sub(txnCost).toString();
    expect(balanceAfterTxn).to.eq(startingBalanceSubTxnCost);

    let swapListNftIds: number[] = [tokenId];
    let ethRecipient = alice.address;
    let nftRecipient = alice.address;

    let swapList: Sdk.Sudoswap.SwapList = {pair: addresPoolPDB, nftIds: swapListNftIds};

    let sudoswap = new Sdk.Sudoswap.Router(chainId);
    let data = sudoswap.swapETHForSpecificNFTsTxData([swapList], ethRecipient, nftRecipient);
    let value = parseEther("0.2");
    let module = Sdk.Sudoswap.Addresses.PairRouter[chainId];

    let execution: ExecutionInfo[] = [{module: module, data: data, value: value.toString()}];

    // Execute

    await router.execute(execution, {
      value: parseEther("0.2")
    });

    // Checks

    let owner0y = await contractPDB.ownerOf(tokenId);
    expect(owner0y).to.eq(alice.address);
    
  });



});
