// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {BaseMarket} from "./markets/BaseMarket.sol";

contract ReservoirV6_0_0 is Ownable, ReentrancyGuard {
    mapping(address => bool) public markets;

    error UnknownMarket();
    error UnsuccessfulExecution();

    // --- Owner ---

    function registerMarket(address market) external onlyOwner {
        markets[market] = true;
    }

    // --- Public ---

    struct ExecutionInfo {
        address market;
        bytes data;
        uint256 value;
    }

    function execute(ExecutionInfo[] calldata executionInfos)
        external
        payable
        nonReentrant
    {
        address market;
        bool success;

        uint256 length = executionInfos.length;
        for (uint256 i = 0; i < length; ) {
            market = executionInfos[i].market;
            if (!markets[market]) {
                revert UnknownMarket();
            }

            (success, ) = market.call{value: executionInfos[i].value}(
                executionInfos[i].data
            );
            if (!success) {
                revert UnsuccessfulExecution();
            }

            unchecked {
                ++i;
            }
        }
    }
}
