// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ILooksRare {
    function transferSelectorNFT() external view returns (address);
}

interface ILooksRareTransferSelectorNFT {
    function TRANSFER_MANAGER_ERC721() external view returns (address);

    function TRANSFER_MANAGER_ERC1155() external view returns (address);
}
