import { ethers } from "hardhat";

const main = async () => {
  const [deployer] = await ethers.getSigners();

  const bitVectorValidator = await ethers
    .getContractFactory("BitVectorValidator", {
      signer: deployer,
    })
    .then((factory) => factory.deploy());
  console.log(
    `"BitVectorValidator" was deployed at address ${bitVectorValidator.address}`
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
