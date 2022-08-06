// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BaseMarket} from "../BaseMarket.sol";
import {ISeaport} from "../../interfaces/ISeaport.sol";

contract SeaportMarket is BaseMarket {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public immutable exchange =
        0x00000000006c3852cbEf3e08E8dF289169EdE581;

    // --- Constructor ---

    constructor(address router) BaseMarket(router) {}

    // --- Fill listings ---

    // TODO: Add support for fees on top
    struct ListingParams {
        address receiver;
        address refundTo;
        bool revertIfIncomplete;
    }

    function acceptETHListing(
        ISeaport.AdvancedOrder calldata order,
        ListingParams calldata params
    ) external payable nonReentrant {
        bool success;
        try
            ISeaport(exchange).fulfillAdvancedOrder{value: msg.value}(
                order,
                new ISeaport.CriteriaResolver[](0),
                bytes32(0),
                params.receiver
            )
        returns (bool fulfilled) {
            success = fulfilled;
        } catch {}

        if (params.revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }

        // Refund any leftover
        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (success, ) = payable(params.refundTo).call{value: leftover}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function acceptERC20Listing(
        ISeaport.AdvancedOrder calldata order,
        ListingParams calldata params,
        address erc20Token
    ) external nonReentrant {
        IERC20(erc20Token).safeApprove(exchange, type(uint256).max);

        bool success;
        try
            ISeaport(exchange).fulfillAdvancedOrder(
                order,
                new ISeaport.CriteriaResolver[](0),
                bytes32(0),
                params.receiver
            )
        returns (bool fulfilled) {
            success = fulfilled;
        } catch {}

        if (params.revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }

        // Refund any leftover
        uint256 leftover = IERC20(erc20Token).balanceOf(address(this));
        if (leftover > 0) {
            IERC20(erc20Token).safeTransfer(params.refundTo, leftover);
        }
    }

    // --- Generic handler (used for Seaport-based approvals) ---

    function matchOrders(
        ISeaport.Order[] calldata orders,
        ISeaport.Fulfillment[] calldata fulfillments
    ) external {
        ISeaport(exchange).matchOrders(orders, fulfillments);
    }

    // function buySingle(
    //     ISeaport.AdvancedOrder calldata order,
    //     address receiver,
    //     bool revertIfIncomplete
    // ) external payable nonReentrant refund {
    //     bool success;
    //     try
    //         ISeaport(exchange).fulfillAdvancedOrder{value: msg.value}(
    //             order,
    //             new ISeaport.CriteriaResolver[](0),
    //             bytes32(0),
    //             receiver
    //         )
    //     returns (bool fulfilled) {
    //         success = fulfilled;
    //     } catch {
    //         success = false;
    //     }

    //     if (!success && revertIfIncomplete) {
    //         revert UnsuccessfulFill();
    //     }
    // }

    // function buyMultiple(
    //     ISeaport.AdvancedOrder[] calldata orders,
    //     // Use `memory` instead of `calldata` to avoid `Stack too deep` errors
    //     ISeaport.FulfillmentComponent[][] memory offerFulfillments,
    //     ISeaport.FulfillmentComponent[][] memory considerationFulfillments,
    //     address receiver,
    //     bool revertIfIncomplete
    // ) external payable nonReentrant refund {
    //     (bool[] memory fulfilled, ) = ISeaport(exchange)
    //         .fulfillAvailableAdvancedOrders{value: msg.value}(
    //         orders,
    //         new ISeaport.CriteriaResolver[](0),
    //         offerFulfillments,
    //         considerationFulfillments,
    //         bytes32(0),
    //         receiver,
    //         // Assume at most 255 orders can be filled at once
    //         0xff
    //     );

    //     if (revertIfIncomplete) {
    //         uint256 length = fulfilled.length;
    //         for (uint256 i = 0; i < length; ) {
    //             if (!fulfilled[i]) {
    //                 revert UnsuccessfulFill();
    //             }
    //             unchecked {
    //                 ++i;
    //             }
    //         }
    //     }
    // }

    // // --- Fill bids ---

    // function sellSingle(ISeaport.AdvancedOrder calldata order, address receiver)
    //     external
    //     nonReentrant
    // {
    //     bool fulfilled = ISeaport(exchange).fulfillAdvancedOrder(
    //         order,
    //         new ISeaport.CriteriaResolver[](0),
    //         bytes32(0),
    //         receiver
    //     );
    //     if (!fulfilled) {
    //         revert UnsuccessfulFill();
    //     }
    // }

    // --- ERC721 / ERC1155 hooks ---

    // Not needed since Seaport will send any NFTs directly to the receiver
}
