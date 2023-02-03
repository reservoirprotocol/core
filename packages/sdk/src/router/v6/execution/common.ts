
import { ListingDetails, ListingFillDetails, FillOptions } from "../types"
import { TxData, bn, generateSourceBytes, uniqBy, MaxUint256 } from "../../../utils";
import { AddressZero } from "@ethersproject/constants";

export const getFees = (ownDetails: ListingFillDetails[], details: ListingDetails[], options?: FillOptions) => [
    // Global fees
    ...(options?.globalFees ?? [])
        .filter(
            ({ amount, recipient }) =>
                // Skip zero amounts and/or recipients
                bn(amount).gt(0) && recipient !== AddressZero
        )
        .map(({ recipient, amount }) => ({
            recipient,
            // The fees are averaged over the number of listings to fill
            // TODO: Also take into account the quantity filled for ERC1155
            amount: bn(amount).mul(ownDetails.length).div(details.length),
        })),
    // Local fees
    // TODO: Should not split the local fees among all executions
    ...ownDetails.flatMap(({ fees }) =>
        (fees ?? []).filter(
            ({ amount, recipient }) =>
                // Skip zero amounts and/or recipients
                bn(amount).gt(0) && recipient !== AddressZero
        )
    ),
];