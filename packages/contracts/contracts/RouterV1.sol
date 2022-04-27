// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import {IRouterV1} from "./interfaces/IRouterV1.sol";
import {ILooksRare, ILooksRareTransferSelectorNFT} from "./interfaces/ILooksRare.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IWyvernV23, IWyvernV23ProxyRegistry} from "./interfaces/IWyvernV23.sol";

contract RouterV1 is IRouterV1, IERC721Receiver, IERC1155Receiver {
    address public immutable weth;

    address public immutable looksRare;
    address public immutable looksRareTransferManagerERC721;
    address public immutable looksRareTransferManagerERC1155;

    address public immutable wyvernV23;
    address public immutable wyvernV23Proxy;

    constructor(
        address wethAddress,
        address looksRareAddress,
        address wyvernV23Address
    ) {
        weth = wethAddress;

        // --- LooksRare setup ---

        looksRare = looksRareAddress;

        // Cache the transfer contracts
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
    }

    receive() external payable {
        // For unwrapping WETH
    }

    function fillWyvernV23(
        address, // referrer
        bytes memory data
    ) public payable override {
        // TODO: Optimize for gas efficiency.

        (bool success, ) = wyvernV23.call{value: msg.value}(data);
        require(success, "Unsuccessfull fill");
    }

    function fillLooksRare(
        address, // referrer
        bytes memory data,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) public payable override {
        // TODO: Optimize for gas efficiency.

        (bool success, ) = looksRare.call{value: msg.value}(data);
        require(success, "Unsuccessfull fill");

        // Need to send the NFT to the actual taker.
        if (IERC165(collection).supportsInterface(0x80ac58cd)) {
            IERC721(collection).transferFrom(
                address(this),
                msg.sender,
                tokenId
            );
        } else if (IERC165(collection).supportsInterface(0xd9b67a26)) {
            IERC1155(collection).safeTransferFrom(
                address(this),
                msg.sender,
                tokenId,
                amount,
                ""
            );
        } else {
            revert("Unsupported NFT");
        }
    }

    function onERC721Received(
        address taker,
        address, // from
        uint256, // tokenId,
        bytes calldata fillData
    ) external returns (bytes4) {
        if (fillData.length == 0) {
            return 0x00000000;
        }

        // Execute the fill
        bool success;
        bytes4 selector = bytes4(fillData[:4]);
        if (selector == IRouterV1.fillWyvernV23.selector) {
            bool isApproved = IERC721(msg.sender).isApprovedForAll(
                address(this),
                wyvernV23Proxy
            );
            if (!isApproved) {
                IERC721(msg.sender).setApprovalForAll(wyvernV23Proxy, true);
            }

            (success, ) = address(this).call(fillData);
        } else if (selector == IRouterV1.fillLooksRare.selector) {
            bool isApproved = IERC721(msg.sender).isApprovedForAll(
                address(this),
                looksRareTransferManagerERC721
            );
            if (!isApproved) {
                IERC721(msg.sender).setApprovalForAll(
                    looksRareTransferManagerERC721,
                    true
                );
            }

            (success, ) = address(this).call(fillData);
        }
        require(success, "Unsuccessfull fill");

        // Send received payment to the actual taker
        uint256 balance = IERC20(weth).balanceOf(address(this));
        IWETH(weth).withdraw(balance);
        (success, ) = taker.call{value: balance}("");
        require(success, "Could not send payment");

        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata fillData
    ) external pure returns (bytes4) {
        if (fillData.length == 0) {
            return 0x00000000;
        }

        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        // Batch transfers not supported
        return 0x00000000;
    }

    function supportsInterface(bytes4) external pure returns (bool) {
        return false;
    }
}
