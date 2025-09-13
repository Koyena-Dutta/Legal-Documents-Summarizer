from typing import List
import numpy as np
import faiss


def _l2_normalize(mat: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    return mat / norms


def build_index(vectors: List[np.ndarray]) -> faiss.Index:
    mat = np.vstack(vectors).astype(np.float32, copy=False)
    mat = _l2_normalize(mat)
    dim = mat.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(mat)
    return index


def search_index(index: faiss.Index, query_vector: np.ndarray, k: int) -> List[int]:
    q = query_vector.astype(np.float32, copy=False)
    q = _l2_normalize(q.reshape(1, -1))
    _, idx = index.search(q, k)
    return idx[0].tolist()
