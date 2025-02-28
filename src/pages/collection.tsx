"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContracts } from "wagmi"
import type { Abi } from "viem"
import contractAbi from "../abi/nftAbi.json"
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  SimpleGrid,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Card,
  CardBody,
  AspectRatio,
  Skeleton,
  ChakraProvider,
  extendTheme,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody,
} from "@chakra-ui/react"
import { HamburgerIcon, CloseIcon } from "@chakra-ui/icons"
import Image from "next/image"
import { useToast } from "@chakra-ui/react"

// Custom theme to match the mint page
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
        ghost: {
          _hover: {
            bg: "whiteAlpha.200",
          },
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
  },
})

const CONTRACT_ADDRESS = "0x343d3c584cFA02AB2fa4dbed2c495000ab8Ee7CF"

interface Trait {
  trait_type: string
  value: string
}

interface Category {
  name: string
  contract: string
  traits: string[]
}

interface NFT {
  id: number
  name: string
  image: string
  attributes: Trait[]
}

export default function CollectionPage() {
  const { address } = useAccount()
  const [categories, setCategories] = useState<Category[]>([])
  const [nfts, setNfts] = useState<NFT[]>([])
  const [filteredNFTs, setFilteredNFTs] = useState<NFT[]>([])
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({})
  const [selectedTraits, setSelectedTraits] = useState<{ [key: string]: string | null }>({})
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingNFTs, setLoadingNFTs] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()
  const [isNFTModalOpen, setNFTModalOpen] = useState(false)
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null)
  const [nftOwners, setNftOwners] = useState<{ [key: number]: string }>({})



  // Contract calls setup
  const categoryCalls = Array.from({ length: 50 }, (_, index) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi as Abi,
    functionName: "traits",
    args: [index],
  }))

  const { data: categoryData } = useReadContracts({
    contracts: categoryCalls,
  })

  const { data: nftData } = useReadContracts({
    contracts: address
      ? [
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: contractAbi as Abi,
            functionName: "getNFTsDetailedForWallet",
            args: [address],
          },
        ]
      : [],
  })

  useEffect(() => {
    if (!categoryData) return

    const tempCategories: Category[] = categoryData
      .map((item) => {
        const result = item?.result as [string, string, boolean, boolean] | undefined
        if (!result || !result[0]) return null
        return {
          name: result[0],
          contract: result[1] || "",
          traits: [],
        }
      })
      .filter(Boolean) as Category[]

    setCategories(tempCategories)
    setLoadingCategories(false)
  }, [categoryData])

  useEffect(() => {
    if (!nftData || !Array.isArray(nftData[0]?.result)) return

    const fetchMetadata = async () => {
      try {
        const fetchedNFTs = await Promise.all(
          ((nftData[0]?.result as any[]) || []).map(async (nft: any) => {
            const tokenId = nft.nftId;
            const tokenURI = `/api/fetchMetadata?tokenId=${tokenId}`

            try {
              const response = await fetch(tokenURI);
              if (!response.ok) throw new Error(`Failed to load metadata from token URI for token ${tokenId}`);

              const metadata = await response.json()
              return {
                id: tokenId,
                name: metadata.name || nft.identity.name || `NFT #${tokenId}`,
                image: validateImageUrl(metadata.image),
                attributes: metadata.attributes || [],
              }
            } catch (err) {
              console.error(`Error fetching metadata for NFT ${tokenId}:`, err)
              return {
                id: tokenId,
                name: nft.identity.name || `NFT #${tokenId}`,
                image: "/placeholder.svg",
                attributes: [],
              }
            }
          }),
        )

        setNfts(fetchedNFTs)
        setFilteredNFTs(fetchedNFTs)
        updateCategoryTraits(fetchedNFTs)
      } catch (err) {
        console.error("Error fetching NFT metadata:", err)
        toast({
          title: "Error",
          description: "Failed to load NFT metadata.",
          status: "error",
          duration: 5000,
          isClosable: true,
        })
      } finally {
        setLoadingNFTs(false)
      }
    }

    fetchMetadata()
  }, [nftData, toast])

  const validateImageUrl = (url: string | undefined): string => {
    if (!url || typeof url !== "string") return "/placeholder.svg"
    if (url.startsWith("http") || url.startsWith("/")) return url
    return "/placeholder.svg"
  }

  const updateCategoryTraits = (fetchedNFTs: NFT[]) => {
    setCategories((prevCategories) =>
      prevCategories.map((category) => {
        const categoryTraits = new Set<string>()
        fetchedNFTs.forEach((nft) => {
          nft.attributes.forEach((attr: Trait) => {
            if (attr.trait_type === category.name) {
              categoryTraits.add(attr.value)
            }
          })
        })
        return {
          ...category,
          traits: Array.from(categoryTraits),
        }
      }),
    )
  }

  useEffect(() => {
    let filtered = nfts
  if (selectedTraits["MyNFTs"]) {
    filtered = filtered.filter((nft) => nftOwners[nft.id] === address);
  }
  Object.entries(selectedTraits).forEach(([traitType, value]) => {
    if (value && traitType !== "MyNFTs") {
      filtered = filtered.filter((nft) =>
        nft.attributes.some((attr) => attr.trait_type === traitType && attr.value === value),
      );
    }
  });
    setFilteredNFTs(filtered)
  }, [selectedTraits, nfts])

  const handleTraitSelect = (category: string, trait: string) => {
    setSelectedTraits((prev) => ({
      ...prev,
      [category]: prev[category] === trait ? null : trait,
    }))
  }

  const ownerCalls = nfts.map((nft) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi as Abi,
    functionName: "ownerOf",
    args: [nft.id],
  }));
  
  const { data: ownerData } = useReadContracts({
    contracts: ownerCalls,
  });
  
  useEffect(() => {
    if (!ownerData) return;
    
    const owners = ownerData.reduce((acc, result, index) => {
      const owner = result?.result as string | undefined;
      if (owner) {
        acc[nfts[index].id] = owner;
      }
      return acc;
    }, {} as { [key: number]: string });
  
    setNftOwners(owners);
  }, [ownerData, nfts]);
  

  const openNFTModal = (nft: NFT) => {
    setSelectedNFT(nft)
    setNFTModalOpen(true)
  }
  
  const closeNFTModal = () => {
    setNFTModalOpen(false)
  }

  const renderNFTCard = (nft: NFT) => (
    <Card key={nft.id} overflow="hidden" borderWidth="1px" borderColor="whiteAlpha.200" maxW="180px">
      <AspectRatio ratio={1} onClick={() => openNFTModal(nft)} cursor="pointer">
        <Box position="relative">
          <Image
            src={nft.image || "/placeholder.svg"}
            alt={nft.name}
            fill
            style={{ objectFit: "cover", borderRadius: "8px" }}
          />
        </Box>
      </AspectRatio>
      <CardBody p={2}>
        <VStack align="stretch" spacing={1}>
          <Text fontSize="sm" fontWeight="semibold" color="white" noOfLines={1}>
            {nft.name}
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" bg="#121212">
        <Container maxW="container.xl" py={4}>
          <HStack align="flex-start" spacing={6}>
            {/* Sidebar */}
            <Card
              display={{ base: "none", lg: "block" }}
              w="280px"
              position="sticky"
              top={6}
              maxH="calc(100vh - 2rem)"
              overflowY="auto"
              sx={{
                "&::-webkit-scrollbar": {
                  width: "4px",
                },
                "&::-webkit-scrollbar-track": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "whiteAlpha.200",
                  borderRadius: "24px",
                },
              }}
            >
              <CardBody>
                <VStack align="stretch" spacing={4}>
                <Button
    variant={selectedTraits["MyNFTs"] ? "solid" : "ghost"}
    onClick={() => {
      setSelectedTraits((prev) => ({
        ...prev,
        MyNFTs: prev.MyNFTs ? null : "selected",
      }));
    }}
    color="white"
  >
    My NFTs
  </Button>
                  <Text fontSize="xl" fontWeight="bold" color="white">
                    Filters
                  </Text>
 
                  {loadingCategories ? (
                    <VStack align="stretch" spacing={2}>
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height="40px" />
                      ))}
                    </VStack>
                  ) : (
                    categories.map((category, index) => (
                      <Box key={index}>
                        <Button
                          variant="ghost"
                          width="full"
                          justifyContent="space-between"
                          onClick={() =>
                            setExpandedCategories((prev) => ({ ...prev, [category.name]: !prev[category.name] }))
                          }
                          color="whiteAlpha.900"
                        >
                          <Text>{category.name}</Text>
                          {expandedCategories[category.name] ? (
                            <CloseIcon boxSize={3} />
                          ) : (
                            <HamburgerIcon boxSize={3} />
                          )}
                        </Button>
                        {expandedCategories[category.name] && (
                          <VStack align="stretch" pl={4} mt={2} spacing={1}>
                            {category.traits.map((trait, idx) => (
                              <Button
                                key={idx}
                                size="sm"
                                variant={selectedTraits[category.name] === trait ? "solid" : "ghost"}
                                onClick={() => handleTraitSelect(category.name, trait)}
                                color="whiteAlpha.900"
                              >
                                {trait}
                              </Button>
                            ))}
                          </VStack>
                        )}
                      </Box>
                    ))
                  )}
                </VStack>
              </CardBody>
            </Card>

            {/* Main Content */}
            <Box flex={1}>
              <HStack justify="space-between" mb={6}>
                <Button display={{ base: "inline-flex", lg: "none" }} onClick={onOpen} leftIcon={<HamburgerIcon />}>
                  Filters
                </Button>
              </HStack>

              {loadingNFTs ? (
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Box key={i}>
                      <AspectRatio ratio={1}>
                        <Skeleton />
                      </AspectRatio>
                    </Box>
                  ))}
                </SimpleGrid>
              ) : (
                <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 5 }} spacing={3}>
                  {filteredNFTs.map(renderNFTCard)}
                </SimpleGrid>
              )}
            </Box>
          </HStack>
        </Container>

        
        <Modal isOpen={isNFTModalOpen} onClose={closeNFTModal} size="sm">
        <ModalOverlay />
        <ModalContent 
          bg="#1A1A1A" 
          color="white" 
          borderRadius="lg" 
          p={4} 
          w={{ base: "92%", md: "360px" }} /* Slightly narrower for better readability */
        >
          <ModalHeader fontSize="lg" textAlign="center">{selectedNFT?.name}</ModalHeader>
          <ModalCloseButton />

          <ModalBody>
            {selectedNFT && (
        <VStack align="center" spacing={3}>
          <Box 
            display="flex" 
            justifyContent="center" 
            alignItems="center" 
            w="full"
          >
            <Image 
              src={selectedNFT.image || "/placeholder.svg"} 
              alt={selectedNFT.name} 
              width={300} /* 🔥 Larger on tablet screens or bigger */
              height={300} 
              style={{ borderRadius: "10px", objectFit: "cover" }} 
            />
          </Box>

          <Box textAlign="center" w="full">
            <HStack justify="center" spacing={1}>
              <Text fontSize="sm" color="whiteAlpha.700">Owned by:</Text>
              <Text 
              fontSize="xs" /* Slightly smaller so it wraps neatly */
              fontWeight="bold" 
              wordBreak="break-word" /* Ensures no overflow */
              textAlign="center"
              >
              {nftOwners[selectedNFT.id] ? `${nftOwners[selectedNFT.id].slice(0, 6)}...${nftOwners[selectedNFT.id].slice(-4)}` : "Loading..."}
              </Text>
            </HStack>
          </Box>

          <VStack align="stretch" spacing={1} w="full">
            {selectedNFT.attributes.map((attr, idx) => (
              <HStack 
          key={idx} 
          justify="space-between" 
          p={1} 
          borderBottom="1px solid whiteAlpha.300"
              >
          <Text fontSize="sm" fontWeight="medium" color="whiteAlpha.600">
            {attr.trait_type}
          </Text>
          <Text fontSize="sm" fontWeight="bold">{attr.value}</Text>
              </HStack>
            ))}
          </VStack>

        </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

        {/* Mobile Filter Drawer */}
        <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="full">
          <DrawerOverlay />
          <DrawerContent bg="#1A1A1A">
            <DrawerCloseButton color="white" />
            <DrawerHeader borderBottomWidth="1px" borderBottomColor="whiteAlpha.200">
              Filters
            </DrawerHeader>
            <DrawerBody>
              <VStack align="stretch" spacing={4}>
                {categories.map((category, index) => (
                  <Box key={index}>
                    <Button
                      variant="ghost"
                      width="full"
                      justifyContent="space-between"
                      onClick={() =>
                        setExpandedCategories((prev) => ({ ...prev, [category.name]: !prev[category.name] }))
                      }
                      color="white"
                    >
                      <Text>{category.name}</Text>
                      {expandedCategories[category.name] ? <CloseIcon boxSize={3} /> : <HamburgerIcon boxSize={3} />}
                    </Button>
                    {expandedCategories[category.name] && (
                      <VStack align="stretch" pl={4} mt={2} spacing={1}>
                        {category.traits.map((trait, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            variant={selectedTraits[category.name] === trait ? "solid" : "ghost"}
                            onClick={() => handleTraitSelect(category.name, trait)}
                            color="white"
                          >
                            {trait}
                          </Button>
                        ))}
                      </VStack>
                    )}
                  </Box>
                ))}
              </VStack>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Box>
    </ChakraProvider>
  )
}

