"use client"

import { useState, useEffect } from "react"
import { useAccount, useWriteContract, useReadContract, useChainId } from "wagmi"
import { formatEther, parseEther } from "viem"
import contractAbi from "../abi/nftAbi.json"
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Progress,
  useToast,
  Card,
  CardBody,
  Badge,
  AspectRatio,
  ChakraProvider,
  extendTheme,
} from "@chakra-ui/react"
import Image from "next/image"

// Contract Constants
const CONTRACT_ADDRESS = "0x343d3c584cFA02AB2fa4dbed2c495000ab8Ee7CF"
const EXPECTED_CHAIN_ID = 97
const DEFAULT_WALLET_LIMIT = 5

// Custom theme to match original styling
const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: "#121212",
        color: "white",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: "600",
      },
      variants: {
        solid: {
          bg: "#3182ce",
          color: "white",
          _hover: {
            bg: "#2b6cb0",
          },
        },
        outline: {
          borderColor: "#3182ce",
          color: "#3182ce",
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: "#1A1A1A",
          borderRadius: "xl",
        },
      },
    },
    NumberInput: {
      baseStyle: {
        field: {
          borderColor: "whiteAlpha.300",
          _hover: {
            borderColor: "whiteAlpha.400",
          },
        },
      },
    },
  },
})

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [quantity, setQuantity] = useState(1)
  const [mintStage, setMintStage] = useState<string | null>(null)
  const [mintPrice, setMintPrice] = useState<string | null>("Fetching price...")
  const [totalSupply, setTotalSupply] = useState<number>(0)
  const [preconfigCount, setPreconfigCount] = useState<number>(0)
  const [userMinted, setUserMinted] = useState<number>(0)
  const [walletLimit, setWalletLimit] = useState<number>(DEFAULT_WALLET_LIMIT)
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false)
  const [isMinting, setIsMinting] = useState(false)

  const toast = useToast()
  const { writeContractAsync } = useWriteContract()

  // Contract read hooks
  const { data: salePhase } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "salePhase",
  })

  const { data: publicPrice } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "publicPrice",
  })

  const { data: whitelistPrice } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "whitelistPrice",
  })

  const { data: isUserWhitelisted } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "whitelisted",
    args: [address],
  })

  const { data: mintedByUser } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "mintedCount",
    args: [address],
  })

  const { data: userMintLimit } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "customMintLimit",
    args: [address],
  })

  const { data: totalSupplyData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "totalSupply",
  })

  const { data: preconfigCountData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: "getPreconfigurationCount",
  })

  useEffect(() => {
    if (salePhase !== undefined) {
      if (salePhase === 1) {
        setMintStage("Free Mint")
        setMintPrice("0")
      } else if (salePhase === 2) {
        setMintStage("Whitelist Mint")
        setMintPrice(
          whitelistPrice && typeof whitelistPrice === "bigint" ? formatEther(whitelistPrice) : "Fetching price...",
        )
      } else if (salePhase === 3) {
        setMintStage("Public Mint")
        setMintPrice(publicPrice && typeof publicPrice === "bigint" ? formatEther(publicPrice) : "Fetching price...")
      } else {
        setMintStage("Minting Closed")
        setMintPrice(null)
      }
    }

    if (totalSupplyData !== undefined) {
      setTotalSupply(Number(totalSupplyData))
    }

    if (preconfigCountData !== undefined) {
      setPreconfigCount(Number(preconfigCountData))
    }

    if (mintedByUser !== undefined) {
      setUserMinted(Number(mintedByUser))
    }

    if (userMintLimit !== undefined) {
      setWalletLimit(Number(userMintLimit))
    }

    if (isUserWhitelisted !== undefined) {
      setIsWhitelisted(Boolean(isUserWhitelisted))
    }
  }, [
    salePhase,
    publicPrice,
    whitelistPrice,
    totalSupplyData,
    preconfigCountData,
    mintedByUser,
    isUserWhitelisted,
    userMintLimit,
  ])

  const remainingSupply = preconfigCount - totalSupply

  const handleMint = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first.",
        status: "error",
        duration: 5000,
        isClosable: true,
      })
      return
    }

    if (chainId !== EXPECTED_CHAIN_ID) {
      toast({
        title: "Wrong network",
        description: "Please switch to the correct chain.",
        status: "error",
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      setIsMinting(true)
      const mintValue = parseEther((Number.parseFloat(mintPrice || "0") * quantity).toString())

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: contractAbi,
        functionName: "mintPublic",
        args: [quantity],
        value: mintValue,
      })

      toast({
        title: "Transaction Submitted",
        description: `Transaction hash: ${txHash}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      })

      setTotalSupply((prev) => prev + quantity)
    } catch (error: any) {
      const errorMessage = error.shortMessage || error.message || "Transaction failed for unknown reasons."

      toast({
        title: "Minting Failed",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsMinting(false)
    }
  }

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" py={8} sx={{ background: "#121212" }}>
        <Container maxW="container.md">
          <Card borderWidth="1px" borderColor="whiteAlpha.200">
            <CardBody>
              <VStack spacing={8}>
                {/* NFT Preview */}
                <Box w="full" maxW="300px" mx="auto">
                  <AspectRatio ratio={1}>
                    <Box position="relative" overflow="hidden" borderRadius="xl">
                      <Image src="/images/4.png" alt="NFT Preview" width={300} height={300} style={{ objectFit: "cover" }} unoptimized />
                    </Box>
                  </AspectRatio>
                </Box>

                {/* Mint Info */}
                <VStack w="full" spacing={4}>
                  <HStack w="full" justify="space-between">
                    <Text color="whiteAlpha.800">Total Minted:</Text>
                    <Text fontWeight="bold" color="whiteAlpha.800">
                      {totalSupply} / {preconfigCount}
                    </Text>
                  </HStack>
                  <HStack w="full" justify="space-between">
                    <Text color="whiteAlpha.800">Price:</Text>
                    <Text fontWeight="bold" color="whiteAlpha.800">{mintPrice !== null ? `${mintPrice} ETH + GAS` : "Fetching price..."}</Text>
                  </HStack>
                  <Progress
                    value={(totalSupply / preconfigCount) * 100}
                    w="full"
                    colorScheme="blue"
                    borderRadius="full"
                    bg="whiteAlpha.100"
                  />
                </VStack>

                {/* Mint Controls */}
                <VStack w="full" spacing={4}>
                  <HStack w="full" maxW="400px" spacing={4}>
                    <NumberInput fontWeight="bold" color="whiteAlpha.800"
                      value={quantity}
                      min={1}
                      max={mintStage === "Public Mint" ? remainingSupply : Math.min(walletLimit - userMinted, remainingSupply)}
                      onChange={(_, value) => setQuantity(value)}
                      bg="whiteAlpha.50"
                    >
                      <NumberInputField maxW="100px"/>
                      <NumberInputStepper>
                      <NumberIncrementStepper color="whiteAlpha.800" />
                      <NumberDecrementStepper color="whiteAlpha.800" />
                      </NumberInputStepper>
                    </NumberInput>
                    <Button
                      size="lg"
                      fontSize={["sm", "lg"]}
                      flex={1}
                      isLoading={isMinting}
                      loadingText="Minting..."
                      isDisabled={!isConnected || remainingSupply === 0 || (mintStage !== "Public Mint" && userMinted >= walletLimit)}
                      onClick={handleMint}
                    >
                      {remainingSupply === 0 ? "SOLD OUT" : isMinting ? "Minting..." : `MINT NOW`}
                    </Button>
                  </HStack>
                </VStack>

                {/* Mint Status */}
                <VStack w="full" spacing={2}>
                  <Text fontSize="lg" fontWeight="bold" color="whiteAlpha.900">
                    Mint Phase: {mintStage}
                  </Text>
                    {mintStage !== "Public Mint" && (
                    <Text color="whiteAlpha.800">
                      Minted {userMinted} of {walletLimit} available spots
                    </Text>
                    )}
                  {isWhitelisted && (
                    <Badge colorScheme="green" variant="solid">
                      Whitelisted
                    </Badge>
                  )}
                </VStack>
              </VStack>
            </CardBody>
          </Card>
        </Container>
      </Box>
    </ChakraProvider>
  )
}

