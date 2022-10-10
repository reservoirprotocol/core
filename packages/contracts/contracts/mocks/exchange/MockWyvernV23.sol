// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MockWyvernV23 {

    /* User registry. */
    MockWyvernV23Proxy public registry;

    address public tokenTransferProxy;

    function initialize(MockWyvernV23Proxy addrRegistry, address _tokenTransferProxy) public {
        registry = addrRegistry;
        tokenTransferProxy = _tokenTransferProxy; 
    }

}

contract MockWyvernV23Proxy {

    /* Authenticated proxies by user. */
    mapping(address => address) public proxies;

    function setProxy(address user, address proxy) public {
        proxies[user] = proxy;
    }

    function registerProxy() public returns (address) {
        proxies[address(msg.sender)] = address(this);
        return address(this);
    }

}