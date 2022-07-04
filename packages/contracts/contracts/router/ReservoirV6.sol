// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {BaseMarket} from "./common/BaseMarket.sol";

contract ReservoirV6 is Ownable, ReentrancyGuard {
    mapping(address => bool) public markets;

    error UnknownMarket();
    error UnsuccessfulFill();
    error UnsuccessfulPayment();

    struct FillListingInfo {
        address market;
        bytes data;
        uint256 value;
    }

    struct FillBidInfo {
        address market;
        bytes data;
    }

    // --- Helpers ---

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

    // --- Owner ---

    function registerMarket(address market) external onlyOwner {
        markets[market] = true;
    }

    // --- Fill listings ---

    function fillListing(
        address referrer,
        uint16 referrerFeeBps,
        FillListingInfo calldata fillInfo
    ) external payable nonReentrant refund {
        address market = fillInfo.market;
        if (!markets[market]) {
            revert UnknownMarket();
        }

        uint256 balanceBefore = address(this).balance;

        (bool success, ) = market.call{value: fillInfo.value}(fillInfo.data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        uint256 balanceAfter = address(this).balance;

        // Pay referrer
        uint256 totalPaid = balanceBefore - balanceAfter;
        if (referrerFeeBps > 0 && totalPaid > 0) {
            uint256 referrerFee = (totalPaid * referrerFeeBps) / 10000;
            (success, ) = payable(referrer).call{value: referrerFee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function fillListings(
        address referrer,
        uint16 referrerFeeBps,
        FillListingInfo[] calldata fillInfos
    ) external payable nonReentrant refund {
        address market;
        bool success;

        uint256 balanceBefore = address(this).balance;

        uint256 length = fillInfos.length;
        for (uint256 i = 0; i < length; ) {
            market = fillInfos[i].market;
            if (!markets[market]) {
                revert UnknownMarket();
            }

            (success, ) = market.call{value: fillInfos[i].value}(
                fillInfos[i].data
            );
            if (!success) {
                revert UnsuccessfulFill();
            }

            unchecked {
                ++i;
            }
        }

        uint256 balanceAfter = address(this).balance;

        // Pay referrer
        uint256 totalPaid = balanceBefore - balanceAfter;
        if (referrerFeeBps > 0 && totalPaid > 0) {
            uint256 referrerFee = (totalPaid * referrerFeeBps) / 10000;
            (success, ) = payable(referrer).call{value: referrerFee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    // --- Fill bids ---

    function onERC721Received(
        address, // operator,
        address, // from
        uint256, // tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        FillBidInfo memory fillInfo = abi.decode(data, (FillBidInfo));

        address market = fillInfo.market;
        if (!markets[market]) {
            revert UnknownMarket();
        }

        address operator = BaseMarket(market).erc721Operator();
        bool isApproved = IERC721(msg.sender).isApprovedForAll(
            address(this),
            operator
        );
        if (!isApproved) {
            IERC721(msg.sender).setApprovalForAll(operator, true);
        }

        (bool success, ) = market.call(fillInfo.data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // tokenId
        uint256, // amount
        bytes calldata data
    ) external returns (bytes4) {
        FillBidInfo memory fillInfo = abi.decode(data, (FillBidInfo));

        address market = fillInfo.market;
        if (!markets[market]) {
            revert UnknownMarket();
        }

        address operator = BaseMarket(market).erc1155Operator();
        bool isApproved = IERC1155(msg.sender).isApprovedForAll(
            address(this),
            operator
        );
        if (!isApproved) {
            IERC1155(msg.sender).setApprovalForAll(operator, true);
        }

        (bool success, ) = market.call(fillInfo.data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        return this.onERC1155Received.selector;
    }
}
