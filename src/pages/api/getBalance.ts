import { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, formatEther } from 'viem';
import { bscTestnet } from 'viem/chains';

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // Get balance from BSC Testnet
    const balance = await publicClient.getBalance({ address: `0x${address.replace(/^0x/, '')}` });
    res.status(200).json({ balance: formatEther(balance) });
  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
}
