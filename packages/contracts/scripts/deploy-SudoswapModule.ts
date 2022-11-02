
const hre = require("hardhat");

async function main() {

  let owner = "0x0000000000000000000000000000000000000000";

  let SudoswapModule = await hre.ethers.getContractFactory("SudoswapModule");
  let sudoswapModule = await SudoswapModule.deploy(owner) as any;
  await sudoswapModule.deployed();

  console.log("SudoswapModule:", sudoswapModule.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });