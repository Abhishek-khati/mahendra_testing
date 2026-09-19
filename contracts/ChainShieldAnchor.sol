// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChainShieldAnchor
/// @notice Stores SHA-256 report hashes on-chain with a timestamp.
///         Anyone can verify a report hash by calling anchors(hash).
///         No source code or private data is ever stored here.
contract ChainShieldAnchor {
    /// @notice Maps a report hash to the block timestamp when it was anchored
    mapping(bytes32 => uint256) public anchors;

    /// @notice Emitted when a report is anchored
    event ReportAnchored(bytes32 indexed reportHash, address indexed anchoredBy, uint256 timestamp);

    /// @notice Anchor a report hash on-chain. Reverts if already anchored.
    /// @param reportHash The SHA-256 hash of the report JSON, as bytes32
    function anchor(bytes32 reportHash) external {
        require(anchors[reportHash] == 0, "Already anchored");
        anchors[reportHash] = block.timestamp;
        emit ReportAnchored(reportHash, msg.sender, block.timestamp);
    }

    /// @notice Returns true if the given hash has been anchored
    function isAnchored(bytes32 reportHash) external view returns (bool) {
        return anchors[reportHash] != 0;
    }
}
