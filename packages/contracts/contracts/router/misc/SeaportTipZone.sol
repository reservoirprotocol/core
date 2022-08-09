// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ISeaport} from "../interfaces/ISeaport.sol";

// One way to stay approval-less is to use one-time Seaport orders
// that effectively act as a tip. These are prone to front-running
// though. To prevent this, all tip orders should enforce that the
// offerer matches the transaction sender (eg. `tx.origin`).
contract SeaportTipZone {
    // --- Errors ---

    error Unauthorized();

    // --- Seaport `ZoneInterface` overrides ---

    function isValidOrder(
        bytes32,
        address,
        address offerer,
        bytes32
    ) external view returns (bytes4 validOrderMagicValue) {
        if (offerer != tx.origin) {
            revert Unauthorized();
        }

        validOrderMagicValue = this.isValidOrder.selector;
    }

    function isValidOrderIncludingExtraData(
        bytes32,
        address,
        ISeaport.AdvancedOrder calldata order,
        bytes32[] calldata,
        ISeaport.CriteriaResolver[] calldata
    ) external view returns (bytes4 validOrderMagicValue) {
        if (order.parameters.offerer != tx.origin) {
            revert Unauthorized();
        }

        validOrderMagicValue = this.isValidOrder.selector;
    }
}
