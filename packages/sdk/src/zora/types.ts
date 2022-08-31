import { BaseBuildParams } from "./builders/base";

export type MakerOrderParams = BaseBuildParams;

export type TakerOrderParams = {
  // https://github.com/ourzora/v3/blob/main/contracts/modules/Asks/V1.1/AsksV1_1.sol#L296-L308
  _tokenContract: string; // address
  _tokenId: number; // uint256
  _fillCurrency: string; // address
  _fillAmount: string; // uint256
  _finder: string; // address
};
