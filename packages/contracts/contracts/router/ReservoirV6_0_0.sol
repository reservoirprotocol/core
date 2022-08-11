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
    error UnsuccessfulPayment();

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

    // Trigger a set of executions atomically.
    function execute(ExecutionInfo[] calldata executionInfos)
        external
        payable
        nonReentrant
    {
        uint256 length = executionInfos.length;
        for (uint256 i = 0; i < length; ) {
            executeInternal(executionInfos[i]);

            unchecked {
                ++i;
            }
        }
    }

    receive() external payable {}

    struct AmountCheckInfo {
        address checkContract;
        bytes checkData;
        uint256 maxAmount;
    }

    // Trigger a set of executions with amount checking. As opposed to the regular
    // `execute` method, `executeWithAmountCheck` supports stopping the executions
    // once the provided amount check reaches a certain value. This is useful when
    // trying to fill orders with slippage (eg. provide multiple orders and try to
    // fill until a certain balance is reached). In order to be flexible, checking
    // the amount is done generically by calling `checkContract` with `checkData`.
    // For example, this could be used to check the ERC721 total owned balance (by
    // using `balanceOf(owner)`), the ERC1155 total owned balance per token id (by
    // using `balanceOf(owner, tokenId)`), but also for checking the ERC1155 total
    // owned balance per multiple token ids (by using a custom contract that wraps
    // `balanceOfBatch(owners, tokenIds)`).
    function executeWithAmountCheck(
        ExecutionInfo[] calldata executionInfos,
        AmountCheckInfo calldata amountCheckInfo
    ) external payable nonReentrant {
        address checkContract = amountCheckInfo.checkContract;
        bytes calldata checkData = amountCheckInfo.checkData;
        uint256 maxAmount = amountCheckInfo.maxAmount;

        uint256 length = executionInfos.length;
        for (uint256 i = 0; i < length; ) {
            uint256 amount = getAmount(checkContract, checkData);
            if (amount >= maxAmount) {
                break;
            }
            executeInternal(executionInfos[i]);

            unchecked {
                ++i;
            }
        }

        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool success, ) = payable(msg.sender).call{value: leftover}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    // --- Internal ---

    function executeInternal(ExecutionInfo calldata executionInfo) internal {
        address module = executionInfo.module;
        if (!modules[module]) {
            revert UnknownModule();
        }

        (bool success, ) = module.call{value: executionInfo.value}(
            executionInfo.data
        );
        if (!success) {
            revert UnsuccessfulExecution();
        }
    }

    function getAmount(address to, bytes calldata data)
        internal
        view
        returns (uint256 amount)
    {
        (bool success, bytes memory result) = to.staticcall(data);
        if (!success) {
            revert UnsuccessfulExecution();
        }

        amount = abi.decode(result, (uint256));
    }
}
