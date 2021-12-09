// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./libraries/BytesUtils.sol";

contract TokenRangeVerifier {
    using BytesUtils for bytes;

    function verifyErc721(bytes memory callData) public pure {
        // `callData` byte decomposition:
        // - 4 bytes: `transferFrom(address,address,uint256)` function selector
        // - 32 bytes: `address from`
        // - 32 bytes: `address to`
        // - 32 bytes: `uint256 tokenId`
        // - 32 bytes: `uint256 startTokenId`
        // - 32 bytes: `uint256 endTokenId`

        uint256 tokenId = abi.decode(callData.slice(68, 32), (uint256));
        (uint256 startTokenId, uint256 endTokenId) = abi.decode(
            callData.slice(100, 64),
            (uint256, uint256)
        );

        require(
            startTokenId <= tokenId && tokenId <= endTokenId,
            "Invalid token"
        );
    }
}
