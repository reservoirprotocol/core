import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

//import * as Sudoswap from "../../../../../sdk/src/sudoswap";
import PairFactoryAbi from "../../../../../sdk/src/sudoswap/abis/FactoryPair.json";
import PairRouterAbi from "../../../../../sdk/src/sudoswap/abis/RouterPair.json";
import * as Addresses from"../../../../../sdk/src/sudoswap/addresses";

import "@nomiclabs/hardhat-ethers";

describe("Foundation - SingleToken Erc721", () => {

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();
  });

  //let pairRouter = new ethers.Contract(Addresses.PairRouter[1], PairRouterAbi, ethers.provider); //purchasing

  it("Default test", async () => {

    let tokenId = 6113;

    let address = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F";
    let abi = '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
    let pudgyDickbutts = new ethers.Contract(address, abi, ethers.provider);

    let owner00 = await pudgyDickbutts.ownerOf(tokenId);

    // @ts-ignore
    let pairFactory = new ethers.Contract(Addresses.PairFactory[1], PairFactoryAbi, ethers.provider); //selling/deposit

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

    let owner0x = await pudgyDickbutts.ownerOf(tokenId);
    expect(owner0x).to.eq(recipient);

  });
});