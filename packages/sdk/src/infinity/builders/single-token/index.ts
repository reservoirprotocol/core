import { constants } from "ethers";
import { Addresses, Order, Types } from "../..";
import { BaseBuilder } from "../base";

export type SingleTokenOrderParams = Omit<Types.OrderInput, 'complication' | 'numItems' | "nfts" | "extraParams"> & { collection: string, tokenId: string, numTokens: number };

export class SingleTokenBuilder extends BaseBuilder<SingleTokenOrderParams> {
    public isValid(order: Order): boolean {
        const numItemsValid = order.numItems === 1 && order.nfts.length === 1 && order.nfts[0]?.tokens?.length === 1;
        return numItemsValid;
    }

    public build(params: SingleTokenOrderParams): Order {
        const order = new Order(this.chainId, {
            ...params,
            extraParams: constants.AddressZero,
            numItems: 1,
            nfts: [
                {
                    collection: params.collection,
                    tokens: [{ tokenId: params.tokenId, numTokens: params.numTokens }]
                }
            ],
            complication: Addresses.Complication[this.chainId]
        });

        return order;
    }
}