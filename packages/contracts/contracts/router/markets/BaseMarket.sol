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

    // --- Modifiers ---

    modifier refund() {
        _;

        // Refund any leftover
        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool success, ) = payable(msg.sender).call{value: leftover}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    // --- Virtual methods ---

    function erc721Operator() external view virtual returns (address);

    function erc1155Operator() external view virtual returns (address);
}
