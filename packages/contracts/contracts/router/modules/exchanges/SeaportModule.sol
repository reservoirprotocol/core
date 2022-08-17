// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {ISeaport} from "../../interfaces/ISeaport.sol";

// Notes on the Seaport module:
// - supports filling listings (both ERC721/ERC1155)
// - supports filling offers (both ERC721/ERC1155)

contract SeaportModule is BaseExchangeModule {
    using SafeERC20 for IERC20;

    // --- Structs ---

    struct SeaportFulfillments {
        ISeaport.FulfillmentComponent[][] offer;
        ISeaport.FulfillmentComponent[][] consideration;
    }

    // --- Fields ---

    address public constant exchange =
        0x00000000006c3852cbEf3e08E8dF289169EdE581;

    // --- Constructor ---

    constructor(address owner, address router)
        BaseModule(owner)
        BaseExchangeModule(router)
    {}

    // --- Single ETH listing ---

    function acceptETHListing(
        ISeaport.AdvancedOrder calldata order,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        fillSingleOrder(
            order,
            new ISeaport.CriteriaResolver[](0),
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- Single ERC20 listing ---

    function acceptERC20Listing(
        ISeaport.AdvancedOrder calldata order,
        ERC20ListingParams calldata params,
        Fee[] calldata fees
    )
        external
        nonReentrant
        refundERC20Leftover(params.refundTo, params.token)
        chargeERC20Fees(fees, params.token, params.amount)
    {
        approveERC20IfNeeded(params.token, exchange, params.amount);
        fillSingleOrder(
            order,
            new ISeaport.CriteriaResolver[](0),
            params.fillTo,
            params.revertIfIncomplete,
            0
        );
    }

    // --- Multiple ETH listings ---

    function acceptETHListings(
        ISeaport.AdvancedOrder[] calldata orders,
        // Use `memory` instead of `calldata` to avoid `Stack too deep` errors
        SeaportFulfillments memory fulfillments,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        fillMultipleOrders(
            orders,
            new ISeaport.CriteriaResolver[](0),
            fulfillments,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- Multiple ERC20 listings ---

    function acceptERC20Listings(
        ISeaport.AdvancedOrder[] calldata orders,
        // Use `memory` instead of `calldata` to avoid `Stack too deep` errors
        SeaportFulfillments memory fulfillments,
        ERC20ListingParams calldata params,
        Fee[] calldata fees
    )
        external
        nonReentrant
        refundERC20Leftover(params.refundTo, params.token)
        chargeERC20Fees(fees, params.token, params.amount)
    {
        approveERC20IfNeeded(params.token, exchange, params.amount);
        fillMultipleOrders(
            orders,
            new ISeaport.CriteriaResolver[](0),
            fulfillments,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );
    }

    // --- Single ERC721 offer ---

    function acceptERC721Offer(
        ISeaport.AdvancedOrder calldata order,
        // Use `memory` instead of `calldata` to avoid `Stack too deep` errors
        ISeaport.CriteriaResolver[] memory criteriaResolvers,
        OfferParams calldata params,
        NFT calldata nft
    ) external nonReentrant {
        approveERC721IfNeeded(nft.token, exchange);
        fillSingleOrder(
            order,
            criteriaResolvers,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );

        if (!params.revertIfIncomplete) {
            // Refund
            sendAllERC721(params.refundTo, nft.token, nft.id);
        }
    }

    // --- Single ERC1155 offer ---

    function acceptERC1155Offer(
        ISeaport.AdvancedOrder calldata order,
        // Use `memory` instead of `calldata` to avoid `Stack too deep` errors
        ISeaport.CriteriaResolver[] memory criteriaResolvers,
        OfferParams calldata params,
        NFT calldata nft
    ) external nonReentrant {
        approveERC1155IfNeeded(nft.token, exchange);
        fillSingleOrder(
            order,
            criteriaResolvers,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );

        if (!params.revertIfIncomplete) {
            // Refund
            sendAllERC1155(params.refundTo, nft.token, nft.id);
        }
    }

    // --- Generic handler (used for Seaport-based approvals) ---

    function matchOrders(
        ISeaport.Order[] calldata orders,
        ISeaport.Fulfillment[] calldata fulfillments
    ) external {
        ISeaport(exchange).matchOrders(orders, fulfillments);
    }

    // --- Internal ---

    function fillSingleOrder(
        ISeaport.AdvancedOrder calldata order,
        ISeaport.CriteriaResolver[] memory criteriaResolvers,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        bool success;
        try
            ISeaport(exchange).fulfillAdvancedOrder{value: value}(
                order,
                criteriaResolvers,
                bytes32(0),
                receiver
            )
        returns (bool fulfilled) {
            success = fulfilled;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }

    function fillMultipleOrders(
        ISeaport.AdvancedOrder[] calldata orders,
        // Use `memory` instead of `calldata` to avoid `Stack too deep` errors
        ISeaport.CriteriaResolver[] memory criteriaResolvers,
        SeaportFulfillments memory fulfillments,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        (bool[] memory fulfilled, ) = ISeaport(exchange)
            .fulfillAvailableAdvancedOrders{value: value}(
            orders,
            criteriaResolvers,
            fulfillments.offer,
            fulfillments.consideration,
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
}
