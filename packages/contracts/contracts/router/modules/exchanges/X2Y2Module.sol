// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {IX2Y2} from "../../../interfaces/IX2Y2.sol";

// Notes on the X2Y2 module:
// - supports filling listings (only ERC721 and ETH-denominated)

contract X2Y2Module is BaseExchangeModule {
    using SafeERC20 for IERC20;

    // --- Fields ---

    IX2Y2 public constant EXCHANGE =
        IX2Y2(0x74312363e45DCaBA76c59ec49a7Aa8A65a67EeD3);

    address public constant ERC721_DELEGATE =
        0xF849de01B080aDC3A814FaBE1E2087475cF2E354;

    // --- Constructor ---

    constructor(address owner, address router)
        BaseModule(owner)
        BaseExchangeModule(router)
    {}

    // --- Fallback ---

    receive() external payable {}

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
        // Execute fill
        _buy(input, params.fillTo, params.revertIfIncomplete, params.amount);
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
        // X2Y2 does not support batch filling so we fill orders one by one
        uint256 length = inputs.length;
        for (uint256 i = 0; i < length; ) {
            // Execute fill
            _buy(
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

    // --- ERC721 / ERC1155 hooks ---

    // Single token offer acceptance can be done approval-less by using the
    // standard `safeTransferFrom` method together with specifying data for
    // further contract calls. An example:
    // `safeTransferFrom(
    //      0xWALLET,
    //      0xMODULE,
    //      TOKEN_ID,
    //      0xABI_ENCODED_ROUTER_EXECUTION_CALLDATA_FOR_OFFER_ACCEPTANCE
    // )`

    function onERC721Received(
        address, // operator,
        address, // from
        uint256, // tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        if (data.length > 0) {
            _makeCall(router, data, 0);
        }

        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // tokenId
        uint256, // amount
        bytes calldata data
    ) external returns (bytes4) {
        if (data.length > 0) {
            _makeCall(router, data, 0);
        }

        return this.onERC1155Received.selector;
    }

    // --- Internal ---

    function _buy(
        IX2Y2.RunInput calldata input,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        if (input.details.length != 1) {
            revert WrongParams();
        }

        // Extract the order's corresponding token
        IX2Y2.SettleDetail calldata detail = input.details[0];
        IX2Y2.OrderItem calldata orderItem = input
            .orders[detail.orderIdx]
            .items[detail.itemIdx];
        if (detail.op != IX2Y2.Op.COMPLETE_SELL_OFFER) {
            revert WrongParams();
        }
        IX2Y2.Pair[] memory pairs = abi.decode(orderItem.data, (IX2Y2.Pair[]));
        if (pairs.length != 1) {
            revert WrongParams();
        }

        // Execute fill
        try EXCHANGE.run{value: value}(input) {
            IERC721(pairs[0].token).safeTransferFrom(
                address(this),
                receiver,
                pairs[0].tokenId
            );
        } catch {
            // Revert if specified
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }
        }
    }
}
