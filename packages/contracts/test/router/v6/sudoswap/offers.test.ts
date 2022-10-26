import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "../../../../../sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

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
        factory.deploy(router.address, router.address, Sdk.Sudoswap.Addresses.PairRouter[chainId])
      )) as any;
  });

  const getBalances = async (token: string) => {
    if (token === Sdk.Common.Addresses.Eth[chainId]) {
      return {
        alice: await ethers.provider.getBalance(alice.address),
        bob: await ethers.provider.getBalance(bob.address),
        carol: await ethers.provider.getBalance(carol.address),
        david: await ethers.provider.getBalance(david.address),
        emilio: await ethers.provider.getBalance(emilio.address),
        router: await ethers.provider.getBalance(router.address),
        sudoswapModule: await ethers.provider.getBalance(
          sudoswapModule.address
        ),
      };
    } else {
      const contract = new Sdk.Common.Helpers.Erc20(ethers.provider, token);
      return {
        alice: await contract.getBalance(alice.address),
        bob: await contract.getBalance(bob.address),
        carol: await contract.getBalance(carol.address),
        david: await contract.getBalance(david.address),
        emilio: await contract.getBalance(emilio.address),
        router: await contract.getBalance(router.address),
        sudoswapModule: await contract.getBalance(sudoswapModule.address),
      };
    }
  };

  /**
   * npx hardhat test test/router/v6/sudoswap/offers.test.ts
   */
  it("Sudoswap router test", async () => {
    // Setup

    // Makers: Alice and Bob
    // Taker: Carol
    // Fee recipient: Emilio

    let tokenId = 6113;

    let addresPDB = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F";
    let abiOwnerOf = '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
    let contractPDB = new ethers.Contract(addresPDB, abiOwnerOf, ethers.provider);

    let owner00 = await contractPDB.ownerOf(tokenId);

    const pairFactory = new Sdk.Sudoswap.Exchange(chainId); //selling/deposit 

    let nft = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //PudgyDickbutts
    let ids = [tokenId];
    let recipient = "0x7794C476806731b74ba2049ccd413218248135DA"; //pool

    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);

    // list nft...

    await pairFactory.depositNFTs(impersonatedSigner, nft, ids, recipient);

    // Prepare executions

    let swapListPair = recipient;
    let swapListNftIds = ids;
    let ethRecipient =	bob.address;
    let nftRecipient =	alice.address;

    let swapList = new Sdk.Sudoswap.SwapList(swapListPair, swapListNftIds);

    let sudoswap = new Sdk.Sudoswap.Router(chainId);
    let data = sudoswap.swapETHForSpecificNFTsTxData([swapList], ethRecipient, nftRecipient);
    let value = parseEther("0.2");
    let module = Sdk.Sudoswap.Addresses.PairRouter[chainId];

    let execution: ExecutionInfo[] = [{module: module, data: data, value: value.toString()}];

    // Fetch pre-state

    const balancesBefore = await getBalances(Sdk.Common.Addresses.Eth[chainId]);

    // Execute

    await router.execute(execution, {
      value: parseEther("0.2")
    });

    // Fetch post-state

    const balancesAfter = await getBalances(Sdk.Common.Addresses.Eth[chainId]);

    // Checks

    let owner0y = await contractPDB.ownerOf(tokenId);
    expect(owner0y).to.eq(alice.address);

    // Alice got the payment
   
    // Bob got the payment

    // Emilio got the fee payments

    // Carol got the NFTs from all filled orders

    // Router is stateless
    expect(balancesAfter.router).to.eq(0);
    expect(balancesAfter.sudoswapModule).to.eq(0);
  });

});
