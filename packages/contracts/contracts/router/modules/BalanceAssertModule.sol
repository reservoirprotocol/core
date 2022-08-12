// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseModule} from "./BaseModule.sol";
import {IWETH} from "../interfaces/IWETH.sol";

// When sniping NFTs, a lot of gas is lost when someone else's fill transaction
// gets included right before. To optimize the amount of gas that is lost, this
// module performs a balance/owner check so that we revert as early as possible
// and spend as few gas as possible.
contract BalanceAssertModule is BaseModule {
    // --- Errors ---

    error AssertFailed();

    // --- Constructor ---

    constructor(address owner) BaseModule(owner) {}

    // --- [ERC721] Single assert ---

    function assertERC721Owner(
        address token,
        uint256 tokenId,
        address owner
    ) external nonReentrant {
        address actualOwner = IERC721(token).ownerOf(tokenId);
        if (owner != actualOwner) {
            revert AssertFailed();
        }
    }

    // --- [ERC1155] Single assert ---

    function assertERC1155Balance(
        address token,
        uint256 tokenId,
        address owner,
        uint256 balance
    ) external nonReentrant {
        uint256 actualBalance = IERC1155(token).balanceOf(owner, tokenId);
        if (balance < actualBalance) {
            revert AssertFailed();
        }
    }
}
