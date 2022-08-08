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
      chainId: 1,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: Number(process.env.BLOCK_NUMBER),
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
