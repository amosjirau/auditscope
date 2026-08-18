// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal ERC-1967 proxy used only for AuditScope live validation.
contract AuditScopeProxy {
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address implementation, bytes memory initializationCall) payable {
        assembly {
            sstore(IMPLEMENTATION_SLOT, implementation)
        }
        if (initializationCall.length > 0) {
            (bool success, bytes memory reason) = implementation.delegatecall(initializationCall);
            if (!success) assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
    }

    fallback() external payable {
        _delegate();
    }

    receive() external payable {
        _delegate();
    }

    function _delegate() private {
        assembly {
            let implementation := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
