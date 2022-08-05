// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {BaseMarket} from "../BaseMarket.sol";
import {ISeaport} from "../interfaces/ISeaport.sol";

contract SeaportMarket is BaseMarket {
    // --- Fields ---

    address public immutable exchange =
        0x00000000006c3852cbEf3e08E8dF289169EdE581;

    address public immutable override erc721Operator =
        0x00000000006c3852cbEf3e08E8dF289169EdE581;

    address public immutable override erc1155Operator =
        0x00000000006c3852cbEf3e08E8dF289169EdE581;

    // --- Constructor ---

    constructor(address router) BaseMarket(router) {
        // Only WETH bids are supported for now
        IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).approve(
            exchange,
            type(uint256).max
        );
    }

    // --- Fill listings ---

    function buySingle(
        ISeaport.AdvancedOrder calldata order,
        address receiver,
        bool revertIfIncomplete
    ) external payable nonReentrant refund {
        bool success;
        try
            ISeaport(exchange).fulfillAdvancedOrder{value: msg.value}(
                order,
                new ISeaport.CriteriaResolver[](0),
                bytes32(0),
                receiver
            )
        returns (bool fulfilled) {
            success = fulfilled;
        } catch {
            success = false;
        }

        if (!success && revertIfIncomplete) {
            revert UnsuccessfulFill();
        }
    }

    function buyMultiple(
        ISeaport.AdvancedOrder[] calldata orders,
        // Use `memory` instead of `calldata` to avoid `Stack too deep` errors
        ISeaport.FulfillmentComponent[][] memory offerFulfillments,
        ISeaport.FulfillmentComponent[][] memory considerationFulfillments,
        address receiver,
        bool revertIfIncomplete
    ) external payable nonReentrant refund {
        (bool[] memory fulfilled, ) = ISeaport(exchange)
            .fulfillAvailableAdvancedOrders{value: msg.value}(
            orders,
            new ISeaport.CriteriaResolver[](0),
            offerFulfillments,
            considerationFulfillments,
            bytes32(0),
            receiver,
            // Assume at most 255 orders can be filled at once
            0xff
        );

        if (revertIfIncomplete) {
            uint256 length = fulfilled.length;
            for (uint256 i = 0; i < length; ) {
                if (!fulfilled[i]) {
                    revert UnsuccessfulFill();
                }
                unchecked {
                    ++i;
                }
            }
        }
    }

    // --- Fill bids ---

    function sellSingle(ISeaport.AdvancedOrder calldata order, address receiver)
        external
        nonReentrant
    {
        bool fulfilled = ISeaport(exchange).fulfillAdvancedOrder(
            order,
            new ISeaport.CriteriaResolver[](0),
            bytes32(0),
            receiver
        );
        if (!fulfilled) {
            revert UnsuccessfulFill();
        }
    }

    // --- ERC721 / ERC1155 hooks ---

    // Not needed since Seaport will send any NFTs directly to the receiver
}
