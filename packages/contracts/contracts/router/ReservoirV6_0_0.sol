// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract ReservoirV6_0_0 is Ownable, ReentrancyGuard {
    // --- Fields ---

    mapping(address => bool) public modules;

    // --- Errors ---

    error UnknownModule();
    error UnsuccessfulExecution();

    // --- Owner ---

    function registerModule(address module) external onlyOwner {
        modules[module] = true;
    }

    // --- Public ---

    struct ExecutionInfo {
        address module;
        bytes data;
        uint256 value;
    }

    function execute(ExecutionInfo[] calldata executionInfos)
        external
        payable
        nonReentrant
    {
        address module;
        bool success;

        uint256 length = executionInfos.length;
        for (uint256 i = 0; i < length; ) {
            module = executionInfos[i].module;
            if (!modules[module]) {
                revert UnknownModule();
            }

            (success, ) = module.call{value: executionInfos[i].value}(
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
