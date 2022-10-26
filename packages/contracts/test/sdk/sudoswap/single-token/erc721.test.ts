import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "@ethersproject/units";

import * as Sudoswap from "../../../../../sdk/src/sudoswap";
import PairFactoryAbi from "../../../../../sdk/src/sudoswap/abis/FactoryPair.json";
import PairRouterAbi from "../../../../../sdk/src/sudoswap/abis/RouterPair.json";
import * as Addresses from"../../../../../sdk/src/sudoswap/addresses";

import "@nomiclabs/hardhat-ethers";

import { getChainId } from "../../../utils";

describe("Foundation - SingleToken Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();
  });

  /**
   * npx hardhat test test/sdk/sudoswap/single-token/erc721.test.ts
   */
  // it("Default test: 0", async () => {

  //   let tokenId = 6113;

  //   let addresPDB = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F";
  //   let abiOwnerOf = '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
  //   let contractPDB = new ethers.Contract(addresPDB, abiOwnerOf, ethers.provider);

  //   let owner00 = await contractPDB.ownerOf(tokenId);

  //   // @ts-ignore
  //   let pairFactory = new ethers.Contract(Addresses.PairFactory[1], PairFactoryAbi, ethers.provider); //selling/deposit

  //   let nft = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //PudgyDickbutts
  //   let ids = [tokenId];
  //   let recipient = "0x7794C476806731b74ba2049ccd413218248135DA"; //pool

  //   let data = pairFactory.interface.encodeFunctionData("depositNFTs", [
  //       nft, ids, recipient
  //   ]);

  //   const tx = {
  //     from: owner00,
  //     to: pairFactory.address,
  //     data: data
  //   };

  //   const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);
  //   await impersonatedSigner.sendTransaction(tx);

  //   let owner0x = await contractPDB.ownerOf(tokenId);
  //   expect(owner0x).to.eq(recipient);

  //   // now buy it...

  //   let pairRouter = new ethers.Contract(Addresses.PairRouter[1], PairRouterAbi, ethers.provider); //purchasing

  //   let swapListPair = recipient;
  //   let swapListNftIds = ids;
  //   let ethRecipient =	bob.address;
  //   let nftRecipient =	alice.address;
  //   let deadline =	1666734514;

  //   let data01 = pairRouter.interface.encodeFunctionData("swapETHForSpecificNFTs", [
  //       [[swapListPair, swapListNftIds]], ethRecipient, nftRecipient, deadline
  //   ]);

  //   const tx01 = {
  //       from: alice.address,
  //       to: pairRouter.address,
  //       data: data01,
  //       value: parseEther("0.2")
  //   };

  //   await alice.sendTransaction(tx01);

  //   let owner0y = await contractPDB.ownerOf(tokenId);
  //   expect(owner0y).to.eq(alice.address);
  // });

  it("Default test: 1", async () => {

    let tokenId = 6113;

    let addresPDB = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F";
    let abiOwnerOf = '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
    let contractPDB = new ethers.Contract(addresPDB, abiOwnerOf, ethers.provider);

    let owner00 = await contractPDB.ownerOf(tokenId);

    // @ts-ignore
    let pairFactory = new ethers.Contract(Addresses.PairFactory[chainId], PairFactoryAbi, ethers.provider); //selling/deposit

    let nft = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //PudgyDickbutts
    let ids = [tokenId];
    let recipient = "0x7794C476806731b74ba2049ccd413218248135DA"; //pool

    let data = pairFactory.interface.encodeFunctionData("depositNFTs", [
        nft, ids, recipient
    ]);

    const tx = {
      from: owner00,
      to: pairFactory.address,
      data: data
    };

    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);
    await impersonatedSigner.sendTransaction(tx);

    let owner0x = await contractPDB.ownerOf(tokenId);
    expect(owner0x).to.eq(recipient);

    // now buy it...

    const pairRouter = new Sudoswap.Router(chainId); //purchasing 

    let swapListPair = recipient;
    let swapListNftIds = ids;
    let ethRecipient =	bob.address;
    let nftRecipient =	alice.address;

    let swapList = new Sudoswap.SwapList(swapListPair, swapListNftIds);

    await pairRouter.swapETHForSpecificNFTs(
      alice, [swapList], ethRecipient, nftRecipient, parseEther("0.2").toString()
    );

    let owner0y = await contractPDB.ownerOf(tokenId);
    expect(owner0y).to.eq(alice.address);
  });
});