// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IRarible {
    struct AssetType {
        IERC165 collection;
        uint tokenId;
        bytes4 assetClass;
        bytes data;
    }

    struct Asset {
        AssetType assetType;
        uint256 value;
    }

    struct Order {
        address maker;
        Asset make;
        address taker;
        Asset take;
        uint salt;
        uint start;
        uint end;
        bytes4 dataType;
        bytes data;
    }

    struct NftData {
        uint tokenId;
        IERC165 collection;
    }

    function matchOrders(
        Order calldata orderLeft,
        Order calldata orderRight
    ) external payable;
}

interface IRaribleTransferManager {
    function TRANSFER_MANAGER() external view returns (address);
}