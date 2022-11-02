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

  const getBalances = async (owner: string) => {
      return {
        seller: await ethers.provider.getBalance(owner), 
        module: await ethers.provider.getBalance(sudoswapModule.address)
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
    
    const pairFactory = new Sdk.Sudoswap.Exchange(chainId); //selling/deposit 
    
    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);
  
    // List nft
  
    await pairFactory.depositNFTs(impersonatedSigner, addresTokenPDB, [tokenId], addresPoolPDB);

    let swapListNftIds: number[] = [tokenId];
    let ethRecipient = alice.address;
    let nftRecipient = alice.address;

    let swapList: Sdk.Sudoswap.SwapList = {pair: addresPoolPDB, nftIds: swapListNftIds};

    let sudoswap = new Sdk.Sudoswap.Router(chainId);
    let data = sudoswap.swapETHForSpecificNFTsTxData([swapList], ethRecipient, nftRecipient);
    let value = parseEther("1.0").toString();
    //let module = Sdk.Sudoswap.Addresses.PairRouter[chainId];

    console.log("module 00: " + sudoswapModule.address);

    
    let abi = '[{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"InvalidParams","type":"error"},{"inputs":[],"name":"Unauthorized","type":"error"},{"inputs":[],"name":"UnsuccessfulCall","type":"error"},{"inputs":[],"name":"UnsuccessfulFill","type":"error"},{"inputs":[],"name":"UnsuccessfulPayment","type":"error"},{"inputs":[],"name":"WrongParams","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"target","type":"address"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"CallExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"SUDOSWAP_ROUTER","outputs":[{"internalType":"contract ISudoswapRouter","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claimOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"},{"internalType":"bytes[]","name":"data","type":"bytes[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"}],"name":"makeCalls","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pendingOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"router","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"sayHelloWorld","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"pair","type":"address"},{"internalType":"uint256[]","name":"nftIds","type":"uint256[]"}],"internalType":"struct ISudoswapRouter.PairSwapSpecific[]","name":"swapList","type":"tuple[]"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"components":[{"internalType":"address","name":"fillTo","type":"address"},{"internalType":"address","name":"refundTo","type":"address"},{"internalType":"bool","name":"revertIfIncomplete","type":"bool"},{"internalType":"uint256","name":"amount","type":"uint256"}],"internalType":"struct BaseExchangeModule.ETHListingParams","name":"params","type":"tuple"},{"components":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"internalType":"struct BaseExchangeModule.Fee[]","name":"fees","type":"tuple[]"}],"name":"swapETHForSpecificNFTs","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]';
    let contract = new ethers.Contract(sudoswapModule.address, abi, ethers.provider);
    let data0x = contract.interface.encodeFunctionData("sayHelloWorld", [666]);
    
    //let execution: ExecutionInfo[] = [{module: ethers.utils.getAddress(sudoswapModule.address), data: data0x, value: value}];
    let execution: ExecutionInfo[] = [{module: sudoswapModule.address, data: data0x, value: value}];

    // Execute
    await router.execute(execution, {
      value: value
    });

    // Checks

    //let owner0y = await contractPDB.ownerOf(tokenId);
    //expect(owner0y).to.eq(alice.address);


    
    
  });



});
