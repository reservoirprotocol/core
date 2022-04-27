import { ethers } from "hardhat";

const main = async () => {
  const [deployer] = await ethers.getSigners();

  const erc721 = await ethers
    .getContractFactory("ReservoirErc721", {
      signer: deployer,
    })
    .then((factory) =>
      factory.deploy(
        "https://metadata-production.up.railway.app/api/test/erc721/"
      )
    );
  console.log(`"ReservoirErc721" was deployed at address ${erc721.address}`);

  const erc1155 = await ethers
    .getContractFactory("ReservoirErc1155", {
      signer: deployer,
    })
    .then((factory) =>
      factory.deploy(
        "https://metadata-production.up.railway.app/api/test/erc1155/"
      )
    );
  console.log(`"ReservoirErc1155" was deployed at address ${erc1155.address}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
