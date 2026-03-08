// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TaxVault
 * @notice A vault for holding tax revenue.
 */
contract TaxVault is AccessControl {
    using SafeERC20 for IERC20;

    receive() external payable {}

    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant TAX_AUTHORITY_ROLE =
        keccak256("TAX_AUTHORITY_ROLE");

    event TaxWithdrawn(address indexed user, uint256 amount);
    event TaxReceived(address indexed token, uint256 amount);

    constructor(address _taxAuthority) {
        _grantRole(TAX_AUTHORITY_ROLE, _taxAuthority);
        // taxAuthority = _taxAuthority;
    }

    function withdrawTax(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external onlyRole(TREASURY_ROLE) {
        _token.safeTransfer(_to, _amount);
        emit TaxWithdrawn(_to, _amount);
    }

    function withdrawNative(
        address payable _to,
        uint256 _amount
    ) external onlyRole(TREASURY_ROLE) {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Transfer failed");
        emit TaxWithdrawn(_to, _amount);
    }
}
