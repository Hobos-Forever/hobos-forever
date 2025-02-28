import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { AppProps } from 'next/app';
import { Toaster } from "react-hot-toast";
import { ChakraProvider } from "@chakra-ui/react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

import { config } from '../wagmi';
import GlobalMenu from '../components/GlobalMenu';

const client = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      
      <QueryClientProvider client={client}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#FF9900", // Button color
            accentColorForeground: "#0D0F1A", // Button text color
            borderRadius: "large", // Rounded corners
            overlayBlur: "small", // Slight blur effect
          })}
        >
          <ChakraProvider>
          <GlobalMenu /> {/* Ensure menu is inside providers */}
          <Toaster position="top-center" />
          <Component {...pageProps} />
          </ChakraProvider>
        </RainbowKitProvider>
      </QueryClientProvider>

    </WagmiProvider>
  );
}

export default MyApp;