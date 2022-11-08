import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Sdk from "../../../../../sdk/src";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { setupSudoswapTestContract, addresTokenPDB, addresPoolPDB } from "../helpers/sudoswap";

import SudoswapModuleAbi from "../../../../../sdk/src/router/v6/abis/SudoswapModule.json";

import {
  getChainId,
  reset,
} from "../../../utils";
import { ListingDetails } from "@reservoir0x/sdk/src/router/v6/types";

describe("[ReservoirV6_0_0] - filling sudoswap listings via the SDK", () => {
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

    const buyer = alice;

    const contractPDB = await setupSudoswapTestContract();

    const tokenId: number = 6113; //example token

    const seller = await contractPDB.ownerOf(tokenId);
    
    const pairFactory = new Sdk.Sudoswap.Exchange(chainId); //selling/deposit 
    
    const impersonatedSigner = await ethers.getImpersonatedSigner(seller);
    
    // List nft
    
    await pairFactory.depositNFTs(impersonatedSigner, addresTokenPDB, [tokenId], addresPoolPDB);

    let value = parseEther("1.0").toString();

    let orderParams: Sdk.Sudoswap.OrderParams = { 
      pair: addresPoolPDB,
      price: value
    };

    let sellOrder: Sdk.Sudoswap.Order = {
        chainId: chainId,
        params: orderParams
    };

    let feeRecipient = emilio;
    const feesOnTop = [
      {
        recipient: feeRecipient.address,
        amount: parseEther("0.03"),
      }
    ];

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
    //TODO: ^remove once mainnet deployed

    const tokenOwnerBefore = await contractPDB.ownerOf(tokenId);
    expect(tokenOwnerBefore).to.eq(addresPoolPDB);
    
    const feeRecipientEthBalanceBefore = await feeRecipient.getBalance();
    const sellerEthBalanceBefore = await ethers.provider.getBalance(seller);
    const tokenBuyerBalanceBefore = await buyer.getBalance();
    
    const { txData } = await router.fillListingsTx(
      sellOrders,
      buyer.address,
      Sdk.Common.Addresses.Eth[chainId],
      {
        source: "reservoir.market",
        globalFees: feesOnTop,
      }
    );
    await buyer.sendTransaction(txData);

    const tokenOwnerAfter = await contractPDB.ownerOf(tokenId);
    expect(tokenOwnerAfter).to.eq(buyer.address);

    const sellerEthBalanceAfter = await ethers.provider.getBalance(seller);
    expect(sellerEthBalanceAfter).to.be.gt(sellerEthBalanceBefore);

    const feeRecipientEthBalanceAfter = await feeRecipient.getBalance();
    expect(feeRecipientEthBalanceAfter).to.be.gt(feeRecipientEthBalanceBefore);

    const tokenBuyerBalanceAfter = await buyer.getBalance();
    expect(tokenBuyerBalanceAfter).to.be.lt(tokenBuyerBalanceBefore);

    // Router is stateless (it shouldn't keep any funds)
    expect(
      await ethers.provider.getBalance(router.contracts.router.address)
    ).to.eq(0);
    expect(
      await ethers.provider.getBalance(router.contracts.sudoswapModule.address)
    ).to.eq(0);
  });

});
