import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, optimism, arbitrum, bscTestnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Hobos Forever DApp",
  projectId: "88f8bb315447d2c0da385180bf346909", // Replace with your WalletConnect Project ID
  chains: [mainnet, polygon, optimism, arbitrum, bscTestnet],
});
