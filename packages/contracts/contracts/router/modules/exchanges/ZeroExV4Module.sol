// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {IZeroExV4} from "../../interfaces/IZeroExV4.sol";

// Notes on the ZeroExV4 module:
// - supports filling listings (both ERC721/ERC1155)
// - supports filling offers (both ERC721/ERC1155)

contract ZeroExV4Module is BaseExchangeModule {
    using SafeERC20 for IERC20;

    // --- Fields ---

    address public constant exchange =
        0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    // --- Constructor ---

    constructor(address owner) BaseModule(owner) {}

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
        approveERC20IfNeeded(params.token, exchange, params.amount);
        buyERC721(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );
    }

    // --- [ERC721] Multiple ETH listings ---

    function acceptETHListingsERC721(
        IZeroExV4.ERC721Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        buyERC721s(
            orders,
            signatures,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- [ERC721] Multiple ERC20 listings ---

    function acceptERC20ListingsERC721(
        IZeroExV4.ERC721Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        ERC20ListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundERC20Leftover(params.refundTo, params.token)
        chargeERC20Fees(fees, params.token, params.amount)
    {
        approveERC20IfNeeded(params.token, exchange, params.amount);
        buyERC721s(
            orders,
            signatures,
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
        approveERC20IfNeeded(params.token, exchange, params.amount);
        buyERC1155(
            order,
            signature,
            params.fillTo,
            params.revertIfIncomplete,
            0
        );
    }

    // --- [ERC1155] Multiple ETH listings ---

    function acceptETHListingsERC1155(
        IZeroExV4.ERC1155Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        buyERC1155s(
            orders,
            signatures,
            params.fillTo,
            params.revertIfIncomplete,
            params.amount
        );
    }

    // --- [ERC1155] Multiple ERC20 listings ---

    function acceptERC20ListingsERC1155(
        IZeroExV4.ERC1155Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        ERC20ListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundERC20Leftover(params.refundTo, params.token)
        chargeERC20Fees(fees, params.token, params.amount)
    {
        approveERC20IfNeeded(params.token, exchange, params.amount);
        buyERC1155s(
            orders,
            signatures,
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
        approveERC721IfNeeded(order.erc721Token, exchange);

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
                sendAllERC721(params.refundTo, nft.token, nft.id);
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
        approveERC1155IfNeeded(order.erc1155Token, exchange);

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
                sendAllERC1155(params.refundTo, nft.token, nft.id);
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

    function buyERC721s(
        IZeroExV4.ERC721Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        uint256 length = orders.length;

        bool success;
        try
            IZeroExV4(exchange).batchBuyERC721s{value: value}(
                orders,
                signatures,
                new bytes[](length),
                revertIfIncomplete
            )
        returns (bool[] memory fulfilled) {
            for (uint256 i = 0; i < length; ) {
                if (fulfilled[i]) {
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

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }

    function buyERC1155s(
        IZeroExV4.ERC1155Order[] calldata orders,
        IZeroExV4.Signature[] calldata signatures,
        address receiver,
        bool revertIfIncomplete,
        uint256 value
    ) internal {
        uint256 length = orders.length;

        uint128[] memory fillAmounts = new uint128[](length);
        for (uint256 i = 0; i < length; ) {
            fillAmounts[i] = 1;

            unchecked {
                ++i;
            }
        }

        bool success;
        try
            IZeroExV4(exchange).batchBuyERC1155s{value: value}(
                orders,
                signatures,
                fillAmounts,
                new bytes[](length),
                revertIfIncomplete
            )
        returns (bool[] memory fulfilled) {
            for (uint256 i = 0; i < length; ) {
                if (fulfilled[i]) {
                    IERC1155(orders[i].erc1155Token).safeTransferFrom(
                        address(this),
                        receiver,
                        orders[i].erc1155TokenId,
                        1,
                        ""
                    );
                }

                unchecked {
                    ++i;
                }
            }

            success = true;
        } catch {}

        if (revertIfIncomplete && !success) {
            revert UnsuccessfulFill();
        }
    }
}
