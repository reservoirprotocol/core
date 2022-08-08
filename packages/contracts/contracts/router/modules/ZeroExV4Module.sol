// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

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
        ETHListingParams calldata params
    ) external payable nonReentrant refundETHLeftover(params.refundTo) {
        buyERC721(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    function acceptETHListingWithFeesERC721(
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
        ERC20ListingParams calldata params
    ) external nonReentrant refundERC20Leftover(params.refundTo, params.token) {
        IERC20(params.token).safeApprove(exchange, params.amount);
        buyERC721(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    function acceptERC20ListingWithFeesERC721(
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
            params.amount
        );
    }

    // --- [ERC1155] Single ETH listing ---

    function acceptETHListingERC1155(
        IZeroExV4.ERC1155Order calldata order,
        IZeroExV4.Signature calldata signature,
        ETHListingParams calldata params
    ) external payable nonReentrant refundETHLeftover(params.refundTo) {
        buyERC1155(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    function acceptETHListingWithFeesERC1155(
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
        ERC20ListingParams calldata params
    ) external nonReentrant refundERC20Leftover(params.refundTo, params.token) {
        IERC20(params.token).safeApprove(exchange, params.amount);
        buyERC1155(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    function acceptERC20ListingWithFeesERC1155(
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
            params.amount
        );
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
            try
                IERC721(order.erc721Token).safeTransferFrom(
                    address(this),
                    receiver,
                    order.erc721TokenId
                )
            {
                success = true;
            } catch {}
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
            try
                IERC1155(order.erc1155Token).safeTransferFrom(
                    address(this),
                    receiver,
                    order.erc1155TokenId,
                    1,
                    ""
                )
            {
                success = true;
            } catch {}
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

    // TODO: Add support for native batch-filling (via `buyERC721s` and `buyERC1155s`)
    // TODO: Add support for filling multiple ERC1155 tokens at once
}
