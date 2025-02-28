import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, optimism, arbitrum, bscTestnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Hobos Forever DApp",
  projectId: "YOUR_PROJECT_ID", // Replace with your WalletConnect Project ID
  chains: [mainnet, polygon, optimism, arbitrum, bscTestnet],
});