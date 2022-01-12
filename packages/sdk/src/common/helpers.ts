import {
  Provider,
  TransactionResponse,
} from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";

import * as Addresses from "./addresses";
import { MaxUint256 } from "../utils";

import Erc20Abi from "./abis/Erc20.json";
import Erc721Abi from "./abis/Erc721.json";
import Erc1155Abi from "./abis/Erc1155.json";

/**
 * The Erc20 interface provides partial functionality to interact with an ERC20 Ethereum smart contract.
 */
export class Erc20 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, Erc20Abi as any, provider);
  }

  /**
   * Sets amount as the allowance of spender over the caller’s tokens.
   * @param approver Abstracted Ethereum Account, usually as a JsonRpcSigner
   * @param spender Ethereum address of a contract allowed to spend the approver's tokens
   * @param amount Token amount to be allowed to spend
   * @returns The contract transaction
   */
  public async approve(
    approver: Signer,
    spender: string,
    amount: BigNumberish = MaxUint256
  ): Promise<TransactionResponse> {
    return this.contract.connect(approver).approve(spender, amount);
  }

  /**
   * 
   * @param owner The owner's Ethereum address
   * @returns The owner's token balance
   */
  public async getBalance(owner: string): Promise<BigNumberish> {
    return this.contract.balanceOf(owner);
  }

  /**
   * 
   * @param owner Ethereum address to be queried
   * @param spender Ethereum contract 
   * @returns The remaining number of tokens that spender will be allowed to spend on behalf of owner through transferFrom.
   */
  public async getAllowance(
    owner: string,
    spender: string
  ): Promise<BigNumberish> {
    return this.contract.allowance(owner, spender);
  }
}

/**
 * The Erc721 interface provides partial functionality to interact with an ERC721 Ethereum smart contract.
 */
export class Erc721 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, Erc721Abi as any, provider);
  }

  /**
   * Approve or remove operator as an operator for the caller. Operators can call transferFrom or safeTransferFrom for any token owned by the caller.
   * @param approver Abstracted Ethereum Account as a JavaScript object, usually a JsonRpcSigner
   * @param operator The operator's Ethereum address
   * @returns The contract transaction
   */
  public async approve(
    approver: Signer,
    operator: string
  ): Promise<TransactionResponse> {
    return this.contract.connect(approver).setApprovalForAll(operator, true);
  }

  /**
   * Returns the owner of a token 
   * @param tokenId The token ID number
   * @returns The token owner's Ethereum address
   */
  public async getOwner(tokenId: BigNumberish): Promise<string> {
    return this.contract.ownerOf(tokenId);
  }

  /**
   * Determine if the operator is allowed to manage all of the assets of owner or not
   * @param owner The owner's Ethereum address
   * @param operator The operator's Ethereum address
   * @returns Wether the operator is allowed to manage all of the assets of owner or not
   */
  public async isApproved(owner: string, operator: string): Promise<boolean> {
    return this.contract.isApprovedForAll(owner, operator);
  }
}

/**
 * The Erc1155 interface provides partial functionality to interact with an Erc1155 Ethereum smart contract.
 */
export class Erc1155 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, Erc1155Abi as any, provider);
  }

  /**
   * Approve or remove operator as an operator for the caller. Operators can call transferFrom or safeTransferFrom for any token owned by the caller.
   * @param approver Abstracted Ethereum Account, usually as a JsonRpcSigner
   * @param operator The operator's Ethereum address
   * @returns The contract transaction
   */
  public async approve(
    approver: Signer,
    operator: string
  ): Promise<TransactionResponse> {
    return this.contract.connect(approver).setApprovalForAll(operator, true);
  }

  /**
   * 
   * @param owner The owner's Ethereum address
   * @param tokenId The token ID number
   * @returns The owner's token balance
   */
  public async getBalance(
    owner: string,
    tokenId: BigNumberish
  ): Promise<BigNumberish> {
    return this.contract.balanceOf(owner, tokenId);
  }

  /**
   * Determine if the operator is allowed to manage all of the assets of owner or not
   * @param owner The owner's Ethereum address
   * @param operator The operator's Ethereum address
   * @returns Wether the operator is allowed to manage all of the assets of owner or not
   */
  public async isApproved(owner: string, operator: string): Promise<boolean> {
    return this.contract.isApprovedForAll(owner, operator);
  }
}


/**
 * The Weth interface provides partial functionality to interact with the Wrapped ETH (WETH) Ethereum smart contract.
 */
export class Weth extends Erc20 {
  constructor(provider: Provider, chainId: number) {
    super(provider, Addresses.Weth[chainId]);
  }

  /**
   * Deposit ETH in the WETH smart contract to get the equivalent amount of WETH
   * @param depositor Abstracted Ethereum account, usually as a JsonRpcSigner 
   * @param amount ETH amount to be deposited in the WETH smart contract
   * @returns The contract transaction
   */
  public async deposit(
    depositor: Signer,
    amount: BigNumberish
  ): Promise<TransactionResponse> {
    return this.contract.connect(depositor).deposit({ value: amount });
  }
}
