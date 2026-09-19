import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

const ANCHOR_ABI = parseAbi([
  "function anchor(bytes32 reportHash) external",
  "function isAnchored(bytes32 reportHash) external view returns (bool)",
  "event ReportAnchored(bytes32 indexed reportHash, address indexed anchoredBy, uint256 timestamp)",
]);

function getAnchorClients() {
  if (!ENV.anchorPrivateKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "ANCHOR_PRIVATE_KEY is not configured. Add it to your .env to enable on-chain anchoring.",
    });
  }
  if (!ENV.anchorContractAddress) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "ANCHOR_CONTRACT_ADDRESS is not configured. Deploy the contract first.",
    });
  }

  const rpcUrl = ENV.anchorRpcUrl || "https://rpc.sepolia.org";
  const account = privateKeyToAccount(ENV.anchorPrivateKey as `0x${string}`);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  const contractAddress = ENV.anchorContractAddress as `0x${string}`;

  return { publicClient, walletClient, account, contractAddress };
}

export async function anchorReportOnChain(payloadHash: string): Promise<{ txHash: string; explorerUrl: string }> {
  const { publicClient, walletClient, account, contractAddress } = getAnchorClients();

  // Convert hex string hash to bytes32 — pad to 32 bytes
  const hashBytes32 = `0x${payloadHash.padStart(64, "0")}` as `0x${string}`;

  // Check if already anchored
  const alreadyAnchored = await publicClient.readContract({
    address: contractAddress,
    abi: ANCHOR_ABI,
    functionName: "isAnchored",
    args: [hashBytes32],
  });

  if (alreadyAnchored) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This report hash has already been anchored on-chain.",
    });
  }

  // Simulate first to catch reverts early
  await publicClient.simulateContract({
    address: contractAddress,
    abi: ANCHOR_ABI,
    functionName: "anchor",
    args: [hashBytes32],
    account,
  });

  // Send transaction
  const txHash = await walletClient.writeContract({
    address: contractAddress,
    abi: ANCHOR_ABI,
    functionName: "anchor",
    args: [hashBytes32],
  });

  // Wait for 1 confirmation
  await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  return {
    txHash,
    explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
  };
}
