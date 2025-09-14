import numpy as np
from typing import List, Dict
from utils.gcp_clients import embedTexts

_embeddingCache: Dict[str, np.ndarray] = {}

def getEmbeddingsBatch(texts: List[str]) -> List[np.ndarray]:
    if not texts:
        return []
    
    cachedResults = []
    uncachedTexts = []
    uncachedIndices = []
    
    for i, text in enumerate(texts):
        if text in _embeddingCache:
            cachedResults.append((i, _embeddingCache[text]))
        else:
            uncachedTexts.append(text)
            uncachedIndices.append(i)
    
    newEmbeddings: List[np.ndarray] = []
    if uncachedTexts:
        batchSize = 32
        for i in range(0, len(uncachedTexts), batchSize):
            batch = uncachedTexts[i:i+batchSize]
            batchVectors = embedTexts(batch)
            embList = [np.array(v, dtype=np.float32) for v in batchVectors]
            newEmbeddings.extend(embList)
        
        for text, embedding in zip(uncachedTexts, newEmbeddings):
            _embeddingCache[text] = embedding
    
    finalResults: List[np.ndarray] = [np.zeros(1, dtype=np.float32)] * len(texts)
    
    for i, embedding in cachedResults:
        finalResults[i] = embedding
    
    for idx, embedding in zip(uncachedIndices, newEmbeddings):
        finalResults[idx] = embedding
    
    return finalResults

def getEmbeddings(texts: List[str]) -> List[np.ndarray]:
    return getEmbeddingsBatch(texts)

def getEmbeddingCacheInfo():
    return {"embeddings": len(_embeddingCache)}

def clearEmbeddingCache():
    clearedCount = len(_embeddingCache)
    _embeddingCache.clear()
    return {"embeddings": clearedCount}
