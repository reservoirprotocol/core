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

    let ReservoirV6_0_0 = await ethers.getContractFactory("ReservoirV6_0_0");
    router = await ReservoirV6_0_0.deploy() as any;

    let SudoswapModule = await ethers.getContractFactory("SudoswapModule");
    sudoswapModule = await SudoswapModule.deploy(deployer.address) as any;
  });

  /**
   * npx hardhat test test/router/v6/sudoswap/offers.test.ts
   */
  it("Sudoswap router test", async () => {
    // Setup

    const contractPDB = await setupSudoswapTestContract();

    const tokenId: number = 6113; //example token

    const owner00 = await contractPDB.ownerOf(tokenId);
    
    const pairFactory = new Sdk.Sudoswap.Exchange(chainId); //selling/deposit 
    
    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);
  
    // List nft
  
    await pairFactory.depositNFTs(impersonatedSigner, addresTokenPDB, [tokenId], addresPoolPDB);

    let refundTo_balance_00 = await ethers.provider.getBalance(carol.address);

    let value = parseEther("1.0").toString();
    let swapListNftIds: number[] = [tokenId];
    let swapList: Sdk.Sudoswap.SwapList = {pair: addresPoolPDB, nftIds: swapListNftIds};
      let fillTo = alice.address;
      let refundTo = carol.address;
      let revertIfIncomplete = false;
      let amount00 = value;
    let ethListingParams = [fillTo, refundTo, revertIfIncomplete, amount00];
      let recipient = "0x0000000000000000000000000000000000000000";
      let amount01 = 0;
    let fee = [recipient, amount01];

    const sudoswapRouter = new Sdk.Sudoswap.Router(chainId);
    let txnData = sudoswapRouter.swapETHForSpecificNFTsTxData(
      sudoswapModule.address,
      [swapList],
      ethListingParams,
      [fee]
    );

    let execution: ExecutionInfo[] = [{module: sudoswapModule.address, data: txnData, value: value}];

    // Execute
    await router.execute(execution, {
      value: parseEther("1.0").toString()
    });

    // Checks

    let owner0y = await contractPDB.ownerOf(tokenId);
    expect(owner0y).to.eq(alice.address);

    let refundTo_balance_01 = await ethers.provider.getBalance(carol.address);
    expect(refundTo_balance_01).to.be.gt(refundTo_balance_00);

    let router_balance = await ethers.provider.getBalance(router.address);
    expect(router_balance).to.eq(0);
    let module_balance = await ethers.provider.getBalance(sudoswapModule.address);
    expect(module_balance).to.eq(0);

  });

});
