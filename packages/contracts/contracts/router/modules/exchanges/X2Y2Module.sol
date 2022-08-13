// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {IX2Y2} from "../../interfaces/IX2Y2.sol";

contract X2Y2Module is BaseExchangeModule {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public constant exchange =
        0x74312363e45DCaBA76c59ec49a7Aa8A65a67EeD3;

    // --- Constructor ---

    constructor(address owner) BaseModule(owner) {}

    // --- Single ETH listing ---

    function acceptETHListing(
        IX2Y2.RunInput calldata input,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        buy(input, params.fillTo, params.revertIfIncomplete, params.amount);
    }

    // --- Multiple ETH listings ---

    function acceptETHListings(
        IX2Y2.RunInput[] calldata inputs,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        uint256 length = inputs.length;
        for (uint256 i = 0; i < length; ) {
            buy(
                inputs[i],
                params.fillTo,
                params.revertIfIncomplete,
                inputs[i].details[0].price
            );

            unchecked {
                ++i;
            }
        }
    }

    // --- Internal ---

    function buy(
        IX2Y2.RunInput calldata input,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        if (input.details.length != 1) {
            revert WrongParams();
        }

        IX2Y2.SettleDetail calldata detail = input.details[0];
        IX2Y2.OrderItem calldata orderItem = input
            .orders[detail.orderIdx]
            .items[detail.itemIdx];
        IX2Y2.Pair[] memory pairs = abi.decode(orderItem.data, (IX2Y2.Pair[]));
        if (pairs.length != 1) {
            revert WrongParams();
        }

        bool success;
        try IX2Y2(exchange).run{value: value}(input) {
            IERC721(pairs[0].token).safeTransferFrom(
                address(this),
                receiver,
                pairs[0].tokenId
            );

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }
}
