import { ethers } from "hardhat";

const main = async () => {
  const [deployer] = await ethers.getSigners();

  const tokenRangeValidator = await ethers
    .getContractFactory("TokenRangeValidator", {
      signer: deployer,
    })
    .then((factory) => factory.deploy());
  console.log(
    `"TokenRangeValidator" was deployed at address ${tokenRangeValidator.address}`
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
