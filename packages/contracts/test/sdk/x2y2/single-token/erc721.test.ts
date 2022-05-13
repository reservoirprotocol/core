import { arrayify } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { Wallet } from "@ethersproject/wallet";
import * as Common from "@reservoir0x/sdk/src/common";
import * as X2Y2 from "@reservoir0x/sdk/src/x2y2";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("X2Y2 - SingleToken Erc721", () => {
  let chainId: number;

  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let x2y2Signer: Wallet;

  let erc721: Contract;

  beforeEach(async () => {
    chainId = (network.config as any).forking?.url.includes("rinkeby") ? 4 : 1;
    [deployer, alice, bob] = await ethers.getSigners();

    x2y2Signer = new Wallet("0x01");

    // Impersonate the X2Y2 admin.
    const x2y2AdminAddress = "0x5d7cca9fb832bbd99c8bd720ebda39b028648301";
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [x2y2AdminAddress],
    });
    const x2y2Admin = await ethers.getSigner(x2y2AdminAddress);

    // Add a new signer to the exchange.
    const exchange = new X2Y2.Exchange(chainId);
    await deployer.sendTransaction({
      to: x2y2AdminAddress,
      value: parseEther("0.1"),
    });
    await exchange.contract
      .connect(x2y2Admin)
      .updateSigners([x2y2Signer.address], []);

    erc721 = await ethers
      .getContractFactory("MockERC721", deployer)
      .then((factory) => factory.deploy());
  });

  afterEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: (network.config as any).forking.url,
            blockNumber: (network.config as any).forking.blockNumber,
          },
        },
      ],
    });
  });

  it("build and match sell order", async () => {
    const buyer = alice;
    const seller = bob;
    const price = parseEther("1");
    const tokenId = 0;

    // Mint ERC721 to the seller.
    await erc721.connect(seller).mint(tokenId);

    const nft = new Common.Helpers.Erc721(ethers.provider, erc721.address);

    // Approve the X2Y2 ERC721 delegate.
    await nft.approve(seller, X2Y2.Addresses.Erc721Delegate[chainId]);

    const exchange = new X2Y2.Exchange(chainId);
    const builder = new X2Y2.Builders.SingleToken(chainId);

    // Build sell order.
    const sellOrder = builder.build({
      side: "sell",
      tokenKind: "erc721",
      maker: seller.address,
      price,
      contract: nft.contract.address,
      tokenId,
    });

    // Sign the order.
    await sellOrder.sign(seller);

    // Create matching buy params.
    const buyOrder = sellOrder.buildMatching(buyer.address);

    // Generate input hash and have the signer sign it.
    const runInputHash = exchange.getRunInputHash(
      buyOrder.detail,
      buyOrder.shared
    );
    const runInputSignature = x2y2Signer
      ._signingKey()
      .signDigest(arrayify(runInputHash));

    await sellOrder.checkFillability(ethers.provider);

    const buyerEthBalanceBefore = await buyer.getBalance();
    const sellerEthBalanceBefore = await seller.getBalance();
    const ownerBefore = await nft.getOwner(tokenId);

    expect(ownerBefore).to.eq(seller.address);

    // Fill the sell order.
    await exchange.fillOrder(
      buyer,
      sellOrder,
      buyOrder.detail,
      buyOrder.shared,
      runInputSignature
    );

    const buyerEthBalanceAfter = await buyer.getBalance();
    const sellerEthBalanceAfter = await seller.getBalance();
    const ownerAfter = await nft.getOwner(tokenId);

    expect(buyerEthBalanceAfter).to.be.lt(buyerEthBalanceBefore.sub(price));
    expect(sellerEthBalanceAfter.sub(sellerEthBalanceBefore)).to.eq(
      price.sub(price.mul(500).div(1000000))
    );
    expect(ownerAfter).to.eq(buyer.address);
  });
});
