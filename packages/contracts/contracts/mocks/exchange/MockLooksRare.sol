// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITransferSelectorNFT {
    function checkTransferManagerForToken(address collection) external view returns (address);
}

contract MockLooksRare {

    ITransferSelectorNFT public transferSelectorNFT;

    function updateTransferSelectorNFT(address _transferSelectorNFT) external {
        transferSelectorNFT = ITransferSelectorNFT(_transferSelectorNFT);
    }

}

contract MockLooksRareSelector {

    // Address of the transfer manager contract for ERC721 tokens
    address public immutable TRANSFER_MANAGER_ERC721;

    // Address of the transfer manager contract for ERC1155 tokens
    address public immutable TRANSFER_MANAGER_ERC1155;

    constructor(address _transferManagerERC721, address _transferManagerERC1155) {
        TRANSFER_MANAGER_ERC721 = _transferManagerERC721;
        TRANSFER_MANAGER_ERC1155 = _transferManagerERC1155;
    }

}