// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseModule} from "./BaseModule.sol";
import {IZeroExV4} from "../interfaces/IZeroExV4.sol";

contract ZeroExV4Module is BaseModule {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public immutable exchange =
        0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    // --- Constructor ---

    constructor(address router) BaseModule(router) {}

    // --- [ERC721] Single ETH listing ---

    function acceptETHListingERC721(
        IZeroExV4.ERC721Order calldata order,
        IZeroExV4.Signature calldata signature,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        buyERC721(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- [ERC721] Single ERC20 listing ---

    function acceptERC20ListingERC721(
        IZeroExV4.ERC721Order calldata order,
        IZeroExV4.Signature calldata signature,
        ERC20ListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundERC20Leftover(params.refundTo, params.token)
        chargeERC20Fees(fees, params.token, params.amount)
    {
        IERC20(params.token).safeApprove(exchange, params.amount);
        buyERC721(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );
    }

    // --- [ERC1155] Single ETH listing ---

    function acceptETHListingERC1155(
        IZeroExV4.ERC1155Order calldata order,
        IZeroExV4.Signature calldata signature,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        buyERC1155(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- [ERC1155] Single ERC20 listing ---

    function acceptERC20ListingERC1155(
        IZeroExV4.ERC1155Order calldata order,
        IZeroExV4.Signature calldata signature,
        ERC20ListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundERC20Leftover(params.refundTo, params.token)
        chargeERC20Fees(fees, params.token, params.amount)
    {
        IERC20(params.token).safeApprove(exchange, params.amount);
        buyERC1155(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );
    }

    // --- [ERC721] Single offer ---

    function acceptERC721Offer(
        IZeroExV4.ERC721Order calldata order,
        IZeroExV4.Signature calldata signature,
        OfferParams calldata params,
        NFT calldata nft
    ) external nonReentrant {
        bool isApproved = IERC721(order.erc721Token).isApprovedForAll(
            address(this),
            exchange
        );
        if (!isApproved) {
            IERC721(order.erc721Token).setApprovalForAll(exchange, true);
        }

        bool success;
        try
            IZeroExV4(exchange).sellERC721(order, signature, nft.id, false, "")
        {
            IERC20(order.erc20Token).safeTransfer(
                params.fillTo,
                order.erc20TokenAmount
            );

            success = true;
        } catch {}

        if (!success) {
            if (params.revertIfIncomplete) {
                revert UnsuccessfulFill();
            } else {
                // Refund
                if (IERC721(nft.token).ownerOf(nft.id) == address(this)) {
                    IERC721(nft.token).safeTransferFrom(
                        address(this),
                        params.refundTo,
                        nft.id
                    );
                }
            }
        }
    }

    // --- [ERC1155] Single offer ---

    function acceptERC1155Offer(
        IZeroExV4.ERC1155Order calldata order,
        IZeroExV4.Signature calldata signature,
        OfferParams calldata params,
        NFT calldata nft
    ) external nonReentrant {
        bool isApproved = IERC1155(order.erc1155Token).isApprovedForAll(
            address(this),
            exchange
        );
        if (!isApproved) {
            IERC1155(order.erc1155Token).setApprovalForAll(exchange, true);
        }

        bool success;
        try
            IZeroExV4(exchange).sellERC1155(
                order,
                signature,
                nft.id,
                1,
                false,
                ""
            )
        {
            IERC20(order.erc20Token).safeTransfer(
                params.fillTo,
                order.erc20TokenAmount
            );

            success = true;
        } catch {}

        if (!success) {
            if (params.revertIfIncomplete) {
                revert UnsuccessfulFill();
            } else {
                // Refund
                uint256 balance = IERC1155(nft.token).balanceOf(
                    address(this),
                    nft.id
                );
                if (balance > 0) {
                    IERC1155(nft.token).safeTransferFrom(
                        address(this),
                        params.refundTo,
                        nft.id,
                        balance,
                        ""
                    );
                }
            }
        }
    }

    // --- Internal ---

    function buyERC721(
        IZeroExV4.ERC721Order calldata order,
        IZeroExV4.Signature calldata signature,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        bool success;
        try IZeroExV4(exchange).buyERC721{value: value}(order, signature, "") {
            IERC721(order.erc721Token).safeTransferFrom(
                address(this),
                receiver,
                order.erc721TokenId
            );

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }

    function buyERC1155(
        IZeroExV4.ERC1155Order calldata order,
        IZeroExV4.Signature calldata signature,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        bool success;
        try
            IZeroExV4(exchange).buyERC1155{value: value}(
                order,
                signature,
                1,
                ""
            )
        {
            IERC1155(order.erc1155Token).safeTransferFrom(
                address(this),
                receiver,
                order.erc1155TokenId,
                1,
                ""
            );

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
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
