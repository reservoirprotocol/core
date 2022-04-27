// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IWETH} from "./interfaces/IWETH.sol";
import {ILooksRare, ILooksRareTransferSelectorNFT} from "./interfaces/ILooksRare.sol";
import {IWyvernV23, IWyvernV23ProxyRegistry} from "./interfaces/IWyvernV23.sol";

contract RouterV1 {
    enum OrderSide {
        BUY,
        SELL
    }

    enum FillKind {
        WYVERN_V23,
        LOOKS_RARE,
        ZEROEX_V4
    }

    address public immutable weth;

    address public immutable looksRare;
    address public immutable looksRareTransferManagerERC721;
    address public immutable looksRareTransferManagerERC1155;

    address public immutable wyvernV23;
    address public immutable wyvernV23Proxy;

    address public immutable zeroExV4;

    constructor(
        address wethAddress,
        address looksRareAddress,
        address wyvernV23Address,
        address zeroExV4Address
    ) {
        weth = wethAddress;

        // --- LooksRare setup ---

        looksRare = looksRareAddress;

        // Cache the transfer manager contracts
        address transferSelectorNFT = ILooksRare(looksRare)
            .transferSelectorNFT();
        looksRareTransferManagerERC721 = ILooksRareTransferSelectorNFT(
            transferSelectorNFT
        ).TRANSFER_MANAGER_ERC721();
        looksRareTransferManagerERC1155 = ILooksRareTransferSelectorNFT(
            transferSelectorNFT
        ).TRANSFER_MANAGER_ERC1155();

        // --- WyvernV23 setup ---

        wyvernV23 = wyvernV23Address;

        // Create a user proxy
        address proxyRegistry = IWyvernV23(wyvernV23).registry();
        IWyvernV23ProxyRegistry(proxyRegistry).registerProxy();
        wyvernV23Proxy = IWyvernV23ProxyRegistry(proxyRegistry).proxies(
            address(this)
        );

        // Approve the token transfer proxy
        IERC20(weth).approve(
            IWyvernV23(wyvernV23).tokenTransferProxy(),
            type(uint256).max
        );

        // --- ZeroExV4 setup ---

        zeroExV4 = zeroExV4Address;
    }

    receive() external payable {
        // For unwrapping WETH
    }

    function genericERC721Fill(
        address, // referrer
        bytes memory data,
        FillKind fillKind,
        OrderSide takerSide,
        address collection,
        uint256 tokenId,
        bool unwrapWeth
    ) external payable {
        address target;
        address operator;
        if (fillKind == FillKind.WYVERN_V23) {
            target = wyvernV23;
            operator = wyvernV23Proxy;
        } else if (fillKind == FillKind.LOOKS_RARE) {
            target = looksRare;
            operator = looksRareTransferManagerERC721;
        } else if (fillKind == FillKind.ZEROEX_V4) {
            target = zeroExV4;
            operator = zeroExV4;
        } else {
            revert("Unknown fill kind");
        }

        if (takerSide == OrderSide.SELL) {
            // Approve the exchange to transfer the NFT out of the router.
            bool isApproved = IERC721(collection).isApprovedForAll(
                address(this),
                operator
            );
            if (!isApproved) {
                IERC721(collection).setApprovalForAll(operator, true);
            }
        }

        (bool success, ) = target.call{value: msg.value}(data);
        require(success, "Unsuccessfull fill");

        if (takerSide == OrderSide.BUY && fillKind != FillKind.WYVERN_V23) {
            // When filling LooksRare or ZeroExV4 listings we need to send
            // the NFT to the taker's wallet after the fill (since they do
            // not allow specifying a different recipient than the taker).
            IERC721(collection).transferFrom(
                address(this),
                msg.sender,
                tokenId
            );
        } else if (takerSide == OrderSide.SELL) {
            // Send the payment to the actual taker.
            uint256 balance = IERC20(weth).balanceOf(address(this));
            if (unwrapWeth) {
                IWETH(weth).withdraw(balance);
                (success, ) = payable(msg.sender).call{value: balance}("");
                require(success, "Could not send payment");
            } else {
                IERC20(weth).transfer(msg.sender, balance);
            }
        }
    }

    function genericERC1155Fill(
        address, // referrer
        bytes memory data,
        FillKind fillKind,
        OrderSide takerSide,
        address collection,
        uint256 tokenId,
        uint256 amount,
        bool unwrapWeth
    ) external payable {
        address target;
        address operator;
        if (fillKind == FillKind.WYVERN_V23) {
            target = wyvernV23;
            operator = wyvernV23Proxy;
        } else if (fillKind == FillKind.LOOKS_RARE) {
            target = looksRare;
            operator = looksRareTransferManagerERC1155;
        } else if (fillKind == FillKind.ZEROEX_V4) {
            target = zeroExV4;
            operator = zeroExV4;
        } else {
            revert("Unknown fill kind");
        }

        if (takerSide == OrderSide.SELL) {
            // Approve the exchange to transfer the NFT out of the router.
            bool isApproved = IERC1155(collection).isApprovedForAll(
                address(this),
                operator
            );
            if (!isApproved) {
                IERC1155(collection).setApprovalForAll(operator, true);
            }
        }

        (bool success, ) = target.call{value: msg.value}(data);
        require(success, "Unsuccessfull fill");

        if (takerSide == OrderSide.BUY && fillKind != FillKind.WYVERN_V23) {
            // When filling LooksRare or ZeroExV4 listings we need to send
            // the NFT to the taker's wallet after the fill (since they do
            // not allow specifying a different recipient than the taker).
            IERC1155(collection).safeTransferFrom(
                address(this),
                msg.sender,
                tokenId,
                amount,
                ""
            );
        } else if (takerSide == OrderSide.SELL) {
            // Send the payment to the actual taker.
            uint256 balance = IERC20(weth).balanceOf(address(this));
            if (unwrapWeth) {
                IWETH(weth).withdraw(balance);
                (success, ) = payable(msg.sender).call{value: balance}("");
                require(success, "Could not send payment");
            } else {
                IERC20(weth).transfer(msg.sender, balance);
            }
        }
    }

    function onERC721Received(
        address, // operator,
        address, // from
        uint256, // tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        if (data.length == 0) {
            return this.onERC721Received.selector;
        }

        bytes4 selector = bytes4(data[:4]);
        require(selector == this.genericERC721Fill.selector, "Wrong selector");

        (bool success, ) = address(this).call(data);
        require(success, "Unsuccessfull fill");

        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // tokenId
        uint256, // amount
        bytes calldata data
    ) external returns (bytes4) {
        if (data.length == 0) {
            return this.onERC1155Received.selector;
        }

        bytes4 selector = bytes4(data[:4]);
        require(selector == this.genericERC1155Fill.selector, "Wrong selector");

        (bool success, ) = address(this).call(data);
        require(success, "Unsuccessfull fill");

        return this.onERC1155Received.selector;
    }
}
