import { ethers } from "hardhat";

const main = async () => {
  const [deployer] = await ethers.getSigners();

  const packedListValidator = await ethers
    .getContractFactory("PackedListValidator", {
      signer: deployer,
    })
    .then((factory) => factory.deploy());
  console.log(
    `"PackedListValidator" was deployed at address ${packedListValidator.address}`
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
