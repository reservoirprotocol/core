import * as Types from "./types";

export class Order {
  public chainId: number;
  public params: Types.Listing;

  constructor(
    chainId: number,
    params: Types.Listing
  ) {
    this.chainId = chainId;
    this.params = params;
  }
}
