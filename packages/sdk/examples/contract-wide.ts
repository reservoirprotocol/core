import { CloudflareProvider } from "@ethersproject/providers";
import { parseEther } from "@ethersproject/units";
import { Wallet } from "@ethersproject/wallet";

import { Common, WyvernV2 } from "../src";

const main = async () => {
  const chainId = 1;
  const provider = new CloudflareProvider(chainId);

  const maker = Wallet.createRandom();
  const taker = Wallet.createRandom();

  const contract = "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";

  const builder = new WyvernV2.Builders.Erc721.ContractWide(chainId);

  // Build buy order
  // eg. buy any token within the specified contract
  let buyOrder = builder.build({
    maker: maker.address,
    contract,
    side: "buy",
    price: parseEther("10"),
    paymentToken: Common.Addresses.Weth[chainId],
    fee: 250,
    // Maker order fee recipient cannot be the zero address
    feeRecipient: "0x0000000000000000000000000000000000000fee",
    listingTime: Math.floor(Date.now() / 1000),
  });

  // Sign the buy order
  await buyOrder.sign(maker);

  // Optional: make sure the buy order is fillable
  // - check that the maker has enough balance
  // - check that the maker has set the proper approval
  await buyOrder.checkFillability(provider);

  const soldTokenId = 999;

  // Create matching sell order
  const sellOrder = buyOrder.buildMatching(taker.address, soldTokenId);

  // Optional: make sure the sell order is fillable
  // - check that the maker has enough balance
  // - check that the maker has set the proper approval
  await sellOrder.checkFillability(provider);

  const exchange = new WyvernV2.Exchange(chainId);

  // The taker should be the one matching the orders on-chain
  await exchange.match(taker, buyOrder, sellOrder);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
