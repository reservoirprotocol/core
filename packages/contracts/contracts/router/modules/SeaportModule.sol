// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseModule} from "./BaseModule.sol";
import {ISeaport} from "../interfaces/ISeaport.sol";

contract SeaportModule is BaseModule {
    using SafeERC20 for IERC20;

    // --- Structs ---

    struct SeaportFulfillments {
        ISeaport.FulfillmentComponent[][] offer;
        ISeaport.FulfillmentComponent[][] consideration;
    }

    // --- Fields ---

    address public immutable exchange =
        0x00000000006c3852cbEf3e08E8dF289169EdE581;

    // --- Constructor ---

    constructor(address router) BaseModule(router) {}

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
        IERC20(params.token).safeApprove(exchange, params.amount);
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
        IERC20(params.token).safeApprove(exchange, params.amount);
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
        bool isApproved = IERC721(nft.token).isApprovedForAll(
            address(this),
            exchange
        );
        if (!isApproved) {
            IERC721(nft.token).setApprovalForAll(exchange, true);
        }

        fillSingleOrder(
            order,
            criteriaResolvers,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );

        if (!params.revertIfIncomplete) {
            // Refund
            if (IERC721(nft.token).ownerOf(nft.id) == address(this)) {
                IERC721(nft.token).safeTransferFrom(
                    address(this),
                    params.refundTo,
                    nft.id
                );
            }
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
        bool isApproved = IERC1155(nft.token).isApprovedForAll(
            address(this),
            exchange
        );
        if (!isApproved) {
            IERC1155(nft.token).setApprovalForAll(exchange, true);
        }

        fillSingleOrder(
            order,
            criteriaResolvers,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );

        if (!params.revertIfIncomplete) {
            // Refund
            uint256 balance = IERC1155(nft.token).balanceOf(
                address(this),
                nft.id
            );
            if (balance > 0) {
                IERC1155(nft.token).safeTransferFrom(
                    address(this),
                    params.refundTo,
                    nft.id,
                    balance,
                    ""
                );
            }
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

    // --- ERC721 / ERC1155 hooks ---

    function onERC721Received(
        address, // operator,
        address, // from
        uint256, // tokenId,
        bytes calldata // data
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // tokenId
        uint256, // amount
        bytes calldata // data
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
