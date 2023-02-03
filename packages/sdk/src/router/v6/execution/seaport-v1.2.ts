import { ListingDetailsExtracted, ListingDetails, FillOptions } from "../types"
import { Contract } from "@ethersproject/contracts";
import * as Sdk from "../../../index";
import { isETH } from "../utils";

import { bn } from "../../../utils";
import { getFees } from "./common";
import { formatEther } from "ethers/lib/utils";

export function getSeaportV12ListingsPayment(currencyDetails: ListingDetailsExtracted[], details: ListingDetails[], options?: FillOptions) {
    const orders = currencyDetails.map((d) => d.order as Sdk.SeaportV12.Order);
    const fees = getFees(currencyDetails, details, options);

    const totalPrice = orders
        .map((order, i) =>
            // Seaport orders can be partially-fillable
            bn(order.getMatchingPrice())
                .mul(currencyDetails[i].amount ?? 1)
                .div(order.getInfo()!.amount)
        )
        .reduce((a, b) => a.add(b), bn(0));
    const totalFees = fees
        .map(({ amount }) => bn(amount))
        .reduce((a, b) => a.add(b), bn(0));

    const totalPayment = totalPrice.add(totalFees);
    return {
        orders,
        totalPrice,
        fees,
        totalPayment,
        totalFees
    }
}

export async function createSeaportV12Execution(
    chainId: number,
    seaportModule: Contract,
    currencyDetails: ListingDetailsExtracted[],
    exchange: Sdk.SeaportV12.Exchange,
    details: ListingDetails[],
    taker: string,
    options?: FillOptions,
) {

    const currency = currencyDetails[0].currency;
    const currencyIsETH = isETH(chainId, currency);
    const { totalPayment, orders, totalPrice, fees } = getSeaportV12ListingsPayment(currencyDetails, details, options);

    return {
        module: seaportModule.address,
        data:
            orders.length === 1
                ? seaportModule.interface.encodeFunctionData(
                    `accept${currencyIsETH ? "ETH" : "ERC20"}Listing`,
                    [
                        {
                            parameters: {
                                ...orders[0].params,
                                totalOriginalConsiderationItems:
                                    orders[0].params.consideration.length,
                            },
                            numerator: currencyDetails[0].amount ?? 1,
                            denominator: orders[0].getInfo()!.amount,
                            signature: orders[0].params.signature,
                            extraData: await exchange.getExtraData(orders[0]),
                        },
                        {
                            fillTo: taker,
                            refundTo: taker,
                            revertIfIncomplete: Boolean(!options?.partial),
                            // Only needed for ERC20 listings
                            token: currency,
                            amount: totalPrice,
                        },
                        fees,
                    ]
                )
                : seaportModule.interface.encodeFunctionData(
                    `accept${currencyIsETH ? "ETH" : "ERC20"}Listings`,
                    [
                        await Promise.all(
                            orders.map(async (order, i) => {
                                const orderData = {
                                    parameters: {
                                        ...order.params,
                                        totalOriginalConsiderationItems:
                                            order.params.consideration.length,
                                    },
                                    numerator: currencyDetails[i].amount ?? 1,
                                    denominator: order.getInfo()!.amount,
                                    signature: order.params.signature,
                                    extraData: await exchange.getExtraData(order),
                                };

                                if (currencyIsETH) {
                                    return {
                                        order: orderData,
                                        price: orders[i].getMatchingPrice(),
                                    };
                                } else {
                                    return orderData;
                                }
                            })
                        ),
                        {
                            fillTo: taker,
                            refundTo: taker,
                            revertIfIncomplete: Boolean(!options?.partial),
                            // Only needed for ERC20 listings
                            token: currency,
                            amount: totalPrice,
                        },
                        fees,
                    ]
                ),
        value: currencyIsETH ? totalPayment : 0,
    }
}
