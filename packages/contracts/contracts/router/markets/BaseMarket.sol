// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract BaseMarket is Ownable, ReentrancyGuard {
    // --- Errors ---

    error UnsuccessfulFill();
    error UnsuccessfulPayment();

    // --- Constructor ---

    constructor(address router) {
        _transferOwnership(router);
    }

    // --- Fallback ---

    receive() external payable {}
}
