// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BaseModule} from "./BaseModule.sol";
import {IWETH} from "../interfaces/IWETH.sol";

// The way we deal with unwrapping WETH as part of accepting an offer is
// via a custom module. Funds earned from offer acceptance should all be
// routed to this module, which then takes care of unwrapping (of course,
// in the end forwarding the unwrapped funds to the specified recipient).
contract UnwrapWETHModule is BaseModule {
    // --- Fields ---

    address public immutable weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // --- Constructor ---

    constructor(address owner) BaseModule(owner) {}

    // --- Unwrap ---

    function unwrapWETH(address receiver) external nonReentrant {
        uint256 balance = IERC20(weth).balanceOf(address(this));
        IWETH(weth).withdraw(balance);
        sendETH(receiver, balance);
    }
}
