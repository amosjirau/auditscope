// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Synthetic UUPS implementation used only for AuditScope live validation.
contract Vault {
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    address public owner;
    uint256 public value;

    function initialize(address initialOwner) external {
        require(owner == address(0), "already initialized");
        owner = initialOwner;
    }

    function setValue(uint256 nextValue) external {
        require(msg.sender == owner, "not owner");
        value = nextValue;
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function upgradeToAndCall(address nextImplementation, bytes calldata data) external payable {
        require(msg.sender == owner, "not owner");
        assembly {
            sstore(IMPLEMENTATION_SLOT, nextImplementation)
        }
        if (data.length > 0) {
            (bool success, bytes memory reason) = nextImplementation.delegatecall(data);
            if (!success) assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
    }
}
