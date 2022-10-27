import { ethers } from "hardhat";
import * as Sdk from "../../../../sdk/src";

import { getChainId } from "../../utils";

// --- Listings ---

const addresPDB: string = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //example project
const abiOwnerOf: string = 
    '[{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
    
export const setupSudoswapPoolListing = async (tokenId: number, pool: string) => {
  const chainId: number = getChainId();

  const contractPDB = new ethers.Contract(addresPDB, abiOwnerOf, ethers.provider);

  const owner00 = await contractPDB.ownerOf(tokenId);

  const pairFactory = new Sdk.Sudoswap.Exchange(chainId); //selling/deposit 

  const nft: string = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F"; //PudgyDickbutts
  

  const impersonatedSigner = await ethers.getImpersonatedSigner(owner00);

  // List nft

  await pairFactory.depositNFTs(impersonatedSigner, nft, [tokenId], pool);

  return contractPDB;
};