// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {ISeaport} from "../interfaces/ISeaport.sol";

// In order to prevent front-running, every tip order should enforce
// that the offerer matches the transaction's sender (`tx.origin`)
contract SeaportTipZone {
    // --- Errors ---

    error Unauthorized();

    // --- `ZoneInterface` overrides ---

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
