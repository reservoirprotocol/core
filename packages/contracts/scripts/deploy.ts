import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";

export class DeploymentHelper {
  public deployer: SignerWithAddress;

  private constructor(deployer: SignerWithAddress) {
    this.deployer = deployer;
  }

  public static async getInstance(): Promise<DeploymentHelper> {
    const [deployer] = await ethers.getSigners();
    return new DeploymentHelper(deployer);
  }

  public async deploy(
    contractName: string,
    args: any[] = [],
    options?: {
      verifyOnEtherscan: boolean;
    }
  ) {
    const contract = await ethers
      .getContractFactory(contractName, this.deployer)
      .then((factory) => factory.deploy(...args));
    console.log(
      `"${contractName}" was deployed at address ${contract.address}`
    );

    if (options?.verifyOnEtherscan) {
      // Wait for the deployment tx to get propagated
      await new Promise((resolve) => setTimeout(resolve, 90 * 1000));

      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: args,
      });
      console.log(`"${contractName}" successfully verified on Etherscan`);
    }

    return contract;
  }
}

const main = async () => {
  const deploymentHelper = await DeploymentHelper.getInstance();

  await deploymentHelper.deploy(
    "SeaportV12Module",
    [
      deploymentHelper.deployer.address,
      "0xb35d22a4553ab9d2b85e2a606cbae55f844df50c",
    ],
    { verifyOnEtherscan: true }
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
