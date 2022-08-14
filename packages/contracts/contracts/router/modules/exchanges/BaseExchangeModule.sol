// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseModule} from "../BaseModule.sol";

// Since most NFT marketplaces share a common structure/design, the `BaseExchangeModule`
// contract provides some useful helpers relevant for most of the existing marketplaces.
abstract contract BaseExchangeModule is BaseModule {
    using SafeERC20 for IERC20;

    // --- Structs ---

    struct ETHListingParams {
        address fillTo;
        address refundTo;
        bool revertIfIncomplete;
        uint256 amount;
    }

    struct ERC20ListingParams {
        address fillTo;
        address refundTo;
        bool revertIfIncomplete;
        address token;
        uint256 amount;
    }

    struct OfferParams {
        address fillTo;
        address refundTo;
        bool revertIfIncomplete;
    }

    struct NFT {
        address token;
        uint256 id;
    }

    struct Fee {
        address recipient;
        uint256 amount;
    }

    // --- Errors ---

    error UnsuccessfulFill();

    // --- Modifiers ---

    modifier refundETHLeftover(address refundTo) {
        _;

        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            sendETH(refundTo, leftover);
        }
    }

    modifier refundERC20Leftover(address refundTo, address token) {
        _;

        uint256 leftover = IERC20(token).balanceOf(address(this));
        if (leftover > 0) {
            IERC20(token).safeTransfer(refundTo, leftover);
        }
    }

    modifier chargeETHFees(Fee[] calldata fees, uint256 amount) {
        uint256 balanceBefore = address(this).balance;

        _;

        uint256 balanceAfter = address(this).balance;

        uint256 length = fees.length;
        if (length > 0) {
            uint256 actualPaid = balanceBefore - balanceAfter;

            uint256 actualFee;
            for (uint256 i = 0; i < length; ) {
                // Adjust the fee to what was actually paid
                actualFee = (fees[i].amount * actualPaid) / amount;
                if (actualFee > 0) {
                    sendETH(fees[i].recipient, actualFee);
                }

                unchecked {
                    ++i;
                }
            }
        }
    }

    modifier chargeERC20Fees(
        Fee[] calldata fees,
        address token,
        uint256 amount
    ) {
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        _;

        uint256 balanceAfter = IERC20(token).balanceOf(address(this));

        uint256 length = fees.length;
        if (length > 0) {
            uint256 actualPaid = balanceBefore - balanceAfter;

            uint256 actualFee;
            for (uint256 i = 0; i < length; ) {
                // Adjust the fee to what was actually paid
                actualFee = (fees[i].amount * actualPaid) / amount;
                if (actualFee > 0) {
                    IERC20(token).safeTransfer(fees[i].recipient, actualFee);
                }

                unchecked {
                    ++i;
                }
            }
        }
    }

    // --- Helpers ---

    function sendAllERC721(
        address to,
        address token,
        uint256 tokenId
    ) internal {
        if (IERC721(token).ownerOf(tokenId) == address(this)) {
            IERC721(token).safeTransferFrom(address(this), to, tokenId);
        }
    }

    function sendAllERC1155(
        address to,
        address token,
        uint256 tokenId
    ) internal {
        uint256 balance = IERC1155(token).balanceOf(address(this), tokenId);
        if (balance > 0) {
            IERC1155(token).safeTransferFrom(
                address(this),
                to,
                tokenId,
                balance,
                ""
            );
        }
    }

    // Optimized methods for approvals (only giving approvals when strictly needed)

    function approveERC20IfNeeded(
        address token,
        address spender,
        uint256 amount
    ) internal {
        uint256 allowance = IERC20(token).allowance(address(this), spender);
        if (allowance < amount) {
            IERC20(token).approve(spender, type(uint256).max);
        }
    }

    function approveERC721IfNeeded(address token, address operator) internal {
        bool isApproved = IERC721(token).isApprovedForAll(
            address(this),
            operator
        );
        if (!isApproved) {
            IERC721(token).setApprovalForAll(operator, true);
        }
    }

    function approveERC1155IfNeeded(address token, address operator) internal {
        bool isApproved = IERC1155(token).isApprovedForAll(
            address(this),
            operator
        );
        if (!isApproved) {
            IERC1155(token).setApprovalForAll(operator, true);
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
            (address target, bytes memory callData) = abi.decode(
                data,
                (address, bytes)
            );
            makeCall(target, callData, 0);
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
            (address target, bytes memory callData) = abi.decode(
                data,
                (address, bytes)
            );
            makeCall(target, callData, 0);
        }

        return this.onERC1155Received.selector;
    }
}
