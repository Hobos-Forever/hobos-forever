// pages/api/testGetTraits.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import nftAbi from "../../abi/nftAbi.json";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const tokenId = BigInt(2);
    const traits = await publicClient.readContract({
      address: "0x343d3c584cFA02AB2fa4dbed2c495000ab8Ee7CF",
      abi: nftAbi,
      functionName: "getTraitsOnNFT",
      args: [tokenId],
    });
    res.status(200).json({ traits });
  } catch (err) {
    res.status(500).json({ error: (err as Error).toString() });
  }
}