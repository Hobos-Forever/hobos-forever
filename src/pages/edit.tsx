"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import type { Abi } from "viem";
import nftAbi from "../abi/nftAbi.json";
import traitsAbi from "../abi/traitsAbi.json";
import {
  Box,
  Container,
  Text,
  Button,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Select,
  Checkbox,
  useDisclosure,
  extendTheme,
  useToast,
  Image,
  ChakraProvider,
  Flex,
  Divider,
  Input,
  Radio, 
  RadioGroup,
} from "@chakra-ui/react";

interface Trait {
  trait_type: string;
  value: string;
}

interface NFT {
  id: number;
  name: string;
  image: string;
  attributes: Trait[];
  collectionType: string; // e.g. "Hobo" or "Lady"
}

const TRAIT_BASE_URL = "https://meta.cryptosquaries.com/images/traits/";

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: "#121212",
        color: "white",
      },
    },
  },
});

const CONTRACT_ADDRESS = "0x343d3c584cFA02AB2fa4dbed2c495000ab8Ee7CF";

const TRAIT_CONTRACTS = [
  { name: "Background", address: "0xaD6DB37BB68d71EC57d4CF3daf292cac38BF714b", removable: false },
  { name: "Body", address: "0x6bF72C3eD8ccc6F8aE6929E0dB90939B31F6895E", removable: false },
  { name: "Eyes", address: "0x7332615E24d76B12f8A01837Ed66aB98857fc62B", removable: false },
  { name: "Mouth", address: "0xD8268cC1cC87b4794158539Fb599e0a8DFb412D1", removable: false },
  { name: "Earring", address: "0x83BD60ae5d2a8420ea95c1a09012848802B7f1Dc", removable: true },
  { name: "Hair", address: "0x32361F4308E5042242B92Ba0d5c996FB96e4B8CE", removable: true },
];

export default function TraitManagementPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const toast = useToast();
  const { writeContractAsync } = useWriteContract();

  const modifyTraitsModal = useDisclosure();
  const swapTraitsModal = useDisclosure();
  const setNameModal = useDisclosure();

  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState<boolean>(true);
  const [selectedTraitContract, setSelectedTraitContract] = useState<string>("");
  const [availableTraits, setAvailableTraits] = useState<
    { tokenId: number; name: string; balance: number }[]
  >([]);
  const [selectedTraitId, setSelectedTraitId] = useState<number | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [selectedNFTsForSwap, setSelectedNFTsForSwap] = useState<NFT[]>([]);
  const [selectedSwapCategory, setSelectedSwapCategory] = useState<string>("");
  const [traitChangingFee, setTraitChangingFee] = useState<bigint>(0n);
  const [nftOnChainTraits, setNftOnChainTraits] = useState<number[]>([]);
  const [imageVersion, setImageVersion] = useState<number>(Date.now());
  const [swapNFTTraits, setSwapNFTTraits] = useState<{ [tokenId: number]: number[] }>({});
  const [newName, setNewName] = useState<string>("");
  

  const waitForTx = async (
    txHash: string,
    pollInterval = 1000,
    timeout = 60000
  ) => {
    const startTime = Date.now();
    while (true) {
      if (!publicClient) throw new Error("Public client is not available.");
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        if (receipt) return receipt;
      } catch (err) {
        // Ignore errors and continue polling.
      }
      if (Date.now() - startTime > timeout) {
        throw new Error("Transaction confirmation timed out");
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  };

  const getCollectionTypeString = (enumValue: number | string): string => {
    // If it's already a string, return it
    if (typeof enumValue === "string") return enumValue;
    // Otherwise assume numeric values 0,1,2 corresponding to Hobo, Lady, Legendary
    switch (enumValue) {
      case 0:
        return "Hobo";
      case 1:
        return "Lady";
      case 2:
        return "Legendary";
      default:
        return "Hobo"; // default fallback
    }
  };

  useEffect(() => {
    const fetchFee = async () => {
      if (!publicClient) return;
      try {
        const fee = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: nftAbi as Abi,
          functionName: "traitChangingFee",
          args: [],
        });
        setTraitChangingFee(BigInt(fee as string | number));
      } catch (err) {
        console.error("Error fetching traitChangingFee:", err);
      }
    };
    fetchFee();
  }, [publicClient]);

  const { data: nftData } = useReadContracts({
    contracts: [
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: nftAbi as Abi,
        functionName: "getNFTsDetailedForWallet",
        args: [address],
      },
    ],
  });

  useEffect(() => {
    if (!nftData || !Array.isArray(nftData[0]?.result)) return;
    const fetchMetadata = async () => {
      try {
        const nftArray = (nftData[0]?.result as any[]) || [];
        const fetchedNFTs: NFT[] = await Promise.all(
          nftArray.map(async (nft) => {
            const tokenId = nft.nftId;
            const apiUrl = `/api/fetchMetadata?tokenId=${tokenId}&_=${Date.now()}`;
            try {
              const response = await fetch(apiUrl, { cache: "no-store" });
              if (!response.ok)
                throw new Error(`Failed to load metadata for token ${tokenId}`);
              const metadata = await response.json();
              return {
                id: tokenId,
                name: metadata.name || nft.identity.name || `NFT #${tokenId}`,
                image: validateImageUrl(metadata.image),
                attributes: metadata.attributes || [],
                collectionType: getCollectionTypeString(nft.identity.collectionType),
              };
            } catch {
              return { id: tokenId, name: nft.identity.name || `NFT #${tokenId}`, image: "/placeholder.svg", attributes: [], collectionType: "Unknown" };
            }
          })
        );
        setNfts(fetchedNFTs);
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load NFT metadata.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoadingNFTs(false);
      }
    };
    fetchMetadata();
  }, [nftData, toast]);

  const validateImageUrl = (url: string | undefined): string => {
    if (!url || typeof url !== "string") return "/placeholder.svg";
    return url.startsWith("http") || url.startsWith("/") ? url : "/placeholder.svg";
  };

  const fetchAvailableTraits = async () => {
    if (!selectedTraitContract || !address || !publicClient) {
      setAvailableTraits([]);
      setSelectedTraitId(null);
      return;
    }
    try {
      const count = await publicClient.readContract({
        address: selectedTraitContract as `0x${string}`,
        abi: traitsAbi as Abi,
        functionName: "attributeItemCount",
        args: [],
      });
      const total = Number(count);
      const available: { tokenId: number; name: string; balance: number }[] = [];
      for (let tokenId = 0; tokenId < total; tokenId++) {
        const balance = await publicClient.readContract({
          address: selectedTraitContract as `0x${string}`,
          abi: traitsAbi as Abi,
          functionName: "balanceOf",
          args: [address, tokenId],
        });
        const bal = Number(balance);
        if (bal > 0) {
          const item = (await publicClient.readContract({
            address: selectedTraitContract as `0x${string}`,
            abi: traitsAbi as Abi,
            functionName: "attributeItems",
            args: [tokenId],
          })) as any;
          const traitName = Array.isArray(item) ? item[1] : item.name;
          available.push({ tokenId, name: traitName, balance: bal });
        }
      }
      setAvailableTraits(available);
      if (available.length > 0) setSelectedTraitId(available[0].tokenId);
      else setSelectedTraitId(null);
    } catch (err) {
      console.error(err);
      setAvailableTraits([]);
      setSelectedTraitId(null);
    }
  };

  useEffect(() => {
    fetchAvailableTraits();
  }, [selectedTraitContract, address, publicClient]);

  // Fetch on-chain traits for the NFT (and store in state)
  const fetchNFTOnChainTraitsForModal = async (nftId: number) => {
    if (!publicClient) return;
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: nftAbi as Abi,
        functionName: "getTraitsOnNFT",
        args: [BigInt(nftId)],
      });
      setNftOnChainTraits((result as any).map((x: any) => Number(x)));
    } catch (err) {
      console.error("Error fetching on-chain traits:", err);
      setNftOnChainTraits([]);
    }
  };

    // New: Fetch traits for NFTs selected for swapping.
    useEffect(() => {
      if (selectedNFTsForSwap.length === 2 && selectedSwapCategory) {
        const fetchSwapTraits = async () => {
          if (!publicClient) return;
          const results: { [tokenId: number]: number[] } = {};
          for (const nft of selectedNFTsForSwap) {
            try {
              const res = await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: nftAbi as Abi,
                functionName: "getTraitsOnNFT",
                args: [BigInt(nft.id)],
              });
              results[nft.id] = Array.isArray(res) ? res.map((x: any) => Number(x)) : [];
            } catch (err) {
              console.error("Error fetching swap NFT traits for NFT", nft.id, err);
              results[nft.id] = [];
            }
          }
          setSwapNFTTraits(results);
        };
        fetchSwapTraits();
      }
    }, [selectedNFTsForSwap, selectedSwapCategory, publicClient]);

  const openTraitModal = (nft: NFT) => {
    setSelectedNFT(nft);
    setSelectedTraitContract("");
    setAvailableTraits([]);
    setSelectedTraitId(null);
    setNftOnChainTraits([]);
    modifyTraitsModal.onOpen();
    fetchNFTOnChainTraitsForModal(nft.id);
  };

  const nftAlreadyHasTrait = useMemo(() => {
    if (!selectedTraitContract || nftOnChainTraits.length === 0) return false;
    const index = TRAIT_CONTRACTS.findIndex((t) => t.address === selectedTraitContract);
    if (index < 0) return false;
    return nftOnChainTraits[index] !== -1;
  }, [selectedTraitContract, nftOnChainTraits]);

  const selectedCategoryName = useMemo(() => {
    return TRAIT_CONTRACTS.find((t) => t.address === selectedTraitContract)?.name || "";
  }, [selectedTraitContract]);

    // --- New: Set Name Modal handlers ---
    const handleSetName = async () => {
      if (!selectedNFT || newName.trim() === "") return;
      try {
        await callUpdateMetadata(selectedNFT.id, newName);
        toast({
          title: "Success",
          description: "Name updated successfully.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        setNameModal.onClose();
        setImageVersion(Date.now());
        window.location.reload();
      } catch (err) {
        console.error(err);
        toast({
          title: "Error",
          description: "Failed to update metadata.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    };

  // --- Helper: call updateMetadata API ---
  const callUpdateMetadata = async (tokenId: number, newName?: string) => {
    try {
      const response = await fetch("/api/updateMetadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: tokenId.toString(),
          ...(newName ? { newName } : {}),
        }),
      });
      if (!response.ok) {
        console.error("updateMetadata API error:", await response.text());
      } else {
        console.log("updateMetadata API success:", await response.json());
      }
    } catch (err) {
      console.error("Error calling updateMetadata API:", err);
    }
  };

  // --- Handlers ---
  const handleAddTrait = async () => {
    if (!selectedNFT || !selectedTraitContract || selectedTraitId === null) return;
    if (nftAlreadyHasTrait) {
      toast({
        title: "Error",
        description: `NFT already has a ${selectedCategoryName} trait assigned.`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    if (!publicClient) {
      toast({
        title: "Error",
        description: "Public client is not available.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    try {
      const txHash = (await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: nftAbi as Abi,
        functionName: "addTraitToNFT",
        args: [selectedNFT.id, selectedTraitContract, selectedTraitId],
        value: traitChangingFee > 0n ? traitChangingFee : undefined,
      })) as `0x${string}`;
      await waitForTx(txHash);
      toast({
        title: "Success",
        description: "Trait added successfully. Please wait for page to reload",
        status: "success",
        duration: 10000,
        isClosable: true,
      });
      modifyTraitsModal.onClose();
      fetchNFTOnChainTraitsForModal(selectedNFT.id);
      fetchAvailableTraits();
      // --- Call updateMetadata API ---
      await callUpdateMetadata(selectedNFT.id);
      setImageVersion(Date.now());
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to add trait.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    }
  };

  const handleRemoveTrait = async () => {
    if (!selectedNFT || !selectedTraitContract) return;
    if (!publicClient) {
      toast({
        title: "Error",
        description: "Public client is not available.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    try {
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: nftAbi as Abi,
        functionName: "removeTraitFromNFT",
        args: [selectedNFT.id, selectedTraitContract],
        value: traitChangingFee > 0n ? traitChangingFee : undefined,
      });
      await waitForTx(txHash as `0x${string}`);
      toast({
        title: "Success",
        description: "Trait removed successfully. Please wait for page to reload",
        status: "success",
        duration: 10000,
        isClosable: true,
      });
      modifyTraitsModal.onClose();
      fetchNFTOnChainTraitsForModal(selectedNFT.id);
      fetchAvailableTraits();
      // --- Call updateMetadata API ---
      await callUpdateMetadata(selectedNFT.id);
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to remove trait.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    }
  };

  const handleSwapTraits = async () => {
    if (selectedNFTsForSwap.length !== 2 || !selectedSwapCategory) return;
    if (!publicClient) {
      toast({
        title: "Error",
        description: "Public client is not available.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    try {
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: nftAbi as Abi,
        functionName: "swapTraitBetweenNFTs",
        args: [
          selectedNFTsForSwap[0].id,
          selectedNFTsForSwap[1].id,
          selectedSwapCategory,
        ],
        value: traitChangingFee > 0n ? traitChangingFee : undefined,
      });
      await waitForTx(txHash as `0x${string}`);
      toast({
        title: "Success",
        description: "Traits swapped successfully. Please wait for page to reload",
        status: "success",
        duration: 10000,
        isClosable: true,
      });
      swapTraitsModal.onClose();
          // Save token IDs before clearing state:
    const tokenIdA = selectedNFTsForSwap[0].id;
    const tokenIdB = selectedNFTsForSwap[1].id;
      setSelectedNFTsForSwap([]);
      await waitForTx(txHash);
      // Optionally add a delay to allow for state propagation
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await callUpdateMetadata(tokenIdA);
      await callUpdateMetadata(tokenIdB);
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to swap traits.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    }
  };

    // --- New: Render Set Name Modal ---
    const renderSetNameModal = () => (
      <Modal isOpen={setNameModal.isOpen} onClose={setNameModal.onClose}>
        <ModalOverlay />
        <ModalContent bg="#1A1A1A" color="white">
          <ModalHeader>Set Name</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Enter new name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              mb={4}
            />
            <Button bg="yellow.500" onClick={handleSetName}>
              Save Name
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    );

    // Render a custom swap modal that displays trait images (not full NFT images) for the selected category.
  // We assume that on-chain, the traits are stored as an array (swapNFTTraits), and we know the index based on TRAIT_CONTRACTS.
  const renderSwapModal = () => (
    <Modal isOpen={swapTraitsModal.isOpen} onClose={swapTraitsModal.onClose}>
      <ModalOverlay />
      <ModalContent bg="#1A1A1A" color="white">
        <ModalHeader>Swap Traits</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Select
            onChange={(e) => setSelectedSwapCategory(e.target.value)}
            placeholder="Select Category"
          >
            {TRAIT_CONTRACTS.map((t) => (
              <option key={t.address} value={t.address}>
                {t.name}
              </option>
            ))}
          </Select>
          {selectedSwapCategory && selectedNFTsForSwap.length === 2 && (
            <Flex justifyContent="space-around" mt={4}>
              {selectedNFTsForSwap.map((nft) => {
                // Find the category object and its index.
                const categoryObj = TRAIT_CONTRACTS.find(
                  (t) => t.address === selectedSwapCategory
                );
                const index = TRAIT_CONTRACTS.findIndex(
                  (t) => t.address === selectedSwapCategory
                );
                // Get the trait array for this NFT from the swapNFTTraits state.
                const traitsArray = swapNFTTraits[nft.id] || [];
                const traitId = traitsArray.length > index ? traitsArray[index] : -1;
                // Assume a default collection type (or retrieve it from NFT metadata if available)
                const nftType = "Hobo";
                const traitImageUrl =
                  traitId >= 0
                    ? `${TRAIT_BASE_URL}${nftType.toLowerCase()}/${categoryObj?.name.toLowerCase()}/${traitId}.png`
                    : "/placeholder.svg";
                return (
                  <Box key={nft.id} textAlign="center">
                    <Image
                      src={traitImageUrl}
                      alt={`${categoryObj?.name} trait`}
                      width={80}
                      height={80}
                      borderRadius="md"
                    />
                    <Text mt={2} fontSize="sm">
                      {categoryObj?.name || "Unknown"}
                    </Text>
                  </Box>
                );
              })}
            </Flex>
          )}
          <Button mt={4} bg="yellow.500" onClick={handleSwapTraits}>
            Swap
          </Button>
        </ModalBody>
      </ModalContent>
    </Modal>
  );

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" bg="#121212">
        <Container maxW="container.xl" py={4}>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            {nfts.map((nft) => (
                <Box key={nft.id} bg="gray.800" borderRadius="lg" p={3} width="200px" mx="auto">
                <Checkbox
                colorScheme="yellow"
                onChange={() =>
                setSelectedNFTsForSwap((prev) =>
                  prev.includes(nft)
                  ? prev.filter((n) => n !== nft)
                  : [...prev, nft]
                )
                }
                display="block"
                mx="auto"
                >
                Swap Traits
                </Checkbox>
                <Image
                key={`${nft.id}-${imageVersion}`}
                src={`${nft.image}?v=${imageVersion}`}
                alt={nft.name}
                width={150}
                height={150}
                borderRadius="md"
                mx="auto"
                />
                <Text mt={2} fontSize="sm" fontWeight="bold" textAlign="center">
                {nft.name}
                </Text>
                <Button mt={2} size="sm" onClick={() => openTraitModal(nft)} display="block" mx="auto">
                Modify Traits
                </Button>
                <Button
                mt={2}
                size="sm"
                onClick={() => {
                setSelectedNFT(nft);
                setNewName(nft.name);
                setNameModal.onOpen();
                }}
                display="block"
                mx="auto"
                >
                Set Name
                </Button>
                </Box>
            ))}
            </SimpleGrid>
        </Container>
        {selectedNFTsForSwap.length > 0 && (
          <Box bg="yellow.500" p={3} position="fixed" bottom="0" width="100%">
            <Flex justify="center" align="center">
              {selectedNFTsForSwap[0] && (
              <Image src={selectedNFTsForSwap[0].image} alt={selectedNFTsForSwap[0].name} width={50} height={50} borderRadius="md" mr={2} />
              )}
              <Button
              bg="black"
              color="white"
              onClick={swapTraitsModal.onOpen}
              width="150px"
              isDisabled={selectedNFTsForSwap.length !== 2}
              >
              Swap Traits
              </Button>
              {selectedNFTsForSwap[1] && (
              <Image src={selectedNFTsForSwap[1].image} alt={selectedNFTsForSwap[1].name} width={50} height={50} borderRadius="md" ml={2} />
              )}
            </Flex>
          </Box>
        )}
        <Modal isOpen={modifyTraitsModal.isOpen} onClose={modifyTraitsModal.onClose}>
    <ModalOverlay />
    <ModalContent bg="#1A1A1A" color="white">
      <ModalHeader>Modify Traits for {selectedNFT?.name}</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        {/* Category Selector */}
        <Select
          onChange={(e) => setSelectedTraitContract(e.target.value)}
          placeholder="Select Trait Category"
        >
          {TRAIT_CONTRACTS.map((t) => (
            <option key={t.address} value={t.address}>
              {t.name}
            </option>
          ))}
        </Select>

        {/* Divider between selector and sections */}
        <Divider my={4} />

{/* Add Trait Section */}
<Text fontWeight="bold" mb={2}>Add Trait</Text>
      {availableTraits.length > 0 && selectedNFT ? (
        <RadioGroup
          value={selectedTraitId !== null ? selectedTraitId.toString() : ""}
          onChange={(value) => setSelectedTraitId(Number(value))}
        >
          <SimpleGrid columns={2} spacing={2}>
            {availableTraits.map((trait) => (
              <Radio key={trait.tokenId} value={trait.tokenId.toString()}>
                <Box display="flex" alignItems="center">
                  <Image
                    src={`${TRAIT_BASE_URL}${selectedNFT.collectionType.toLowerCase()}/${selectedCategoryName.toLowerCase()}/${trait.tokenId}.png`}
                    alt={trait.name}
                    boxSize="50px"
                    mr={2}
                  />
                  <Text>{trait.name} (x{trait.balance})</Text>
                </Box>
              </Radio>
            ))}
          </SimpleGrid>
        </RadioGroup>
      ) : (
        <Text mb={2}>No traits available.</Text>
      )}
      <Button
        mb={4}
        bg="yellow.500"
        onClick={handleAddTrait}
        isDisabled={!selectedTraitContract || selectedTraitId === null || nftAlreadyHasTrait}
      >
        Add Trait
      </Button>
        <Divider my={4} />

        {/* Remove Trait Section */}
        <Text fontWeight="bold" mb={2}>Remove Trait</Text>
        {selectedNFT ? (() => {
          const removeIndex = TRAIT_CONTRACTS.findIndex(
            (t) => t.address === selectedTraitContract
          );
          const currentTrait = nftOnChainTraits[removeIndex];
          return currentTrait !== undefined && currentTrait !== -1 ? (
            <Box mb={2}>
              <Image
                src={`${TRAIT_BASE_URL}${selectedNFT.collectionType.toLowerCase()}/${selectedCategoryName.toLowerCase()}/${currentTrait}.png`}
                alt={`${selectedCategoryName} trait`}
                width={80}
                height={80}
                borderRadius="md"
              />
            </Box>
          ) : (
            <Text mb={2}>No trait assigned.</Text>
          );
        })() : <Text mb={2}>No NFT selected.</Text>}
        <Button
          bg="red.500"
          onClick={handleRemoveTrait}
          isDisabled={
            !selectedTraitContract ||
            !TRAIT_CONTRACTS.find((t) => t.address === selectedTraitContract)?.removable
          }
        >
          Remove Trait
        </Button>
      </ModalBody>
    </ModalContent>
  </Modal>
        <Modal isOpen={swapTraitsModal.isOpen} onClose={swapTraitsModal.onClose}>
          <ModalOverlay />
          <ModalContent bg="#1A1A1A" color="white">
            <ModalHeader>Swap Traits</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Select
                onChange={(e) => setSelectedSwapCategory(e.target.value)}
                placeholder="Select Category"
              >
                {TRAIT_CONTRACTS.map((t) => (
                  <option key={t.address} value={t.address}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button mt={4} bg="yellow.500" onClick={handleSwapTraits}>
                Swap
              </Button>
            </ModalBody>
          </ModalContent>
        </Modal>
        {renderSetNameModal()}
        {renderSwapModal()}
      </Box>
    </ChakraProvider>
  );
}
