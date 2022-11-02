import { ethers } from "hardhat";

// --- Listings ---

export const addresPoolPDB: string = "0x7794C476806731b74ba2049ccd413218248135DA"; //Mainnet PDB pool

export const addresTokenPDB: string = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //example project

const abiOwnerOf: string = 
    '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
    
export const setupSudoswapTestContract = async () => {

  const contractPDB = new ethers.Contract(addresTokenPDB, abiOwnerOf, ethers.provider);

  return contractPDB;
};