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

    // @ts-ignore
    let pairFactory = new ethers.Contract(Addresses.PairFactory[1], PairFactoryAbi, ethers.provider); //selling/deposit

    let nft = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //PudgyDickbutts
    let ids = [6113];
    let recipient = "0x7794C476806731b74ba2049ccd413218248135DA"; //pool

    let data = pairFactory.interface.encodeFunctionData("depositNFTs", [
        nft, ids, recipient
    ]);

    let owner00 = "0x18181a21BB74A9De56d1Fbd408c4FeC175Ca0b16";

    const tx = {
      from: owner00,
      to: pairFactory.address,
      data: data
    };

    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);
    await impersonatedSigner.sendTransaction(tx);

    //let owner01 = await contract.ownerOf(tokenId);

    //expect(owner01).to.eq(bob.address);
  });
});