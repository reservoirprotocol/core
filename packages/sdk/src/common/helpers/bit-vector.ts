export const getBitVectorCalldataSize = (tokenIds: number[]) => {
  return Math.ceil(tokenIds[tokenIds.length - 1] / 8);
};

export const generateBitVector = (tokenIds: number[]) => {
  tokenIds.sort((a, b) => a - b);

  const numBytes = Math.ceil(tokenIds[tokenIds.length - 1] / 8);
  const result: number[] = [];
  for (let i = 0; i < numBytes; i++) {
    result.push(0);
  }

  for (const tokenId of tokenIds) {
    result[tokenId >> 3] |= 0x80 >> (tokenId & 7);
  }

  return "0x" + result.map((b) => b.toString(16)).join("");
};

export const decomposeBitVector = (bitVector: string) => {
  const result: number[] = [];
  for (let i = 2; i < bitVector.length; i += 2) {
    const byte = parseInt(bitVector[i] + bitVector[i + 1], 16);
    for (let j = 0; j < 8; j++) {
      if (byte & (2 << j)) {
        result.push((i << 3) + j);
      }
    }
  }
  return result;
};
