// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {BaseExchangeModule} from "./BaseExchangeModule.sol";
import {BaseModule} from "../BaseModule.sol";
import {ISudoswapRouter} from "../../../interfaces/ISudoswapRouter.sol";

import "hardhat/console.sol";

contract SudoswapModule is BaseExchangeModule {

    // --- Fields ---

    ISudoswapRouter public constant SUDOSWAP_ROUTER = 
        ISudoswapRouter(0x2B2e8cDA09bBA9660dCA5cB6233787738Ad68329);

    // --- Constructor ---

    constructor(address owner)
        BaseModule(owner)
        BaseExchangeModule(router) {
    }

    // --- Fallback ---

    receive() external payable {}

    // --- Single ETH listing ---
    function sayHelloWorld(uint256 value) public payable returns (string memory) {

        console.log("value 0x: %s", value);

        return "Hello World";
    }

    function swapETHForSpecificNFTs(
        ISudoswapRouter.PairSwapSpecific[] calldata swapList,
        uint256 deadline,
        ETHListingParams calldata params,
        Fee[] calldata fees
    )
        external
        payable
        //nonReentrant
        //refundETHLeftover(params.refundTo)
        //chargeETHFees(fees, params.amount)
    {

        console.log("Transferring...");

        // Execute fill
        //_buy(swapList, params.refundTo, params.fillTo, deadline, params.revertIfIncomplete, params.amount);
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

        //uint256 remainingValue = 0;

        console.log("Transferring from %s to %s %s tokens", msg.sender, nftRecipient, ethRecipient);

        // Execute fill
        try SUDOSWAP_ROUTER.swapETHForSpecificNFTs{value: value}(swapList, payable(ethRecipient), nftRecipient, deadline) { //returns (uint256 _remainingValue) {
            //remainingValue = _remainingValue;
        } catch {
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }
        }
        //if (remainingValue > 0) {
            //address remainingValueRecipient = payable(ethRecipient); 
            //_sendETH(remainingValueRecipient, remainingValue);
        //}
    }
}