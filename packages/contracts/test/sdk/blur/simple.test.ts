import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import * as Common from "@reservoir0x/sdk/src/common";
import * as Blur from "@reservoir0x/sdk/src/blur";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { getChainId, getCurrentTimestamp, reset, setupNFTs } from "../../utils";

describe("Blur - SingleToken Erc721", () => {
  const chainId = getChainId();

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let ted: SignerWithAddress;

  let erc721: Contract;

  beforeEach(async () => {
    [deployer, alice, bob, carol, ted] = await ethers.getSigners();
    ({ erc721 } = await setupNFTs(deployer));
  });

  afterEach(reset);

  it("Build and fill buy order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const boughtTokenId = 0;

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    const exchange = new Blur.Exchange(chainId);

    const builder = new Blur.Builders.SingleToken(chainId);

    // const inputData = exchange.contract.interface.decodeFunctionData("execute", `0x9a1fc3a70000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000001b602a8015af4f4f897adde7cc5ec0701f422789b4828ac0f1899ee245764c3884739c1b50aaddb4b4f2a1c602976997d99e9968f39dff0ec282eea5b753534a2c000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f23eb100000000000000000000000029e44b41e191531b07d6b5cb9e03c3bece1373aa000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000006411739da1c40b106f8511de5d1fac0000000000000000000000003fe1a4c1481c8351e91b64d5c398b159de07cbc50000000000000000000000000000000000000000000000000000000000000c820000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003311fc80a57000000000000000000000000000000000000000000000000000000000000635e83ff000000000000000000000000000000000000000000000000000000006367be7e00000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000002b909f741233a66b1750c4e867ae7675000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000064000000000000000000000000aae014af95d811ad7dbff60209e74551a338f64c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f23eb10000000000000000000000002128f6d85dfdd6cf1b92eebf38eab41716e5becd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006411739da1c40b106f8511de5d1fac0000000000000000000000003fe1a4c1481c8351e91b64d5c398b159de07cbc50000000000000000000000000000000000000000000000000000000000000c820000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003311fc80a5700000000000000000000000000000000000000000000000000000000000063611e6a0000000000000000000000000000000000000000000000000000000063613a8a00000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000009a0ed79db7e1083b50890a647607f64900000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`);
    // console.log('inputData.buy', inputData.buy)
    // console.log('inputData.sell', inputData.sell)

    // const sellOrder1 = inputData.sell[0]

    // const curTimestamp = (await getCurrentTimestamp(ethers.provider));
    // console.log("curTimestamp", curTimestamp)

    // function getOrder(sellOrder: any) {
    //   console.log('sellOrder', sellOrder)
    //   return {
    //     side: sellOrder.side === 1 ? "sell" : "buy",
    //     trader: sellOrder.trader,
    //     collection: sellOrder.collection,
    //     tokenId: sellOrder.tokenId.toString(),
    //     amount: sellOrder.amount.toString(),
    //     paymentToken: sellOrder.paymentToken,
    //     price: sellOrder.price.toString(),
    //     listingTime: sellOrder.listingTime.toString(),
    //     matchingPolicy: sellOrder.matchingPolicy,
    //     nonce: 0,
    //     expirationTime: sellOrder.expirationTime.toString(),
    //     fees: sellOrder.fees.map((_:any) => {
    //       return {
    //         rate: _.rate,
    //         recipient: _.recipient
    //       }
    //     }),
    //     salt: sellOrder.salt.toString(),
    //     extraParams: sellOrder.extraParams
    //   }
    // }

    // console.log('sellOrder', getOrder(sellOrder1))
    // console.log('buyOrder', getOrder(inputData.buy[0]))

    // const buyOrder = builder.build({
    //   side: "buy",
    //   trader: sellOrder1.trader,
    //   collection: sellOrder1.collection,
    //   tokenId: sellOrder1.tokenId.toString(),
    //   amount: sellOrder1.amount.toString(),
    //   paymentToken: sellOrder1.paymentToken,
    //   price: sellOrder1.price.toString(),
    //   listingTime: sellOrder1.listingTime.toString(),
    //   matchingPolicy: sellOrder1.matchingPolicy,
    //   nonce: 0,
    //   expirationTime: sellOrder1.expirationTime.toString(),
    //   fees: sellOrder1.fees.map((_:any) => {
    //     return {
    //       rate: _.rate,
    //       recipient: _.recipient
    //     }
    //   }),
    //   salt: sellOrder1.salt.toString(),
    //   extraParams: sellOrder1.extraParams
    // });

    // const tx = await ethers.provider.getTransactionReceipt('0xc02aa94cd1b594d93afd2e5ea7890402f3b38329abdb5f188bf449ebb4dbd12a');

    // console.log(buyOrder.hash())

    // const eventData = exchange.contract.interface.decodeEventLog('OrdersMatched', tx.logs[3].data);
    // console.log("OrdersMatched",eventData.sellHash)

  });
});
