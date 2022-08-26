// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {BaseModule} from "./BaseModule.sol";
import {IWETH} from "../../interfaces/IWETH.sol";

// The way we deal with unwrapping WETH as part of accepting an offer is
// via a custom module. Funds earned from offer acceptance should all be
// routed to this module, which then takes care of unwrapping (of course,
// in the end forwarding the unwrapped funds to the specified recipient).
contract UnwrapWETHModule is BaseModule {
    // --- Fields ---

    IWETH public constant WETH =
        IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    // --- Constructor ---

    constructor(address owner) BaseModule(owner) {}

    // --- Fallback ---

    receive() external payable {}

    // --- Unwrap ---

    function unwrapWETH(address receiver) external nonReentrant {
        uint256 balance = WETH.balanceOf(address(this));
        WETH.withdraw(balance);
        _sendETH(receiver, balance);
    }
}
