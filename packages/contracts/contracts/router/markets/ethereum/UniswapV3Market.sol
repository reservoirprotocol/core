// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BaseMarket} from "../BaseMarket.sol";
import {IUniswapV3Router} from "../../interfaces/IUniswapV3Router.sol";

contract UniswapV3Market is BaseMarket {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public immutable weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    address public immutable swapRouter =
        0xE592427A0AEce92De3Edee1F18E0157C05861564;

    // --- Errors ---

    error WrongParams();

    // --- Constructor ---

    constructor(address router) BaseMarket(router) {}

    // --- Swaps ---

    function ethToExactOutput(
        IUniswapV3Router.ExactOutputSingleParams calldata params,
        address refundTo
    ) external payable {
        if (params.tokenIn != weth) {
            revert WrongParams();
        }

        IUniswapV3Router(swapRouter).exactOutputSingle{value: msg.value}(
            params
        );

        // Refund any leftover
        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool success, ) = payable(refundTo).call{value: leftover}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function erc20ToExactOutput(
        IUniswapV3Router.ExactOutputSingleParams calldata params,
        address refundTo
    ) external {
        address token = params.tokenIn;

        IERC20(token).approve(swapRouter, params.amountInMaximum);
        IUniswapV3Router(swapRouter).exactOutputSingle(params);

        // Refund any leftover
        uint256 leftover = IERC20(token).balanceOf(address(this));
        if (leftover > 0) {
            IERC20(token).safeTransfer(refundTo, leftover);
        }
    }

    // TODO: Add support for multi-hop swaps
}
