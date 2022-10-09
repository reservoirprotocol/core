// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

struct PairSwapSpecific {
    address pair;
    uint256[] nftIds;
}

struct PairSwapAny {
    address pair;
    uint256 numItems;
}

struct RobustPairSwapAny {
    PairSwapAny swapInfo;
    uint256 maxCost;
}

struct RobustPairSwapSpecific {
    PairSwapSpecific swapInfo;
    uint256 maxCost;
}

struct RobustPairSwapSpecificForToken {
    PairSwapSpecific swapInfo;
    uint256 minOutput;
}

struct NFTsForAnyNFTsTrade {
    PairSwapSpecific[] nftToTokenTrades;
    PairSwapAny[] tokenToNFTTrades;
}

struct NFTsForSpecificNFTsTrade {
    PairSwapSpecific[] nftToTokenTrades;
    PairSwapSpecific[] tokenToNFTTrades;
}

struct RobustPairNFTsFoTokenAndTokenforNFTsTrade {
    RobustPairSwapSpecific[] tokenToNFTTrades;
    RobustPairSwapSpecificForToken[] nftToTokenTrades;
    uint256 inputAmount;
    address payable tokenRecipient;
    address nftRecipient;
}

interface ISudoswap {

    /**
        ETH swaps
     */

    /**
        @notice Swaps ETH into NFTs using multiple pairs.
        @param swapList The list of pairs to trade with and the number of NFTs to buy from each.
        @param ethRecipient The address that will receive the unspent ETH input
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent ETH amount
     */
    function swapETHForAnyNFTs(
        PairSwapAny[] calldata swapList,
        address payable ethRecipient,
        address nftRecipient,
        uint256 deadline
    )
        external
        payable
        returns (uint256 remainingValue);

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
        returns (uint256 remainingValue);

    /**
        @notice Swaps one set of NFTs into another set of specific NFTs using multiple pairs, using
        ETH as the intermediary.
        @param trade The struct containing all NFT-to-ETH swaps and ETH-to-NFT swaps.
        @param minOutput The minimum acceptable total excess ETH received
        @param ethRecipient The address that will receive the ETH output
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return outputAmount The total ETH received
     */
    function swapNFTsForAnyNFTsThroughETH(
        NFTsForAnyNFTsTrade calldata trade,
        uint256 minOutput,
        address payable ethRecipient,
        address nftRecipient,
        uint256 deadline
    ) external payable returns (uint256 outputAmount);

    /**
        @notice Swaps one set of NFTs into another set of specific NFTs using multiple pairs, using
        ETH as the intermediary.
        @param trade The struct containing all NFT-to-ETH swaps and ETH-to-NFT swaps.
        @param minOutput The minimum acceptable total excess ETH received
        @param ethRecipient The address that will receive the ETH output
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return outputAmount The total ETH received
     */
    function swapNFTsForSpecificNFTsThroughETH(
        NFTsForSpecificNFTsTrade calldata trade,
        uint256 minOutput,
        address payable ethRecipient,
        address nftRecipient,
        uint256 deadline
    ) external payable returns (uint256 outputAmount);

    /**
        ERC20 swaps

        Note: All ERC20 swaps assume that a single ERC20 token is used for all the pairs involved.
        Swapping using multiple tokens in the same transaction is possible, but the slippage checks
        & the return values will be meaningless, and may lead to undefined behavior.

        Note: The sender should ideally grant infinite token approval to the router in order for NFT-to-NFT
        swaps to work smoothly.
     */

    /**
        @notice Swaps ERC20 tokens into NFTs using multiple pairs.
        @param swapList The list of pairs to trade with and the number of NFTs to buy from each.
        @param inputAmount The amount of ERC20 tokens to add to the ERC20-to-NFT swaps
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent token amount
     */
    function swapERC20ForAnyNFTs(
        PairSwapAny[] calldata swapList,
        uint256 inputAmount,
        address nftRecipient,
        uint256 deadline
    ) external returns (uint256 remainingValue);

    /**
        @notice Swaps ERC20 tokens into specific NFTs using multiple pairs.
        @param swapList The list of pairs to trade with and the IDs of the NFTs to buy from each.
        @param inputAmount The amount of ERC20 tokens to add to the ERC20-to-NFT swaps
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent token amount
     */
    function swapERC20ForSpecificNFTs(
        PairSwapSpecific[] calldata swapList,
        uint256 inputAmount,
        address nftRecipient,
        uint256 deadline
    ) external returns (uint256 remainingValue);

    /**
        @notice Swaps NFTs into ETH/ERC20 using multiple pairs.
        @param swapList The list of pairs to trade with and the IDs of the NFTs to sell to each.
        @param minOutput The minimum acceptable total tokens received
        @param tokenRecipient The address that will receive the token output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return outputAmount The total tokens received
     */
    function swapNFTsForToken(
        PairSwapSpecific[] calldata swapList,
        uint256 minOutput,
        address tokenRecipient,
        uint256 deadline
    ) external returns (uint256 outputAmount);

    /**
        @notice Swaps one set of NFTs into another set of specific NFTs using multiple pairs, using
        an ERC20 token as the intermediary.
        @param trade The struct containing all NFT-to-ERC20 swaps and ERC20-to-NFT swaps.
        @param inputAmount The amount of ERC20 tokens to add to the ERC20-to-NFT swaps
        @param minOutput The minimum acceptable total excess tokens received
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return outputAmount The total ERC20 tokens received
     */
    function swapNFTsForAnyNFTsThroughERC20(
        NFTsForAnyNFTsTrade calldata trade,
        uint256 inputAmount,
        uint256 minOutput,
        address nftRecipient,
        uint256 deadline
    ) external returns (uint256 outputAmount);

    /**
        @notice Swaps one set of NFTs into another set of specific NFTs using multiple pairs, using
        an ERC20 token as the intermediary.
        @param trade The struct containing all NFT-to-ERC20 swaps and ERC20-to-NFT swaps.
        @param inputAmount The amount of ERC20 tokens to add to the ERC20-to-NFT swaps
        @param minOutput The minimum acceptable total excess tokens received
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return outputAmount The total ERC20 tokens received
     */
    function swapNFTsForSpecificNFTsThroughERC20(
        NFTsForSpecificNFTsTrade calldata trade,
        uint256 inputAmount,
        uint256 minOutput,
        address nftRecipient,
        uint256 deadline
    ) external returns (uint256 outputAmount);

    /**
        Robust Swaps
        These are "robust" versions of the NFT<>Token swap functions which will never revert due to slippage
        Instead, users specify a per-swap max cost. If the price changes more than the user specifies, no swap is attempted. This allows users to specify a batch of swaps, and execute as many of them as possible.
     */

    /**
        @dev We assume msg.value >= sum of values in maxCostPerPair
        @notice Swaps as much ETH for any NFTs as possible, respecting the per-swap max cost.
        @param swapList The list of pairs to trade with and the number of NFTs to buy from each.
        @param ethRecipient The address that will receive the unspent ETH input
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent token amount
     */
    function robustSwapETHForAnyNFTs(
        RobustPairSwapAny[] calldata swapList,
        address payable ethRecipient,
        address nftRecipient,
        uint256 deadline
    )
        external
        payable
        returns (uint256 remainingValue);

    /**
        @dev We assume msg.value >= sum of values in maxCostPerPair
        @param swapList The list of pairs to trade with and the IDs of the NFTs to buy from each.
        @param ethRecipient The address that will receive the unspent ETH input
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent token amount
     */
    function robustSwapETHForSpecificNFTs(
        RobustPairSwapSpecific[] calldata swapList,
        address payable ethRecipient,
        address nftRecipient,
        uint256 deadline
    )
        external
        payable
        returns (uint256 remainingValue);


    /**
        @notice Swaps as many ERC20 tokens for any NFTs as possible, respecting the per-swap max cost.
        @param swapList The list of pairs to trade with and the number of NFTs to buy from each.
        @param inputAmount The amount of ERC20 tokens to add to the ERC20-to-NFT swaps
        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent token amount

     */
    function robustSwapERC20ForAnyNFTs(
        RobustPairSwapAny[] calldata swapList,
        uint256 inputAmount,
        address nftRecipient,
        uint256 deadline
    )
        external
        returns (uint256 remainingValue);

    /**
        @notice Swaps as many ERC20 tokens for specific NFTs as possible, respecting the per-swap max cost.
        @param swapList The list of pairs to trade with and the IDs of the NFTs to buy from each.
        @param inputAmount The amount of ERC20 tokens to add to the ERC20-to-NFT swaps

        @param nftRecipient The address that will receive the NFT output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return remainingValue The unspent token amount
     */
    function robustSwapERC20ForSpecificNFTs(
        RobustPairSwapSpecific[] calldata swapList,
        uint256 inputAmount,
        address nftRecipient,
        uint256 deadline
    ) external returns (uint256 remainingValue);

    /**
        @notice Swaps as many NFTs for tokens as possible, respecting the per-swap min output
        @param swapList The list of pairs to trade with and the IDs of the NFTs to sell to each.
        @param tokenRecipient The address that will receive the token output
        @param deadline The Unix timestamp (in seconds) at/after which the swap will revert
        @return outputAmount The total ETH/ERC20 received
     */
    function robustSwapNFTsForToken(
        RobustPairSwapSpecificForToken[] calldata swapList,
        address payable tokenRecipient,
        uint256 deadline
    ) external returns (uint256 outputAmount);

    /**
        @notice Buys NFTs with ETH and sells them for tokens in one transaction
        @param params All the parameters for the swap (packed in struct to avoid stack too deep), containing:
        - ethToNFTSwapList The list of NFTs to buy
        - nftToTokenSwapList The list of NFTs to sell
        - inputAmount The max amount of tokens to send (if ERC20)
        - tokenRecipient The address that receives tokens from the NFTs sold
        - nftRecipient The address that receives NFTs
        - deadline UNIX timestamp deadline for the swap
     */
    function robustSwapETHForSpecificNFTsAndNFTsToToken(
        RobustPairNFTsFoTokenAndTokenforNFTsTrade calldata params
    )
        external
        payable
        returns (uint256 remainingValue, uint256 outputAmount);

    /**
        @notice Buys NFTs with ERC20, and sells them for tokens in one transaction
        @param params All the parameters for the swap (packed in struct to avoid stack too deep), containing:
        - ethToNFTSwapList The list of NFTs to buy
        - nftToTokenSwapList The list of NFTs to sell
        - inputAmount The max amount of tokens to send (if ERC20)
        - tokenRecipient The address that receives tokens from the NFTs sold
        - nftRecipient The address that receives NFTs
        - deadline UNIX timestamp deadline for the swap
     */
    function robustSwapERC20ForSpecificNFTsAndNFTsToToken(
        RobustPairNFTsFoTokenAndTokenforNFTsTrade calldata params
    )
        external
        payable
        returns (uint256 remainingValue, uint256 outputAmount);

}