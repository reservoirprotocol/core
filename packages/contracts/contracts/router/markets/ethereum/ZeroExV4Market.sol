// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {BaseMarket} from "../BaseMarket.sol";
import {IZeroExV4} from "../interfaces/IZeroExV4.sol";

contract ZeroExV4Market is BaseMarket {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public immutable exchange =
        0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    address public immutable override erc721Operator =
        0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    address public immutable override erc1155Operator =
        0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    // --- Constructor ---

    constructor(address router) BaseMarket(router) {}

    // --- Fill listings ---

    function buyERC721(
        IZeroExV4.ERC721Order calldata order,
        IZeroExV4.Signature calldata signature,
        address receiver,
        bool revertIfIncomplete
    ) external payable nonReentrant refund {
        try
            IZeroExV4(exchange).buyERC721{value: msg.value}(
                order,
                signature,
                ""
            )
        {
            IERC721(order.erc721Token).safeTransferFrom(
                address(this),
                receiver,
                order.erc721TokenId
            );
        } catch {
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }
        }
    }

    function batchBuyERC721s(
        IZeroExV4.ERC721Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        address receiver,
        bool revertIfIncomplete
    ) external payable nonReentrant refund {
        uint256 length = orders.length;

        bool[] memory successes = IZeroExV4(exchange).batchBuyERC721s{
            value: msg.value
        }(orders, signatures, new bytes[](length), revertIfIncomplete);

        for (uint256 i = 0; i < length; ) {
            if (!successes[i] && revertIfIncomplete) {
                revert UnsuccessfulFill();
            } else if (successes[i]) {
                IERC721(orders[i].erc721Token).safeTransferFrom(
                    address(this),
                    receiver,
                    orders[i].erc721TokenId
                );
            }

            unchecked {
                ++i;
            }
        }
    }

    function buyERC1155(
        IZeroExV4.ERC1155Order calldata order,
        IZeroExV4.Signature calldata signature,
        uint128 amount,
        address receiver,
        bool revertIfIncomplete
    ) external payable nonReentrant refund {
        try
            IZeroExV4(exchange).buyERC1155{value: msg.value}(
                order,
                signature,
                amount,
                ""
            )
        {
            IERC1155(order.erc1155Token).safeTransferFrom(
                address(this),
                receiver,
                order.erc1155TokenId,
                amount,
                ""
            );
        } catch {
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }
        }
    }

    function buyERC1155s(
        IZeroExV4.ERC1155Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        uint128[] calldata amounts,
        address receiver,
        bool revertIfIncomplete
    ) external payable nonReentrant refund {
        uint256 length = orders.length;

        bool[] memory successes = IZeroExV4(exchange).batchBuyERC1155s{
            value: msg.value
        }(orders, signatures, amounts, new bytes[](length), revertIfIncomplete);

        for (uint256 i = 0; i < length; ) {
            if (!successes[i] && revertIfIncomplete) {
                revert UnsuccessfulFill();
            } else if (successes[i]) {
                IERC1155(orders[i].erc1155Token).safeTransferFrom(
                    address(this),
                    receiver,
                    orders[i].erc1155TokenId,
                    amounts[i],
                    ""
                );
            }

            unchecked {
                ++i;
            }
        }
    }

    // --- Fill bids ---

    function sellERC721(
        IZeroExV4.ERC721Order calldata order,
        IZeroExV4.Signature calldata signature,
        uint256 tokenId,
        address receiver,
        bool unwrapNativeToken
    ) external nonReentrant {
        IZeroExV4(exchange).sellERC721(
            order,
            signature,
            tokenId,
            unwrapNativeToken,
            ""
        );

        uint256 payment = order.erc20TokenAmount;
        if (unwrapNativeToken) {
            (bool success, ) = payable(receiver).call{value: payment}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        } else {
            IERC20(order.erc20Token).safeTransfer(receiver, payment);
        }
    }

    function sellERC1155(
        IZeroExV4.ERC1155Order calldata order,
        IZeroExV4.Signature calldata signature,
        uint256 tokenId,
        uint128 amount,
        address receiver,
        bool unwrapNativeToken
    ) external nonReentrant {
        IZeroExV4(exchange).sellERC1155(
            order,
            signature,
            tokenId,
            amount,
            unwrapNativeToken,
            ""
        );

        // Make sure to handle partial fills
        uint256 payment = (amount * order.erc20TokenAmount) /
            order.erc1155TokenAmount;
        if (unwrapNativeToken) {
            (bool success, ) = payable(receiver).call{value: payment}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        } else {
            IERC20(order.erc20Token).safeTransfer(receiver, payment);
        }
    }

    // --- ERC721 / ERC1155 hooks ---

    function onERC721Received(
        address, // operator,
        address, // from
        uint256, // tokenId,
        bytes calldata // data
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // tokenId
        uint256, // amount
        bytes calldata // data
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
