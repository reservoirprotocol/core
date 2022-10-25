// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {ISudoswapRouter} from "../../../interfaces/ISudoswapRouter.sol";

contract SudoswapModule is BaseExchangeModule {

    // --- Fields ---

    ISudoswapRouter public immutable SUDOSWAP_ROUTER;

    // --- Constructor ---

    constructor(address owner, address router, address sudoswap)
        BaseModule(owner)
        BaseExchangeModule(router) {

        SUDOSWAP_ROUTER = ISudoswapRouter(sudoswap);
    }

    // --- Fallback ---

    receive() external payable {}

    // --- Single ETH listing ---

    function swapETHForSpecificNFTs(
        ISudoswapRouter.PairSwapSpecific[] calldata swapList,
        uint256 deadline,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        nonReentrant
        refundETHLeftover(params.refundTo)
        chargeETHFees(fees, params.amount)
    {
        // Execute fill
        _buy(swapList, params.refundTo, params.fillTo, deadline, params.revertIfIncomplete, params.amount);
    }

    // --- Internal ---

    function _buy(
        ISudoswapRouter.PairSwapSpecific[] calldata swapList,
        address ethRecipient,
        address nftRecipient,
        uint256 deadline,
        bool revertIfIncomplete,
        uint256 value
    ) internal {

        uint256 remainingValue = 0;

        // Execute fill
        try SUDOSWAP_ROUTER.swapETHForSpecificNFTs{value: value}(swapList, payable(ethRecipient), nftRecipient, deadline) returns (uint256 _remainingValue) {
            remainingValue = _remainingValue;
        } catch {
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }
        }
        if (remainingValue > 0) {
            address remainingValueRecipient = payable(tx.origin); // TODO: parameterize? 
            _sendETH(remainingValueRecipient, remainingValue);
        }
    }
}