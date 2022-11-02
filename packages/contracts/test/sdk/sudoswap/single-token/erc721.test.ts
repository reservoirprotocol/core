import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { setupSudoswapTestContract, addresTokenPDB, addresPoolPDB  } from "../../../../../contracts/test/router/helpers/sudoswap";
import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "@ethersproject/units";

import * as Sudoswap from "../../../../../sdk/src/sudoswap";

import "@nomiclabs/hardhat-ethers";

import { getChainId } from "../../../utils";

describe("Sudoswap - SingleToken Erc721", () => {
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
  it("Sudoswap sdk test", async () => {

    const contractPDB = await setupSudoswapTestContract();

    const tokenId: number = 6113; //example token

    const owner00 = await contractPDB.ownerOf(tokenId);

    const pairFactory = new Sudoswap.Exchange(chainId); //selling/deposit 

    let ids = [tokenId];

    const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);

    // list nft...

    await pairFactory.depositNFTs(impersonatedSigner, addresTokenPDB, ids, addresPoolPDB);

    let owner0x = await contractPDB.ownerOf(tokenId);
    expect(owner0x).to.eq(addresPoolPDB);

    // buy nft...

    const pairRouter = new Sudoswap.Router(chainId); //purchasing 

    let swapListNftIds = ids;
    let ethRecipient =	bob.address;
    let nftRecipient =	alice.address;

    let swapList: Sudoswap.SwapList = {pair: addresPoolPDB, nftIds: swapListNftIds};

    await pairRouter.swapETHForSpecificNFTs(
      alice, [swapList], ethRecipient, nftRecipient, parseEther("0.2").toString()
    );

    let owner0y = await contractPDB.ownerOf(tokenId);
    expect(owner0y).to.eq(alice.address);
  });
});