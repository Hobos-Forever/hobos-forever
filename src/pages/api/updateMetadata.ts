// pages/api/updateMetadata.ts

import type { NextApiRequest, NextApiResponse } from "next";
import dotenv from "dotenv";
import { createPublicClient, http, Abi } from "viem";
import { bscTestnet } from "viem/chains";
import { Client } from "basic-ftp";
import { Readable } from "stream";
import fetch from "node-fetch";
import nftAbi from "../../abi/nftAbi.json";
import traitsAbi from "../../abi/traitsAbi.json";
dotenv.config({ path: process.env.ENV_PATH || '.env.local' });

// Dynamic trait categories – must match your front-end.
const TRAIT_CONTRACTS = [
    { name: "Background", address: "0x7534D85c6A9Ad06aB2b017629C43039015154b72" },
    { name: "Body", address: "0xd4EC8d99322e9c25aCCAB376e5c302bEAE63B9fC" },
    { name: "Eyes", address: "0x7Dc9C4283276E190bD5b8FD39deaB23DAA37cB75" },
    { name: "Mouth", address: "0xf17A1599a7BfFe157551386daaA651FcaDd5A2B2" },
    { name: "Earring", address: "0xfcE4203F40635F3Eb6Af2615eD7fF414637D607e" },
    { name: "Hair", address: "0x838f7622a232E6B260C0Df3b613643AD9c0F190C" },
];

const NFT_CONTRACT = "0x343d3c584cFA02AB2fa4dbed2c495000ab8Ee7CF";

// Create a public client.
const publicClient = createPublicClient({
    chain: bscTestnet,
    transport: http(),
});

// Helper: merge dynamic attributes with current metadata attributes.
function mergeDynamicAttributes(currentAttrs: any[], dynamicMap: Record<string, string>) {
    const updated = currentAttrs.map((attr) => {
        // If the attribute is one of the dynamic categories, update its value
        if (TRAIT_CONTRACTS.some((t) => t.name === attr.trait_type)) {
            // If a new value exists in dynamicMap, use it; otherwise, assign "none"
            return { ...attr, value: dynamicMap[attr.trait_type] !== undefined ? dynamicMap[attr.trait_type] : "none" };
        }
        return attr;
    });
    TRAIT_CONTRACTS.forEach(({ name }) => {
        if (!updated.some((attr) => attr.trait_type === name)) {
            // If no attribute exists for this category, add it with value from dynamicMap if available, else "none"
            updated.push({ trait_type: name, value: dynamicMap[name] !== undefined ? dynamicMap[name] : "none" });
        }
    });
    return updated;
}

// Helper function to fetch on-chain traits for an NFT.
// If the call fails, we fallback to an array of -1’s (one for each category).
async function fetchNFTOnChainTraits(nftId: number): Promise<number[]> {
    if (!publicClient) return new Array(TRAIT_CONTRACTS.length).fill(-1);
    try {
        const result = await publicClient.readContract({
            address: NFT_CONTRACT as `0x${string}`,
            abi: nftAbi as Abi,
            functionName: "getTraitsOnNFT",
            args: [BigInt(nftId)],
        });
        // Convert each element (likely a BigInt) to number.
        return (result as any).map((x: any) => Number(x));
    } catch (err) {
        console.error("Error fetching on-chain traits, using fallback:", err);
        return new Array(TRAIT_CONTRACTS.length).fill(-1);
    }
}

// API route handler.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const { tokenId, newName } = req.body;
    if (!tokenId) {
        res.status(400).json({ error: "Missing tokenId" });
        return;
    }
    console.log("Updating metadata for tokenId:", tokenId);
    try {
        // 1. Fetch existing metadata from your hosting URL.
        const metadataUrl = `${process.env.METADATA_SERVER_URL}${process.env.FTP_METADATA_DIR}${tokenId}.json`;
        let currentMetadata: any = {
            name: `Hobos Forever #${tokenId}`,
            image: `${process.env.METADATA_SERVER_URL}images/composite/${tokenId}.png`,
            description: "A dynamic NFT that evolves with on-chain traits and a dynamic XP attribute.",
            attributes: [
            {
                "trait_type": "Set status",
                "value": "1 of 5"
            },
            {
                "trait_type": "XP",
                "value": 100
            }
            ],
        };
        try {
            const resp = await fetch(metadataUrl);
            if (resp.ok) {
                currentMetadata = await resp.json();
                console.log("Fetched metadata:", currentMetadata);
            } else {
                console.log("No metadata found, using defaults.");
            }
        } catch (e) {
            console.error("Error fetching metadata:", e);
        }

        // 2. Read on-chain traits using getTraitsOnNFT.
        const onChainTraits = await fetchNFTOnChainTraits(tokenId);
        console.log("On-chain traits (converted):", onChainTraits);

        // 3. Build a dynamic map from trait category to trait name.
        const dynamicMap: Record<string, string> = {};
        for (let i = 0; i < TRAIT_CONTRACTS.length; i++) {
            const category = TRAIT_CONTRACTS[i].name;
            const traitContractAddress = TRAIT_CONTRACTS[i].address;
            const traitId = onChainTraits[i];
            if (traitId >= 0) {
                try {
                    const item = (await publicClient.readContract({
                        address: traitContractAddress as `0x${string}`,
                        abi: traitsAbi as Abi,
                        functionName: "attributeItems",
                        args: [traitId],
                    })) as any;
                    // Assume the returned tuple has the trait name at index 1.
                    const traitName = Array.isArray(item) ? item[1] : item.name;
                    dynamicMap[category] = traitName;
                    console.log(`Category ${category} (traitId ${traitId}) -> ${traitName}`);
                } catch (err) {
                    console.error(`Error fetching attributeItems for traitId ${traitId} in category ${category}:`, err);
                }
            } else {
                console.log(`Category ${category} has no trait assigned (value: ${traitId}).`);
            }
        }
        console.log("Dynamic map:", dynamicMap);

        // 4. Merge dynamic attributes with current metadata attributes.
        const updatedAttributes = mergeDynamicAttributes(currentMetadata.attributes, dynamicMap);
        console.log("Updated attributes:", updatedAttributes);

        // 5. Build updated metadata.
        const newMetadata = {
            ...currentMetadata,
            name: newName && newName.trim() !== "" ? `${newName} #${tokenId}` : `Hobos Forever #${tokenId}`,
            image: `${process.env.METADATA_SERVER_URL}images/composite/${tokenId}.png`,
            attributes: updatedAttributes,
        };
        console.log("New metadata:", newMetadata);
        const metadataString = JSON.stringify(newMetadata, null, 2);

        // 6. Connect via FTP and upload updated metadata.
        const client: any = new Client(); // Cast to any to bypass TS issues.
        try {
            await client.access({
                host: process.env.FTP_HOST!,
                user: process.env.FTP_USER!,
                password: process.env.FTP_PASS!,
                secure: false, // Set to false if your server does not support secure connections
            });
            console.log("Connected to FTP.");
            const stream = Readable.from([metadataString]);
            const remoteDir = process.env.FTP_METADATA_DIR;
            const remoteFilePath = `${remoteDir}/${tokenId}.json`;
            await client.ensureDir(remoteDir);
            await client.uploadFrom(stream as any, remoteFilePath);
            console.log("FTP upload successful.");
        } catch (ftpErr) {
            console.error("FTP upload error:", ftpErr);
            res.status(500).json({ error: "FTP upload failed", details: (ftpErr as Error).toString() });
            return;
        } finally {
            client.close();
        }
        try {
            const baseUrl = process.env.BASE_URL || "http://localhost:3000";
            const updateImageRes = await fetch(`${baseUrl}/api/updateImage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tokenId }),
            });
            if (!updateImageRes.ok) {
                console.error("updateImage API error:", await updateImageRes.text());
            } else {
                console.log("updateImage API success:", await updateImageRes.json());
            }
        } catch (err) {
            console.error("Error calling updateImage API:", err);
        }
        
        res.status(200).json({ message: "Metadata updated successfully", metadata: newMetadata });
    } catch (err) {
        console.error("Error updating metadata:", err);
        res.status(500).json({ error: "Error updating metadata", details: (err as Error).toString() });
    }
}
