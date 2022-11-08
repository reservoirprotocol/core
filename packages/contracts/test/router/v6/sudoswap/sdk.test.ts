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
    let swapList = [addresPoolPDB, swapListNftIds];
        let fillTo = alice.address;
        let refundTo = carol.address;
        let revertIfIncomplete = false;
        let amount00 = value;
    let ethListingParams = [fillTo, refundTo, revertIfIncomplete, amount00];
        let recipient = "0x0000000000000000000000000000000000000000";
        let amount01 = 0;
    let fee = [recipient, amount01];

    //const sudoswapRouter = new Sdk.Sudoswap.Router(chainId);
    //let txnData = sudoswapRouter.swapETHForSpecificNFTsTxData(
      //sudoswapModule.address,
      //[swapList],
      //ethListingParams,
      //[fee]
    //);
    //let execution: ExecutionInfo[] = [{module: sudoswapModule.address, data: txnData, value: value}];

    //^^^this has got to become part of the _order_

    let sellOrder: Sdk.Sudoswap.Order = {
        chainId: chainId, 
        swapList: swapList,
        deadline: Math.floor(Date.now() / 1000) + 10 * 60,
        price: value
    };

    const feesOnTop = [
        {
          recipient: emilio.address,
          amount: parseEther("0.03"),
        },
    ];

    console.log("addresPoolPDB: " + addresPoolPDB);

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

    const { txData } = await router.fillListingsTx(
      sellOrders,
      alice.address,
      Sdk.Common.Addresses.Eth[chainId],
      {
        source: "reservoir.market",
        globalFees: feesOnTop,
      }
    );
    await alice.sendTransaction(txData);
  });

});
