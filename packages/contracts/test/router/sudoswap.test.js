var chai = require('chai');
chai.use(require('chai-string'));

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sudoswap Test", function () {

    let Test721;
    let test721;

    let LinearCurve;
    let linearCurve;

    let LSSVMPairFactory;
    let factory;

    let LSSVMRouter;
    let router;

    let LSSVMPairEnumerableETH;
    let pair;

    let feeRecipient;

    let protocolFeeMultiplier;

    let addrX;
    let addrs;

    beforeEach(async function () {
        [addrX, ...addrs] = await ethers.getSigners();

        Test721 = await ethers.getContractFactory("Test721");
        test721 = await Test721.deploy();

        LinearCurve = await ethers.getContractFactory("LinearCurve");
        linearCurve = await LinearCurve.deploy();

        LSSVMPairEnumerableETH = await ethers.getContractFactory("LSSVMPairEnumerableETH");
        let enumerableETHTemplate = await LSSVMPairEnumerableETH.deploy();

        let LSSVMPairMissingEnumerableETH = await ethers.getContractFactory("LSSVMPairMissingEnumerableETH");
        let missingEnumerableETHTemplate = await LSSVMPairMissingEnumerableETH.deploy();

        let LSSVMPairEnumerableERC20 = await ethers.getContractFactory("LSSVMPairEnumerableERC20");
        let enumerableERC20Template = await LSSVMPairEnumerableERC20.deploy();

        let LSSVMPairMissingEnumerableERC20 = await ethers.getContractFactory("LSSVMPairMissingEnumerableERC20");
        let missingEnumerableERC20Template = await LSSVMPairMissingEnumerableERC20.deploy();

        feeRecipient = addrs[0].address; // _change me_ "0x0000000000000000000000000000000000000000"
        protocolFeeMultiplier = ethers.BigNumber.from("3000000000000000");

        LSSVMPairFactory = await ethers.getContractFactory("LSSVMPairFactory");
        factory = await LSSVMPairFactory.deploy(
            enumerableETHTemplate.address,
            missingEnumerableETHTemplate.address,
            enumerableERC20Template.address,
            missingEnumerableERC20Template.address,
            feeRecipient,
            protocolFeeMultiplier
        );

        LSSVMRouter = await ethers.getContractFactory("LSSVMRouter");
        router = await LSSVMRouter.deploy(factory.address);

        factory.setBondingCurveAllowed(linearCurve.address, true);
        factory.setRouterAllowed(router.address, true);

        // set NFT approvals
        await test721.connect(addrs[0]).mint(addrs[0].address, 1);
        await test721.connect(addrs[0]).mint(addrs[0].address, 2);
        await test721.connect(addrs[0]).mint(addrs[0].address, 3);

        expect(await test721.ownerOf(1)).to.equal(addrs[0].address); 
        expect(await test721.ownerOf(2)).to.equal(addrs[0].address); 
        expect(await test721.ownerOf(3)).to.equal(addrs[0].address); 

        await test721.connect(addrs[0]).setApprovalForAll(factory.address, true);
        await test721.connect(addrs[0]).setApprovalForAll(router.address, true);

        /* * */
        const _idList = [1, 2, 3];
        /* * */

        let _assetRecipient = addrs[0].address; // The address that will receive the TOKEN or NFT sent to this pair during swaps. 
                                                // NOTE: If set to address(0), they will go to the pair itself.

        let txnCreatePairETH = await factory.connect(addrs[0]).createPairETH(
            test721.address,
            linearCurve.address,
            _assetRecipient,
            1, //poolType
            ethers.utils.parseEther("0.1"), //delta
            0, //fee
            ethers.utils.parseEther("0.1"), //spotPrice
            _idList, //_idList
            { value: ethers.utils.parseEther("10") }
        );

        let outputCreatePairETH = await txnCreatePairETH.wait();
        let deployedContractAddress = "0x" + outputCreatePairETH.logs[8].data.slice(26, 66);
        expect(ethers.utils.isAddress(deployedContractAddress)).to.equal(true); 
        pair = LSSVMPairEnumerableETH.attach(deployedContractAddress);

        /* * */

        let MockERC20 = await ethers.getContractFactory("MockERC20");
        let wethAddress = await MockERC20.deploy();

        let transferManagerERC721 = addrs[0].address; //"0x0000000000000000000000000000000000000000";
        let transferManagerERC1155 = addrs[0].address; //"0x0000000000000000000000000000000000000000";
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
        let seaportAddress = "0x0000000000000000000000000000000000000000";

        ReservoirV5_0_0 = await ethers.getContractFactory("ReservoirV5_0_0");
        reservoirV5_0_0 = await ReservoirV5_0_0.deploy(
            wethAddress.address,
            looksRareAddress.address,
            wyvernV23Address.address,
            zeroExV4Address,//zeroExV4Address.address,
            foundationAddress,//foundationAddress.address,
            x2y2Address,//x2y2Address.address,
            x2y2ERC721DelegateAddress,//x2y2ERC721DelegateAddress.address,
            seaportAddress,//seaportAddress.address,
            router.address//sudoswap
        );
    });

    /** 
     * Swaps ETH into specific NFTs using multiple pairs
     */
    it("test 00: swapETHForSpecificNFTs", async function () {
        const FormatTypes = ethers.utils.FormatTypes;

        //sudoswap
        let abiSwapETHForSpecificNFTs = '[ { "inputs": [ { "components": [ { "internalType": "contract LSSVMPair", "name": "pair", "type": "address" }, { "internalType": "uint256[]", "name": "nftIds", "type": "uint256[]" } ], "internalType": "struct LSSVMRouter.PairSwapSpecific[]", "name": "swapList", "type": "tuple[]" }, { "internalType": "address payable", "name": "ethRecipient", "type": "address" }, { "internalType": "address", "name": "nftRecipient", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" } ], "name": "swapETHForSpecificNFTs", "outputs": [ { "internalType": "uint256", "name": "remainingValue", "type": "uint256" } ], "stateMutability": "payable", "type": "function" } ]';
        let intSwapETHForSpecificNFTs = new ethers.utils.Interface(abiSwapETHForSpecificNFTs);
        let sigSwapETHForSpecificNFTs = "swapETHForSpecificNFTs(tuple(address,uint256[])[],address,address,uint256)";

        let abiSingleERC721Listing = '[ { "inputs": [ { "internalType": "bytes", "name": "data", "type": "bytes" }, { "internalType": "enum ExchangeKind", "name": "exchangeKind", "type": "uint8" }, { "internalType": "address", "name": "collection", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "receiver", "type": "address" }, { "internalType": "address", "name": "expectedOwner", "type": "address" }, { "internalType": "address", "name": "feeRecipient", "type": "address" }, { "internalType": "uint16", "name": "feeBps", "type": "uint16" } ], "name": "singleERC721ListingFillWithPrecheck", "outputs": [], "stateMutability": "payable", "type": "function" } ]';
        let intSingleERC721Listing = new ethers.utils.Interface(abiSingleERC721Listing);
        let sigSingleERC721Listing = "singleERC721ListingFillWithPrecheck(bytes,uint8,address,uint256,address,address,address,uint16)";

        const abiMultiListingFill = '[ { "inputs": [ { "internalType": "bytes[]", "name": "data", "type": "bytes[]" }, { "internalType": "uint256[]", "name": "values", "type": "uint256[]" }, { "internalType": "bool", "name": "revertIfIncomplete", "type": "bool" } ], "name": "multiListingFill", "outputs": [], "stateMutability": "payable", "type": "function" } ]';
        const intMultiListingFill = new ethers.utils.Interface(abiMultiListingFill);
        const sigMultiListingFill = "multiListingFill(bytes[],uint256[],bool)";

        
        /* * */

        //PAIR ADDRESS!
        let swapList = [["0x7794C476806731b74ba2049ccd413218248135DA", [2756]]]; //The list of pairs to trade with and the IDs of the NFTs to buy from each.
        let ethRecipient = "0x0C19069F36594D93Adfa5794546A8D6A9C1b9e23"; //The address that will receive the unspent ETH input
        let nftRecipient = "0x0C19069F36594D93Adfa5794546A8D6A9C1b9e23"; //The address that will receive the NFT output
        let deadline = 1765023349;
        let parametersSwap00 = [swapList,ethRecipient,nftRecipient,deadline];
        //
        let swap00data = intSwapETHForSpecificNFTs.encodeFunctionData(sigSwapETHForSpecificNFTs,parametersSwap00);
        let list00exchangeKind = 1; //sudoswap
        let list00collection = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F";
        let list00tokenId = 2756;
        let list00receiver = "0x0C19069F36594D93Adfa5794546A8D6A9C1b9e23";
        let list00expectedOwner = "0x7794C476806731b74ba2049ccd413218248135DA";
        let list00feeRecipient = "0x0000000000000000000000000000000000000000";
        let list00feeBps = 0;
        let parametersList00 = [swap00data,list00exchangeKind,list00collection,list00tokenId,list00receiver,list00expectedOwner,list00feeRecipient,list00feeBps];
        //
        let list00data = intSingleERC721Listing.encodeFunctionData(sigSingleERC721Listing,parametersList00);

        /* * */

        let swap01data = "0xfb0f3ee10000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002e59a1b59900000000000000000000000000044cd6c3550fa47db39fbf8c7d3708833516500ba000000000000000000000000004c00500000ad104d7dbd00e3ae0a5c00560c00000000000000000000000000acd1423e1e7d45dd0f3ae63c5db959d49feadd3f0000000000000000000000000000000000000000000000000000000000000a900000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000632633ee00000000000000000000000000000000000000000000000000000000634dc0ee0000000000000000000000000000000000000000000000000000000000000000360c6ebe0000000000000000000000000000000000000000907a428979c60a020000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f00000000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f00000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000002e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000001476b081e8000000000000000000000000000000a26b00c1f0df003000390027140000faa7190000000000000000000000000000000000000000000000000000387ac870c80000000000000000000000000010197efc7fd03ab48ab38797532c9b7ded55a89e0000000000000000000000000000000000000000000000000000000000000041d81c9d5a23eb83b2188da3f193ce97c568502e6b0bcdb92d40ea090046401ec678535490b9685d91170f0fc57e80544ca8ca32f4b85d4959c6979561b1eb26831b00000000000000000000000000000000000000000000000000000000000000";
        let list01exchangeKind = 0; //seaport
        let list01collection = "0xaCd1423E1e7D45DD0F3AE63C5dB959D49FeADd3F";
        let list01tokenId = 2704;
        let list01receiver = "0x0C19069F36594D93Adfa5794546A8D6A9C1b9e23";
        let list01expectedOwner = "0x44Cd6C3550fA47dB39fbF8c7d3708833516500ba";
        let list01feeRecipient = "0x0000000000000000000000000000000000000000";
        let list01feeBps = 0;
        let parametersList01 = [swap01data,list01exchangeKind,list01collection,list01tokenId,list01receiver,list01expectedOwner,list01feeRecipient,list01feeBps];
        //
        let list01data = intSingleERC721Listing.encodeFunctionData(sigSingleERC721Listing,parametersList01);
        
        /* * */
    
        let parametersList0x = [[list00data,list01data],[ethers.utils.parseEther("0.002"),ethers.utils.parseEther("0.0009")],false];
        //
        let data0x = intMultiListingFill.encodeFunctionData(sigMultiListingFill,parametersList0x);

        console.log("/* * */");
        console.log("/* * */");
        console.log("/* * */");
        console.log(data0x);
        console.log("/* * */");
        console.log("/* * */");
        console.log("/* * */");

    });
  
});