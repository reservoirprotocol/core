// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract BaseModule is Ownable, ReentrancyGuard {
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
    error UnsuccessfulPayment();

    // --- Constructor ---

    constructor(address router) {
        _transferOwnership(router);
    }

    // --- Fallback ---

    receive() external payable {}

    // --- Modifiers ---

    modifier refundETHLeftover(address refundTo) {
        _;

        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool success, ) = payable(refundTo).call{value: leftover}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
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

            bool success;
            for (uint256 i = 0; i < length; ) {
                uint256 actualFee = (fees[i].amount * actualPaid) / amount;
                (success, ) = payable(fees[i].recipient).call{value: actualFee}(
                    ""
                );
                if (!success) {
                    revert UnsuccessfulPayment();
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

            bool success;
            for (uint256 i = 0; i < length; ) {
                uint256 actualFee = (fees[i].amount * actualPaid) / amount;
                IERC20(token).safeTransfer(fees[i].recipient, actualFee);

                unchecked {
                    ++i;
                }
            }
        }
    }
}
