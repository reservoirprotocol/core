// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IWETH} from "./interfaces/IWETH.sol";

import {IFoundation} from "./interfaces/IFoundation.sol";
import {ILooksRare, ILooksRareTransferSelectorNFT} from "./interfaces/ILooksRare.sol";
import {IWyvernV23, IWyvernV23ProxyRegistry} from "./interfaces/IWyvernV23.sol";
import {IZeroExV4} from "./interfaces/IZeroExV4.sol";

contract ReservoirV5 is Ownable, ReentrancyGuard {
    address public immutable weth;

    address public immutable foundation;
    address public immutable looksRare;
    address public immutable seaport;
    address public immutable wyvernV23;
    address public immutable x2y2;
    address public immutable zeroExV4;

    mapping(bytes32 => bytes4) public selectors;

    mapping(address => address) public erc721Operators;
    mapping(address => address) public erc1155Operators;

    error UnexpectedFill();
    error UnexpectedOwnerOrBalance();
    error UnsuccessfulCall();
    error UnsuccessfulFill();
    error UnsuccessfulPayment();

    constructor(
        address wethAddress,
        address looksRareAddress,
        address wyvernV23Address,
        address zeroExV4Address,
        address foundationAddress,
        address x2y2Address,
        address x2y2ERC721DelegateAddress,
        address seaportAddress
    ) {
        weth = wethAddress;

        // --- LooksRare setup ---

        looksRare = looksRareAddress;

        address transferSelectorNFT = ILooksRare(looksRare)
            .transferSelectorNFT();
        erc721Operators[looksRare] = ILooksRareTransferSelectorNFT(
            transferSelectorNFT
        ).TRANSFER_MANAGER_ERC721();
        erc1155Operators[looksRare] = ILooksRareTransferSelectorNFT(
            transferSelectorNFT
        ).TRANSFER_MANAGER_ERC1155();

        // Supports: single listing fill (ERC721 + ERC1155)
        registerSelector(
            looksRare,
            ReservoirV5.singleERC721ListingFill.selector,
            ILooksRare.matchAskWithTakerBidUsingETHAndWETH.selector
        );
        registerSelector(
            looksRare,
            ReservoirV5.singleERC1155ListingFill.selector,
            ILooksRare.matchAskWithTakerBidUsingETHAndWETH.selector
        );
        // Supports: single bid fill (ERC721 + ERC1155)
        registerSelector(
            looksRare,
            ReservoirV5.singleERC721BidFill.selector,
            ILooksRare.matchBidWithTakerAsk.selector
        );
        registerSelector(
            looksRare,
            ReservoirV5.singleERC1155BidFill.selector,
            ILooksRare.matchBidWithTakerAsk.selector
        );

        // --- WyvernV23 setup ---

        wyvernV23 = wyvernV23Address;

        address proxyRegistry = IWyvernV23(wyvernV23).registry();
        IWyvernV23ProxyRegistry(proxyRegistry).registerProxy();

        address wyvernV23Proxy = IWyvernV23ProxyRegistry(proxyRegistry).proxies(
            address(this)
        );
        erc721Operators[wyvernV23] = wyvernV23Proxy;
        erc1155Operators[wyvernV23] = wyvernV23Proxy;

        // Approve the token transfer proxy
        IERC20(weth).approve(
            IWyvernV23(wyvernV23).tokenTransferProxy(),
            type(uint256).max
        );

        // Supports: single listing fill (ERC721 + ERC1155)
        registerSelector(
            wyvernV23,
            ReservoirV5.singleERC721ListingFill.selector,
            IWyvernV23.atomicMatch_.selector
        );
        registerSelector(
            wyvernV23,
            ReservoirV5.singleERC1155ListingFill.selector,
            IWyvernV23.atomicMatch_.selector
        );
        // Supports: single bid fill (ERC721 + ERC1155)
        registerSelector(
            wyvernV23,
            ReservoirV5.singleERC721BidFill.selector,
            IWyvernV23.atomicMatch_.selector
        );
        registerSelector(
            wyvernV23,
            ReservoirV5.singleERC1155BidFill.selector,
            IWyvernV23.atomicMatch_.selector
        );

        // --- ZeroExV4 setup ---

        zeroExV4 = zeroExV4Address;

        erc721Operators[zeroExV4] = zeroExV4;
        erc1155Operators[zeroExV4] = zeroExV4;

        // Supports: single + batch listing fill (ERC721 + ERC1155)
        registerSelector(
            zeroExV4,
            ReservoirV5.singleERC721ListingFill.selector,
            IZeroExV4.buyERC721.selector
        );
        registerSelector(
            zeroExV4,
            ReservoirV5.singleERC1155ListingFill.selector,
            IZeroExV4.buyERC1155.selector
        );
        registerSelector(
            zeroExV4,
            ReservoirV5.batchERC721ListingFill.selector,
            IZeroExV4.batchBuyERC721s.selector
        );
        registerSelector(
            zeroExV4,
            ReservoirV5.batchERC1155ListingFill.selector,
            IZeroExV4.batchBuyERC1155s.selector
        );
        // Supports: single bid fill (ERC721 + ERC1155)
        registerSelector(
            zeroExV4,
            ReservoirV5.singleERC721BidFill.selector,
            IWyvernV23.atomicMatch_.selector
        );
        registerSelector(
            wyvernV23,
            ReservoirV5.singleERC1155BidFill.selector,
            IWyvernV23.atomicMatch_.selector
        );

        // --- Foundation setup ---

        foundation = foundationAddress;

        // Supports: single listing fill (ERC721)
        registerSelector(
            foundation,
            ReservoirV5.singleERC721ListingFill.selector,
            IFoundation.buyV2.selector
        );

        // --- X2Y2 setup ---

        x2y2 = x2y2Address;

        erc721Operators[x2y2] = x2y2ERC721DelegateAddress;

        // Supports: single listing fill (ERC721)
        registerSelector(
            foundation,
            ReservoirV5.singleERC721ListingFill.selector,
            IFoundation.buyV2.selector
        );
        // Supports: single bid fill (ERC721)
        registerSelector(
            foundation,
            ReservoirV5.singleERC721ListingFill.selector,
            IFoundation.buyV2.selector
        );

        // --- Seaport setup ---

        seaport = seaportAddress;

        erc721Operators[seaport] = seaport;
        erc1155Operators[seaport] = seaport;

        // Approve the exchange
        IERC20(weth).approve(seaport, type(uint256).max);
    }

    function registerSelector(
        address target,
        bytes4 ourSelector,
        bytes4 theirSelector
    ) internal {
        selectors[
            keccak256(abi.encodePacked(target, ourSelector))
        ] = theirSelector;
    }

    modifier supportsSelector(
        address target,
        bytes4 ourSelector,
        bytes4 theirSelector
    ) {
        if (
            selectors[keccak256(abi.encodePacked(target, ourSelector))] !=
            theirSelector
        ) {
            revert UnexpectedFill();
        }

        _;
    }

    receive() external payable {
        // For unwrapping WETH
    }

    function makeCalls(
        address[] calldata targets,
        bytes[] calldata data,
        uint256[] calldata values
    ) external payable onlyOwner nonReentrant {
        bool success;

        uint256 length = targets.length;
        for (uint256 i = 0; i < length; ) {
            (success, ) = payable(targets[i]).call{value: values[i]}(data[i]);
            if (!success) {
                revert UnsuccessfulCall();
            }

            unchecked {
                ++i;
            }
        }
    }

    // Terminology:
    // - "single" -> buy single token
    // - "batch" -> buy multiple tokens (natively, only 0xv4 and Seaport support this)
    // - "multi" -> buy multiple tokens (via the router)

    function singleERC721ListingFill(
        address referrer,
        uint16 referrerFeeBps,
        address target,
        bytes calldata data,
        address collection,
        uint256 tokenId,
        address receiver
    ) external payable nonReentrant {
        if (
            selectors[
                keccak256(
                    abi.encodePacked(
                        target,
                        this.singleERC721ListingFill.selector
                    )
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        uint256 payment = (10000 * msg.value) / (10000 + referrerFeeBps);

        (bool success, ) = target.call{value: payment}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        if (target != seaport && target != wyvernV23) {
            // When filling anything other than Wyvern or Seaport we need to send
            // the NFT to the taker's wallet after the fill (since we cannot have
            // a recipient other than the taker)
            IERC721(collection).safeTransferFrom(
                address(this),
                receiver,
                tokenId
            );
        }

        uint256 fee = msg.value - payment;
        if (fee > 0) {
            (success, ) = payable(referrer).call{value: fee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function singleERC721ListingFillWithPrecheck(
        address referrer,
        uint16 referrerFeeBps,
        address target,
        bytes calldata data,
        address collection,
        uint256 tokenId,
        address receiver,
        address expectedOwner
    ) external payable nonReentrant {
        if (
            expectedOwner != address(0) &&
            IERC721(collection).ownerOf(tokenId) != expectedOwner
        ) {
            revert UnexpectedOwnerOrBalance();
        }

        if (
            selectors[
                keccak256(
                    abi.encodePacked(
                        target,
                        // Reuse the non-precheck method selector
                        this.singleERC721ListingFill.selector
                    )
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        uint256 payment = (10000 * msg.value) / (10000 + referrerFeeBps);

        (bool success, ) = target.call{value: payment}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        if (target != seaport && target != wyvernV23) {
            // When filling anything other than Wyvern or Seaport we need to send
            // the NFT to the taker's wallet after the fill (since we cannot have
            // a recipient other than the taker)
            IERC721(collection).safeTransferFrom(
                address(this),
                receiver,
                tokenId
            );
        }

        uint256 fee = msg.value - payment;
        if (fee > 0) {
            (success, ) = payable(referrer).call{value: fee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function batchERC721ListingFill(
        address referrer,
        uint16 referrerFeeBps,
        address target,
        bytes calldata data,
        address[] calldata collections,
        uint256[] calldata tokenIds,
        address receiver
    ) external payable nonReentrant {
        if (
            selectors[
                keccak256(
                    abi.encodePacked(
                        target,
                        this.batchERC721ListingFill.selector
                    )
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        uint256 payment = (10000 * msg.value) / (10000 + referrerFeeBps);

        (bool success, ) = target.call{value: payment}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        if (target != seaport) {
            // When filling anything other than Wyvern or Seaport we need to send
            // the NFT to the taker's wallet after the fill (since we cannot have
            // a recipient other than the taker)
            uint256 length = collections.length;
            for (uint256 i = 0; i < length; ) {
                IERC721(collections[i]).safeTransferFrom(
                    address(this),
                    receiver,
                    tokenIds[i]
                );

                unchecked {
                    ++i;
                }
            }
        }

        uint256 fee = msg.value - payment;
        if (fee > 0) {
            (success, ) = payable(referrer).call{value: fee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function singleERC721BidFill(
        address, // referrer
        address target,
        bytes calldata data,
        address collection,
        address receiver,
        bool unwrapWeth
    ) external payable nonReentrant {
        if (
            selectors[
                keccak256(
                    abi.encodePacked(target, this.singleERC721BidFill.selector)
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        address operator = erc721Operators[target];

        // Approve the exchange to transfer the NFT out of the router
        bool isApproved = IERC721(collection).isApprovedForAll(
            address(this),
            operator
        );
        if (!isApproved) {
            IERC721(collection).setApprovalForAll(operator, true);
        }

        (bool success, ) = target.call{value: msg.value}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        // Send the payment to the actual taker
        uint256 balance = IERC20(weth).balanceOf(address(this));
        if (unwrapWeth) {
            IWETH(weth).withdraw(balance);

            (success, ) = payable(receiver).call{value: balance}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        } else {
            IERC20(weth).transfer(receiver, balance);
        }
    }

    function singleERC1155ListingFill(
        address referrer,
        uint16 referrerFeeBps,
        address target,
        bytes calldata data,
        address collection,
        uint256 tokenId,
        uint256 amount,
        address receiver
    ) external payable nonReentrant {
        if (
            selectors[
                keccak256(
                    abi.encodePacked(
                        target,
                        this.singleERC1155ListingFill.selector
                    )
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        uint256 payment = (10000 * msg.value) / (10000 + referrerFeeBps);

        (bool success, ) = target.call{value: payment}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        if (target != seaport && target != wyvernV23) {
            // When filling anything other than Wyvern or Seaport we need to send
            // the NFT to the taker's wallet after the fill (since we cannot have
            // a recipient other than the taker)
            IERC1155(collection).safeTransferFrom(
                address(this),
                receiver,
                tokenId,
                amount,
                ""
            );
        }

        uint256 fee = msg.value - payment;
        if (fee > 0) {
            (success, ) = payable(referrer).call{value: fee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function singleERC1155ListingFillWithPrecheck(
        address referrer,
        uint16 referrerFeeBps,
        address target,
        bytes calldata data,
        address collection,
        uint256 tokenId,
        uint256 amount,
        address receiver,
        address expectedOwner
    ) external payable nonReentrant {
        if (
            expectedOwner != address(0) &&
            IERC1155(collection).balanceOf(expectedOwner, tokenId) < amount
        ) {
            revert UnexpectedOwnerOrBalance();
        }

        if (
            selectors[
                keccak256(
                    abi.encodePacked(
                        target,
                        // Reuse the non-precheck method selector
                        this.singleERC1155ListingFill.selector
                    )
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        uint256 payment = (10000 * msg.value) / (10000 + referrerFeeBps);

        (bool success, ) = target.call{value: payment}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        if (target != seaport && target != wyvernV23) {
            // When filling anything other than Wyvern or Seaport we need to send
            // the NFT to the taker's wallet after the fill (since we cannot have
            // a recipient other than the taker)
            IERC1155(collection).safeTransferFrom(
                address(this),
                receiver,
                tokenId,
                amount,
                ""
            );
        }

        uint256 fee = msg.value - payment;
        if (fee > 0) {
            (success, ) = payable(referrer).call{value: fee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function batchERC1155ListingFill(
        address referrer,
        uint16 referrerFeeBps,
        address target,
        bytes calldata data,
        address[] calldata collections,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        address receiver
    ) external payable nonReentrant {
        if (
            selectors[
                keccak256(
                    abi.encodePacked(
                        target,
                        this.batchERC1155ListingFill.selector
                    )
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        uint256 payment = (10000 * msg.value) / (10000 + referrerFeeBps);

        (bool success, ) = target.call{value: payment}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        if (target != seaport) {
            // When filling anything other than Wyvern or Seaport we need to send
            // the NFT to the taker's wallet after the fill (since we cannot have
            // a recipient other than the taker)
            uint256 length = collections.length;
            for (uint256 i = 0; i < length; ) {
                IERC1155(collections[i]).safeTransferFrom(
                    address(this),
                    receiver,
                    tokenIds[i],
                    amounts[i],
                    ""
                );

                unchecked {
                    ++i;
                }
            }
        }

        uint256 fee = msg.value - payment;
        if (fee > 0) {
            (success, ) = payable(referrer).call{value: fee}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        }
    }

    function singleERC1155BidFill(
        address, // referrer
        address target,
        bytes calldata data,
        address collection,
        address receiver,
        bool unwrapWeth
    ) external payable nonReentrant {
        if (
            selectors[
                keccak256(
                    abi.encodePacked(target, this.singleERC1155BidFill.selector)
                )
            ] != bytes4(data[:4])
        ) {
            revert UnexpectedFill();
        }

        address operator = erc1155Operators[target];

        // Approve the exchange to transfer the NFT out of the router
        bool isApproved = IERC1155(collection).isApprovedForAll(
            address(this),
            operator
        );
        if (!isApproved) {
            IERC1155(collection).setApprovalForAll(operator, true);
        }

        (bool success, ) = target.call{value: msg.value}(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        // Send the payment to the actual taker
        uint256 balance = IERC20(weth).balanceOf(address(this));
        if (unwrapWeth) {
            IWETH(weth).withdraw(balance);

            (success, ) = payable(receiver).call{value: balance}("");
            if (!success) {
                revert UnsuccessfulPayment();
            }
        } else {
            IERC20(weth).transfer(receiver, balance);
        }
    }

    function multiListingFill(
        bytes[] calldata data,
        uint256[] calldata values,
        bool revertIfIncomplete
    ) external payable {
        bool success;

        uint256 length = data.length;
        for (uint256 i = 0; i < length; ) {
            (success, ) = address(this).call{value: values[i]}(data[i]);
            if (revertIfIncomplete) {
                revert UnsuccessfulFill();
            }

            unchecked {
                ++i;
            }
        }

        (success, ) = msg.sender.call{value: address(this).balance}("");
        if (!success) {
            revert UnsuccessfulPayment();
        }
    }

    // ERC721 / ERC1155 overrides

    function onERC721Received(
        address, // operator,
        address, // from
        uint256, // tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        if (data.length == 0) {
            return this.onERC721Received.selector;
        }

        bytes4 selector = bytes4(data[:4]);
        if (selector != this.singleERC721BidFill.selector) {
            revert UnexpectedFill();
        }

        (bool success, ) = address(this).call(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // tokenId
        uint256, // amount
        bytes calldata data
    ) external returns (bytes4) {
        if (data.length == 0) {
            return this.onERC1155Received.selector;
        }

        bytes4 selector = bytes4(data[:4]);
        if (selector != this.singleERC1155BidFill.selector) {
            revert UnexpectedFill();
        }

        (bool success, ) = address(this).call(data);
        if (!success) {
            revert UnsuccessfulFill();
        }

        return this.onERC1155Received.selector;
    }
}
