import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as ZeroexV4 from "@reservoir0x/sdk/src/zeroex-v4";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("Test nfts", () => {
  let deployer: SignerWithAddress;

  let erc721: Contract;
  let erc1155: Contract;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();

    erc721 = await ethers
      .getContractFactory("ReservoirErc721", deployer)
      .then((factory) =>
        factory.deploy(
          "https://metadata-production.up.railway.app/api/test/erc721/"
        )
      );

    erc1155 = await ethers
      .getContractFactory("ReservoirErc1155", deployer)
      .then((factory) =>
        factory.deploy(
          "https://metadata-production.up.railway.app/api/test/erc1155/"
        )
      );
  });

  it("testing", async () => {
    await erc721.connect(deployer).mint(0);
    await erc1155.connect(deployer).mint(0, 10);

    const result = await erc721.tokenURI(0);
    const result2 = await erc1155.uri(0);
  });
});
