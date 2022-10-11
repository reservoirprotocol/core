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
      await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

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

  const router = await deploymentHelper.deploy("ReservoirV6_0_0", [], {
    verifyOnEtherscan: true,
  });
  await deploymentHelper.deploy(
    "SeaportModule",
    [deploymentHelper.deployer.address, router.address],
    { verifyOnEtherscan: true }
  );
  await deploymentHelper.deploy(
    "ZeroExV4Module",
    [deploymentHelper.deployer.address, router.address],
    { verifyOnEtherscan: true }
  );
  await deploymentHelper.deploy(
    "LooksRareModule",
    [deploymentHelper.deployer.address, router.address],
    { verifyOnEtherscan: true }
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
