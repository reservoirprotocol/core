// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {IFoundation} from "../../interfaces/IFoundation.sol";

contract FoundationModule is BaseExchangeModule {
    // --- Fields ---

    address public constant exchange =
        0xcDA72070E455bb31C7690a170224Ce43623d0B6f;

    // --- Constructor ---

    constructor(address owner) BaseModule(owner) {}

    // --- [ERC721] Single ETH listing ---

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
        bool success;
        try
            IFoundation(exchange).buyV2{value: params.amount}(
                nft.token,
                nft.id,
                params.amount,
                params.fillTo
            )
        {
            IERC721(nft.token).safeTransferFrom(
                address(this),
                params.fillTo,
                nft.id
            );

            success = true;
        } catch {}

        if (params.revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }
}
