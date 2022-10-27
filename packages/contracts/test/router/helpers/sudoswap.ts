import { ethers } from "hardhat";

// --- Listings ---

const addresPDB: string = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //example project
const abiOwnerOf: string = 
    '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
    
export const setupSudoswapPoolListing = async () => {

  const contractPDB = new ethers.Contract(addresPDB, abiOwnerOf, ethers.provider);

  return contractPDB;
};