// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {ILooksRare} from "../../../interfaces/ILooksRare.sol";

// Notes:
// - supports filling listings (both ERC721/ERC1155 but only ETH-denominated)
// - supports filling offers (both ERC721/ERC1155)

contract LooksRareModule is BaseExchangeModule {
    using SafeERC20 for IERC20;

    // --- Fields ---

    ILooksRare public constant EXCHANGE =
        ILooksRare(0x59728544B08AB483533076417FbBB2fD0B17CE3a);

    address public constant ERC721_TRANSFER_MANAGER =
        0xf42aa99F011A1fA7CDA90E5E98b277E306BcA83e;
    address public constant ERC1155_TRANSFER_MANAGER =
        0xFED24eC7E22f573c2e08AEF55aA6797Ca2b3A051;

    bytes4 public constant ERC721_INTERFACE = 0x80ac58cd;
    bytes4 public constant ERC1155_INTERFACE = 0xd9b67a26;

    // --- Constructor ---

    constructor(address owner, address router)
        BaseModule(owner)
        BaseExchangeModule(router)
    {}

    // --- Single ETH listing ---

    function acceptETHListing(
        ILooksRare.TakerOrder calldata takerBid,
        ILooksRare.MakerOrder calldata makerAsk,
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
        _buy(
            takerBid,
            makerAsk,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- Multiple ETH listings ---

    function acceptETHListings(
        ILooksRare.TakerOrder[] calldata takerBids,
        ILooksRare.MakerOrder[] calldata makerAsks,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        // LooksRare does not support batch filling so we fill orders one by one
        for (uint256 i = 0; i < takerBids.length; ) {
            // Use `memory` to avoid `Stack too deep` errors
            ILooksRare.TakerOrder memory takerBid = takerBids[i];

            // Execute fill
            _buy(
                takerBids[i],
                makerAsks[i],
                params.fillTo,
                params.revertIfIncomplete,
                takerBid.price
            );

            unchecked {
                ++i;
            }
        }
    }

    // --- [ERC721] Single offer ---

    function acceptERC721Offer(
        ILooksRare.TakerOrder calldata takerAsk,
        ILooksRare.MakerOrder calldata makerBid,
        OfferParams calldata params
    ) external nonReentrant {
        IERC721 collection = IERC721(address(makerBid.collection));

        // Approve the transfer manager if needed
        _approveERC721IfNeeded(collection, ERC721_TRANSFER_MANAGER);

        // Execute the fill
        _sell(takerAsk, makerBid, params.fillTo, params.revertIfIncomplete);

        // Refund any ERC721 leftover
        _sendAllERC721(params.refundTo, collection, takerAsk.tokenId);
    }

    // --- [ERC1155] Single offer ---

    function acceptERC1155Offer(
        ILooksRare.TakerOrder calldata takerAsk,
        ILooksRare.MakerOrder calldata makerBid,
        OfferParams calldata params
    ) external nonReentrant {
        IERC1155 collection = IERC1155(address(makerBid.collection));

        // Approve the transfer manager if needed
        _approveERC1155IfNeeded(collection, ERC1155_TRANSFER_MANAGER);

        // Execute the fill
        _sell(takerAsk, makerBid, params.fillTo, params.revertIfIncomplete);

        // Refund any ERC1155 leftover
        _sendAllERC1155(params.refundTo, collection, takerAsk.tokenId);
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
        ILooksRare.TakerOrder calldata takerBid,
        ILooksRare.MakerOrder calldata makerAsk,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        // Execute the fill
        try
            EXCHANGE.matchAskWithTakerBidUsingETHAndWETH{value: value}(
                takerBid,
                makerAsk
            )
        {
            IERC165 collection = makerAsk.collection;

            // Forward any token to the specified receiver
            bool isERC721 = collection.supportsInterface(ERC721_INTERFACE);
            if (isERC721) {
                IERC721(address(collection)).safeTransferFrom(
                    address(this),
                    receiver,
                    takerBid.tokenId
                );
            } else {
                bool isERC1155 = collection.supportsInterface(
                    ERC1155_INTERFACE
                );
                if (isERC1155) {
                    IERC1155(address(collection)).safeTransferFrom(
                        address(this),
                        receiver,
                        takerBid.tokenId,
                        makerAsk.amount,
                        ""
                    );
                }
            }
        } catch {
            // Revert if specified
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }
        }
    }

    function _sell(
        ILooksRare.TakerOrder calldata takerAsk,
        ILooksRare.MakerOrder calldata makerBid,
        address receiver,
        bool revertIfIncomplete
    ) internal {
        // Execute the fill
        try EXCHANGE.matchBidWithTakerAsk(takerAsk, makerBid) {
            // Forward any payment to the specified receiver
            makerBid.currency.safeTransfer(receiver, takerAsk.price);
        } catch {
            // Revert if specified
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }
        }
    }
}
