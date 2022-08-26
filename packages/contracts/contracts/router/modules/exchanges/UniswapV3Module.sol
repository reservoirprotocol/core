// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {IUniswapV3Router} from "../../../interfaces/IUniswapV3Router.sol";

// Notes:
// - supports swapping ETH and ERC20 to any token via a direct path
// - TODO: support swapping via indirect paths

contract UniswapV3Module is BaseExchangeModule {
    // --- Fields ---

    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    address public constant SWAP_ROUTER =
        0xE592427A0AEce92De3Edee1F18E0157C05861564;

    // --- Constructor ---

    constructor(address owner, address router)
        BaseModule(owner)
        BaseExchangeModule(router)
    {}

    // --- Fallback ---

    receive() external payable {}

    // --- Swaps ---

    function ethToExactOutput(
        IUniswapV3Router.ExactOutputSingleParams calldata params,
        address refundTo
    ) external payable refundETHLeftover(refundTo) {
        if (
            address(params.tokenIn) != WETH ||
            msg.value != params.amountInMaximum
        ) {
            revert WrongParams();
        }

        // Execute the swap
        IUniswapV3Router(SWAP_ROUTER).exactOutputSingle{value: msg.value}(
            params
        );

        // Refund any ETH stucked in the router
        IUniswapV3Router(SWAP_ROUTER).refundETH();
    }

    function erc20ToExactOutput(
        IUniswapV3Router.ExactOutputSingleParams calldata params,
        address refundTo
    ) external refundERC20Leftover(refundTo, params.tokenIn) {
        // Approve the router if needed
        _approveERC20IfNeeded(
            params.tokenIn,
            SWAP_ROUTER,
            params.amountInMaximum
        );

        // Execute the swap
        IUniswapV3Router(SWAP_ROUTER).exactOutputSingle(params);
    }
}
