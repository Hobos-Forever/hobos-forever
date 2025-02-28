// pages/api/updateImage.ts

import type { NextApiRequest, NextApiResponse } from "next";
import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_PATH || '.env.local' });
import { Client } from "basic-ftp";
import fetch from "node-fetch";
import sharp from "sharp";
import { createPublicClient, http, Abi } from "viem";
import { bscTestnet } from "viem/chains";
import nftAbi from "../../abi/nftAbi.json";
import { PassThrough } from "stream";

// Environment variables (make sure these are in your .env.local at the project root)
const FTP_HOST = process.env.FTP_HOST!;
const FTP_USER = process.env.FTP_USER!;
const FTP_PASS = process.env.FTP_PASS!;
const FTP_IMAGES_DIR = process.env.FTP_IMAGES_DIR!; // e.g. "/images/composite"
const METADATA_SERVER_URL = process.env.METADATA_SERVER_URL!; // e.g. "https://meta.cryptosquaries.com/metadata/"
const FTP_METADATA_DIR = process.env.FTP_METADATA_DIR!; // e.g. "/metadata/"
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

// NFT contract address
const NFT_CONTRACT = "0x343d3c584cFA02AB2fa4dbed2c495000ab8Ee7CF";

// Create a public client.
const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(),
});

// The order of trait layers (categories) is assumed to match your contract.
const TRAIT_CATEGORIES = ["Background", "Body", "Eyes", "Mouth", "Earring", "Hair"];

// Composite image dimensions.
const IMAGE_WIDTH = 2000;
const IMAGE_HEIGHT = 2000;

// Helper: get the local file path for a trait image using the trait id.
// The file path format is: ./images/traits/${nftType}/${category}/${traitId}.png
function getTraitImageUrl(category: string, traitId: number, nftType: string): string {
  // Ensure there's exactly one slash between BASE_URL and the rest.
  return `${BASE_URL}/images/traits/${nftType}/${category.toLowerCase()}/${traitId}.png`;
}

// Helper: fetch on-chain traits from the contract.
async function fetchNFTOnChainTraits(nftId: number): Promise<number[]> {
  try {
    console.log(`Fetching on-chain traits for tokenId ${nftId}...`);
    const result = await publicClient.readContract({
      address: NFT_CONTRACT as `0x${string}`,
      abi: nftAbi as Abi,
      functionName: "getTraitsOnNFT",
      args: [BigInt(nftId)],
    });
    console.log("Raw on-chain traits:", result);
    return Array.isArray(result) ? result.map((x: any) => Number(x)) : [];
  } catch (err) {
    console.error("Error fetching on-chain traits:", err);
    return new Array(TRAIT_CATEGORIES.length).fill(-1);
  }
}

// API route handler.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { tokenId } = req.body;
  if (!tokenId) {
    return res.status(400).json({ error: "Missing tokenId" });
  }
  console.log("Updating composite image for tokenId:", tokenId);
  try {
    // 1. Fetch updated metadata.
    const metadataUrl = `${METADATA_SERVER_URL}${FTP_METADATA_DIR}${tokenId}.json`;
    console.log("Fetching metadata from:", metadataUrl);
    const metaResp = await fetch(metadataUrl);
    if (!metaResp.ok) {
      throw new Error(`Failed to fetch metadata for tokenId ${tokenId}`);
    }
    const metadata = await metaResp.json();
    console.log("Fetched metadata:", metadata);

    // 2. Determine NFT type from metadata (defaulting to "Hobo").
    const nftType = metadata.collectionType || "Hobo";
    console.log("NFT Type:", nftType);

    // 3. Fetch on-chain traits from the contract.
    const onChainTraits = await fetchNFTOnChainTraits(tokenId);
    console.log("On-chain traits (converted):", onChainTraits);

    // 4. Build overlays: For each trait category, if the trait id is >= 0, load the corresponding image.
    const overlays: sharp.OverlayOptions[] = [];
    for (let i = 0; i < TRAIT_CATEGORIES.length; i++) {
      const category = TRAIT_CATEGORIES[i];
      const traitId = onChainTraits[i];
      if (traitId >= 0) {
        const imageUrl = getTraitImageUrl(category, traitId, nftType);
        console.log(`Fetching overlay for ${category} from: ${imageUrl}`);
        try {
          const imageResp = await fetch(imageUrl);
          if (!imageResp.ok) {
            throw new Error(`Failed to fetch image from ${imageUrl}`);
          }
          const imageBuffer = Buffer.from(await imageResp.arrayBuffer());
          const overlayBuffer = await sharp(imageBuffer)
          .resize(IMAGE_WIDTH, IMAGE_HEIGHT)
          .png()
          .toBuffer();
        overlays.push({ input: overlayBuffer, top: 0, left: 0 });
        } catch (err) {
          console.error(`Error loading image for ${category} from ${imageUrl}:`, err);
        }
      } else {
        console.log(`Skipping ${category} as traitId is -1.`);
      }
    }
    if (overlays.length === 0) {
      throw new Error("No trait overlays available to composite image.");
    }

    // 5. Create composite image using sharp.
    const base = sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png();
    const compositeBuffer = await base.composite(overlays).png().toBuffer();
    console.log("Composite image created.");

    // 6. Upload composite image via FTP (using same login process as updateMetadata).
    const client: any = new Client(); // Cast to any to bypass TS issues.
    client.verbose = true;
    try {
      await client.access({
        host: process.env.FTP_HOST!,
        user: process.env.FTP_USER!,
        password: process.env.FTP_PASS!,
        secure: false, // Use false if your server does not support secure connections.
      });
      console.log("Connected to FTP.");
      const remoteDir = process.env.FTP_IMAGES_DIR;
      const remoteFilePath = `${remoteDir}${tokenId}.png`;
      await client.ensureDir(remoteDir);
      const stream = new PassThrough();
      stream.end(compositeBuffer);
      await client.uploadFrom(stream as any, remoteFilePath);
      console.log("Composite image uploaded successfully.");
    } catch (ftpErr) {
      console.error("FTP image upload error:", ftpErr);
      return res.status(500).json({ error: "FTP upload failed", details: (ftpErr as Error).toString() });
    } finally {
      client.close();
    }
    res.status(200).json({ message: "Composite image updated successfully" });
  } catch (error) {
    console.error("Error updating composite image:", error);
    res.status(500).json({ error: "Error updating composite image", details: (error as Error).toString() });
  }
}