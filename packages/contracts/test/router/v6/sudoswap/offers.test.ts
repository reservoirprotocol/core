import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "../../../../../sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { setupSudoswapPoolListing } from "../../helpers/sudoswap";

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

  /**
   * npx hardhat test test/router/v6/sudoswap/offers.test.ts
   */
  it("Sudoswap router test", async () => {
    // Setup

    const tokenId: number = 6113; //example token
    const pool: string = "0x7794C476806731b74ba2049ccd413218248135DA";

    const contractPDB = await setupSudoswapPoolListing(tokenId, pool);

    // Prepare executions

    let swapListPair: string = pool;
    let swapListNftIds: number[] = [tokenId];
    let ethRecipient =	bob.address;
    let nftRecipient =	alice.address;

    let swapList: Sdk.Sudoswap.SwapList = {pair: swapListPair, nftIds: swapListNftIds};

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
