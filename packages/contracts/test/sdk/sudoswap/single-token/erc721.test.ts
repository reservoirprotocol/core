import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "@ethersproject/units";

import * as Sudoswap from "../../../../../sdk/src/sudoswap";

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

  it("Default test", async () => {

    let tokenId = 6113;

    let addresPDB = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F";
    let abiOwnerOf = '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
    let contractPDB = new ethers.Contract(addresPDB, abiOwnerOf, ethers.provider);

    let owner00 = await contractPDB.ownerOf(tokenId);

    const pairFactory = new Sudoswap.Exchange(chainId); //selling/deposit 

    let nft = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //PudgyDickbutts
    let ids = [tokenId];
    let recipient = "0x7794C476806731b74ba2049ccd413218248135DA"; //pool

    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);

    // list nft...

    await pairFactory.depositNFTs(impersonatedSigner, nft, ids, recipient);

    let owner0x = await contractPDB.ownerOf(tokenId);
    expect(owner0x).to.eq(recipient);

    // purchase nft...

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