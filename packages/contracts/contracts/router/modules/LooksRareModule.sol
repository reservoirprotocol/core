// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseModule} from "./BaseModule.sol";
import {ILooksRare} from "../interfaces/ILooksRare.sol";

contract LooksRareModule is BaseModule {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public immutable exchange =
        0x59728544B08AB483533076417FbBB2fD0B17CE3a;

    address public immutable erc721TransferManager =
        0xf42aa99F011A1fA7CDA90E5E98b277E306BcA83e;

    address public immutable erc1155TransferManager =
        0xFED24eC7E22f573c2e08AEF55aA6797Ca2b3A051;

    // --- Constructor ---

    constructor(address router) BaseModule(router) {}

    // --- [ERC721] Single ETH listing ---

    function acceptETHListingERC721(
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
        buyERC721(
            takerBid,
            makerAsk,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- [ERC721] Single ERC20 listing ---

    function acceptERC20ListingERC721(
        ILooksRare.TakerOrder calldata takerBid,
        ILooksRare.MakerOrder calldata makerAsk,
        ERC20ListingParams calldata params,
        Fee[] calldata fees
    )
        external
        nonReentrant
        refundERC20Leftover(params.refundTo, params.token)
        chargeERC20Fees(fees, params.token, params.amount)
    {
        IERC20(params.token).approve(exchange, params.amount);
        buyERC721(
            takerBid,
            makerAsk,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );
    }

    // --- [ERC721] Single offer ---

    function acceptERC721Offer(
        ILooksRare.TakerOrder calldata takerBid,
        ILooksRare.MakerOrder calldata makerAsk,
        OfferParams calldata params,
        NFT calldata nft
    ) external nonReentrant {
        bool isApproved = IERC721(makerAsk.collection).isApprovedForAll(
            address(this),
            exchange
        );
        if (!isApproved) {
            IERC721(makerAsk.collection).setApprovalForAll(
                erc721TransferManager,
                true
            );
        }

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
                if (IERC721(nft.token).ownerOf(nft.id) == address(this)) {
                    IERC721(nft.token).safeTransferFrom(
                        address(this),
                        params.refundTo,
                        nft.id
                    );
                }
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
        bool isApproved = IERC1155(makerAsk.collection).isApprovedForAll(
            address(this),
            exchange
        );
        if (!isApproved) {
            IERC1155(makerAsk.collection).setApprovalForAll(
                erc1155TransferManager,
                true
            );
        }

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
    }

    // --- Internal ---

    function buyERC721(
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
            IERC721(makerAsk.collection).safeTransferFrom(
                address(this),
                receiver,
                takerBid.tokenId
            );

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
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
