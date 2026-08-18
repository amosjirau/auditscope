// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Intentionally unverified implementation for the controlled PARTIAL fixture.
contract IncompleteVault {
    address public owner;
    uint256 public value;

    function initialize(address initialOwner) external {
        require(owner == address(0), "already initialized");
        owner = initialOwner;
    }

    function version() external pure returns (uint256) {
        return 99;
    }
}
