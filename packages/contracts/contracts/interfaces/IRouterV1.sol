// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IRouterV1 {
    function fillLooksRare(
        address referrer,
        bytes memory data,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) external payable;

    function fillWyvernV23(address referrer, bytes calldata data)
        external
        payable;
}
