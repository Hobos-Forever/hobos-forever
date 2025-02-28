import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { tokenId } = req.query;
    if (!tokenId) return res.status(400).json({ error: "Missing tokenId" });

    const metadataUrl = `https://meta.cryptosquaries.com/metadata/${tokenId}.json`;
    console.log(`Proxying request to: ${metadataUrl}`);

    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata for token ${tokenId}`);
    }

    const metadata = await response.json();
    return res.status(200).json(metadata);
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return res.status(500).json({ error: "Failed to fetch metadata" });
  }
}
