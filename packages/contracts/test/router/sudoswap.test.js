var chai = require('chai');

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sudoswap Test", function () {

    let Test721;
    let test721;

    let sudoswapMock;

    let addrX;
    let addrs;

    beforeEach(async function () {
        [addrX, ...addrs] = await ethers.getSigners();

        Test721 = await ethers.getContractFactory("MockERC721");
        test721 = await Test721.deploy();

        // set NFT approvals
        await test721.connect(addrs[0]).mint(1);
        await test721.connect(addrs[0]).mint(2);
        await test721.connect(addrs[0]).mint(3);

        let transferManagerERC721 = addrs[0].address;
        let transferManagerERC1155 = addrs[0].address;
        let MockLooksRareSelector = await ethers.getContractFactory("MockLooksRareSelector");
        let transferSelectorNFT = await MockLooksRareSelector.deploy(
            transferManagerERC721,
            transferManagerERC1155
        );
        let MockLooksRare = await ethers.getContractFactory("MockLooksRare");
        let looksRareAddress = await MockLooksRare.deploy();
        looksRareAddress.updateTransferSelectorNFT(transferSelectorNFT.address);
        
        let MockWyvernV23Proxy = await ethers.getContractFactory("MockWyvernV23Proxy");
        let mockWyvernV23Proxy = await MockWyvernV23Proxy.deploy();
        
        let MockWyvernV23 = await ethers.getContractFactory("MockWyvernV23");
        let wyvernV23Address = await MockWyvernV23.deploy();
        wyvernV23Address.initialize(mockWyvernV23Proxy.address, mockWyvernV23Proxy.address);
        
        let zeroExV4Address = "0x0000000000000000000000000000000000000000";
        let foundationAddress = "0x0000000000000000000000000000000000000000";
        let x2y2Address = "0x0000000000000000000000000000000000000000";
        let x2y2ERC721DelegateAddress = "0x0000000000000000000000000000000000000000";
        let seaportAddress = "0x00000000000000000000000000000000DeaDBeef";

        let MockERC20 = await ethers.getContractFactory("MockERC20");
        let wethAddress = await MockERC20.deploy();

        let MockSudoswap = await ethers.getContractFactory("MockSudoswap");
        sudoswapMock = await MockSudoswap.deploy();

        ReservoirV5_0_0 = await ethers.getContractFactory("ReservoirV5_0_0");
        reservoirV5_0_0 = await ReservoirV5_0_0.deploy(
            wethAddress.address,
            looksRareAddress.address,
            wyvernV23Address.address,
            zeroExV4Address,
            foundationAddress,
            x2y2Address,
            x2y2ERC721DelegateAddress,
            seaportAddress,
            sudoswapMock.address
        );
    });

    /** 
     * Swaps ETH into specific NFT
     */
    it("test 00: singleERC721ListingFillWithPrecheck", async function () {

        //sudoswap
        let abiSwapETHForSpecificNFTs = '[ { "inputs": [ { "components": [ { "internalType": "contract LSSVMPair", "name": "pair", "type": "address" }, { "internalType": "uint256[]", "name": "nftIds", "type": "uint256[]" } ], "internalType": "struct LSSVMRouter.PairSwapSpecific[]", "name": "swapList", "type": "tuple[]" }, { "internalType": "address payable", "name": "ethRecipient", "type": "address" }, { "internalType": "address", "name": "nftRecipient", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" } ], "name": "swapETHForSpecificNFTs", "outputs": [ { "internalType": "uint256", "name": "remainingValue", "type": "uint256" } ], "stateMutability": "payable", "type": "function" } ]';
        let intSwapETHForSpecificNFTs = new ethers.utils.Interface(abiSwapETHForSpecificNFTs);
        let sigSwapETHForSpecificNFTs = "swapETHForSpecificNFTs(tuple(address,uint256[])[],address,address,uint256)";

        let pairAddress = "0x7794C476806731b74ba2049ccd413218248135DA";
        let swapList = [[pairAddress, [1]]]; //The list of pairs to trade with and the IDs of the NFTs to buy from each.
        let ethRecipient = "0x0C19069F36594D93Adfa5794546A8D6A9C1b9e23"; //The address that will receive the unspent ETH input
        let nftRecipient = "0x0C19069F36594D93Adfa5794546A8D6A9C1b9e23"; //The address that will receive the NFT output
        let deadline = 1765023349;
        let parametersSwap00 = [swapList,ethRecipient,nftRecipient,deadline];
        
        let swap00data = intSwapETHForSpecificNFTs.encodeFunctionData(sigSwapETHForSpecificNFTs,parametersSwap00);
        let list00exchangeKind = 6; //sudoswap
        let list00collection = test721.address;
        let list00tokenId = 1;
        let list00receiver = "0x0C19069F36594D93Adfa5794546A8D6A9C1b9e23";
        let list00expectedOwner = addrs[0].address;
        let list00feeRecipient = "0x0000000000000000000000000000000000000000";
        let list00feeBps = 0;
        
        await reservoirV5_0_0.connect(addrs[0]).singleERC721ListingFillWithPrecheck(
            swap00data,
            list00exchangeKind,
            list00collection,
            list00tokenId,
            list00receiver,
            list00expectedOwner,
            list00feeRecipient,
            list00feeBps,
            { value: ethers.utils.parseEther("10") }
        );

        let invocationSuccess = await sudoswapMock.getInvocationSuccess();
        expect(invocationSuccess).to.equal(true);
    });
  
});