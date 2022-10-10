import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@tenderly/hardhat-tenderly";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    // Development
    hardhat: {
      //chainId: process.env.GOERLI ? 5 : 1,
      //forking: {
        //url: `https://eth-${
          //process.env.GOERLI ? "goerli" : "mainnet"
        //}.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        //blockNumber: Number(process.env.BLOCK_NUMBER),
      //},
      accounts: {
        mnemonic:
          "void forward involve old phone resource sentence fall friend wait strike copper urge reduce chapter",
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Testnets
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : undefined,
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : undefined,
    },
    // Mainnets
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : undefined,
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : undefined,
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : undefined,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: Boolean(Number(process.env.REPORT_GAS)),
  },
  tenderly: {
    username: String(process.env.TENDERLY_USERNAME),
    project: String(process.env.TENDERLY_PROJECT),
  },
  mocha: {
    timeout: 60000 * 10,
  },
};

export default config;
