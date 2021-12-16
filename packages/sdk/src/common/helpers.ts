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

export class Erc20 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, Erc20Abi as any, provider);
  }

  public async approve(
    approver: Signer,
    spender: string,
    amount: BigNumberish = MaxUint256
  ): Promise<TransactionResponse> {
    return this.contract.connect(approver).approve(spender, amount);
  }

  public async getBalance(owner: string): Promise<BigNumberish> {
    return this.contract.balanceOf(owner);
  }

  public async getAllowance(
    owner: string,
    spender: string
  ): Promise<BigNumberish> {
    return this.contract.allowance(owner, spender);
  }
}

export class Erc721 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, Erc721Abi as any, provider);
  }

  public async approve(
    approver: Signer,
    operator: string
  ): Promise<TransactionResponse> {
    return this.contract.connect(approver).setApprovalForAll(operator, true);
  }

  public async getOwner(tokenId: BigNumberish): Promise<string> {
    return this.contract.ownerOf(tokenId);
  }

  public async isApproved(owner: string, operator: string): Promise<boolean> {
    return this.contract.isApprovedForAll(owner, operator);
  }
}

export class Erc1155 {
  public contract: Contract;

  constructor(provider: Provider, address: string) {
    this.contract = new Contract(address, Erc1155Abi as any, provider);
  }

  public async approve(
    approver: Signer,
    operator: string
  ): Promise<TransactionResponse> {
    return this.contract.connect(approver).setApprovalForAll(operator, true);
  }

  public async getBalance(
    owner: string,
    tokenId: BigNumberish
  ): Promise<BigNumberish> {
    return this.contract.balanceOf(owner, tokenId);
  }

  public async isApproved(owner: string, operator: string): Promise<boolean> {
    return this.contract.isApprovedForAll(owner, operator);
  }
}

export class Weth extends Erc20 {
  constructor(provider: Provider, chainId: number) {
    super(provider, Addresses.Weth[chainId]);
  }

  public async deposit(
    depositor: Signer,
    amount: BigNumberish
  ): Promise<TransactionResponse> {
    return this.contract.connect(depositor).deposit({ value: amount });
  }
}
