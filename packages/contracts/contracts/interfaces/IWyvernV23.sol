// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IWyvernV23 {
    function registry() external view returns (address);

    function tokenTransferProxy() external view returns (address);
}

interface IWyvernV23ProxyRegistry {
    function registerProxy() external;

    function proxies(address user) external view returns (address);
}
