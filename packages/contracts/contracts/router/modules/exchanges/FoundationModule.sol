// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {IFoundation} from "../../interfaces/IFoundation.sol";

// Notes on the Foundation module:
// - only supports filling "buy now" listings (which are ERC721 and ETH-denominated)

contract FoundationModule is BaseExchangeModule {
    // --- Fields ---

    address public constant exchange =
        0xcDA72070E455bb31C7690a170224Ce43623d0B6f;

    // --- Constructor ---

    constructor(address owner) BaseModule(owner) {}

    // --- Single ETH listing ---

    function acceptETHListing(
        NFT calldata nft,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        buy(nft, params.fillTo, params.revertIfIncomplete, params.amount);
    }

    // --- Multiple ETH listings ---

    function acceptETHListings(
        NFT[] calldata nfts,
        uint256[] calldata prices,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        uint256 length = nfts.length;
        for (uint256 i = 0; i < length; ) {
            buy(nfts[i], params.fillTo, params.revertIfIncomplete, prices[i]);

            unchecked {
                ++i;
            }
        }
    }

    // --- Internal ---

    function buy(
        NFT calldata nft,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        bool success;
        try
            IFoundation(exchange).buyV2{value: value}(
                nft.token,
                nft.id,
                value,
                receiver
            )
        {
            IERC721(nft.token).safeTransferFrom(
                address(this),
                receiver,
                nft.id
            );

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }
}
