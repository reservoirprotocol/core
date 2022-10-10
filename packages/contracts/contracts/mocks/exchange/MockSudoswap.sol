// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

struct PairSwapSpecific {
    address pair;
    uint256[] nftIds;
}

contract MockSudoswap {

    bool invocationSuccess = false;

    /**
        @notice Swaps ETH into specific NFTs using multiple pairs.
        @param swapList The list of pairs to trade with and the IDs of the NFTs to buy from each.
        @param ethRecipient The address that will receive the unspent ETH input
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent ETH amount
     */
    function swapETHForSpecificNFTs(
        PairSwapSpecific[] calldata swapList,
        address payable ethRecipient,
        address nftRecipient,
        uint256 deadline
    )
        external
        payable
        returns (uint256 remainingValue)
    {
        invocationSuccess = true;
        return 1;
    }

    /** 
     */
    function getInvocationSuccess() public view returns (bool result) {
        return invocationSuccess;
    }
}
