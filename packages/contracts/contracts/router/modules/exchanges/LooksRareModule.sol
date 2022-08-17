// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {ILooksRare} from "../../interfaces/ILooksRare.sol";

// Notes on the LooksRare module:
// - supports filling listings (both ERC721/ERC1155 but only ETH-denominated)
// - supports filling offers (both ERC721/ERC1155)

contract LooksRareModule is BaseExchangeModule {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public constant exchange =
        0x59728544B08AB483533076417FbBB2fD0B17CE3a;

    address public constant erc721TransferManager =
        0xf42aa99F011A1fA7CDA90E5E98b277E306BcA83e;

    address public constant erc1155TransferManager =
        0xFED24eC7E22f573c2e08AEF55aA6797Ca2b3A051;

    bytes4 public constant erc721Interface = 0x80ac58cd;
    bytes4 public constant erc1155Interface = 0xd9b67a26;

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
        buy(
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
        for (uint256 i = 0; i < takerBids.length; ) {
            // Use `memory` to avoid `Stack too deep` errors
            ILooksRare.TakerOrder memory takerBid = takerBids[i];

            buy(
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
        ILooksRare.TakerOrder calldata takerBid,
        ILooksRare.MakerOrder calldata makerAsk,
        OfferParams calldata params,
        NFT calldata nft
    ) external nonReentrant {
        approveERC721IfNeeded(makerAsk.collection, erc721TransferManager);

        bool success;
        try ILooksRare(exchange).matchBidWithTakerAsk(takerBid, makerAsk) {
            IERC20(makerAsk.currency).safeTransfer(
                params.fillTo,
                IERC20(makerAsk.currency).balanceOf(address(this))
            );

            success = true;
        } catch {}

        if (!success) {
            if (params.revertIfIncomplete) {
                revert UnsuccessfulFill();
            } else {
                // Refund
                sendAllERC721(params.refundTo, nft.token, nft.id);
            }
        }
    }

    // --- [ERC1155] Single offer ---

    function acceptERC1155Offer(
        ILooksRare.TakerOrder calldata takerBid,
        ILooksRare.MakerOrder calldata makerAsk,
        OfferParams calldata params,
        NFT calldata nft
    ) external nonReentrant {
        approveERC1155IfNeeded(makerAsk.collection, erc1155TransferManager);

        bool success;
        try ILooksRare(exchange).matchBidWithTakerAsk(takerBid, makerAsk) {
            IERC20(makerAsk.currency).safeTransfer(
                params.fillTo,
                IERC20(makerAsk.currency).balanceOf(address(this))
            );

            success = true;
        } catch {}

        if (!success) {
            if (params.revertIfIncomplete) {
                revert UnsuccessfulFill();
            } else {
                // Refund
                sendAllERC1155(params.refundTo, nft.token, nft.id);
            }
        }
    }

    // --- Internal ---

    function buy(
        ILooksRare.TakerOrder calldata takerBid,
        ILooksRare.MakerOrder calldata makerAsk,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        bool success;
        try
            ILooksRare(exchange).matchAskWithTakerBidUsingETHAndWETH{
                value: value
            }(takerBid, makerAsk)
        {
            if (
                IERC165(makerAsk.collection).supportsInterface(erc721Interface)
            ) {
                IERC721(makerAsk.collection).safeTransferFrom(
                    address(this),
                    receiver,
                    takerBid.tokenId
                );
            } else {
                IERC1155(makerAsk.collection).safeTransferFrom(
                    address(this),
                    receiver,
                    takerBid.tokenId,
                    makerAsk.amount,
                    ""
                );
            }

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }
}
