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

    // --- Modifiers ---

    modifier refund() {
        _;

        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = payable(msg.sender).call{value: balance}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function erc721Operator() external view virtual returns (address);

    function erc1155Operator() external view virtual returns (address);
}
