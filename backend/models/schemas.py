from pydantic import BaseModel
from typing import List, Optional

class QueryRequest(BaseModel):
    query: str
    chunks: List[str]
    fileHash: Optional[str] = None

class ExportRequest(BaseModel):
    fileHash: str

class BatchExportRequest(BaseModel):
    fileHashes: List[str]

class BatchSummaryRequest(BaseModel):
    fileHashes: List[str]

class ExplainRequest(BaseModel):
    fileHash: Optional[str] = None
    chunk_index: Optional[int] = None
    text: Optional[str] = None

class RiskAnalyzeRequest(BaseModel):
    fileHash: Optional[str] = None
    chunk_index: Optional[int] = None
    text: Optional[str] = None

class ChatMessageModel(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessageModel]
    chunks: List[str]
    mode: Optional[str] = "document"
    fileHash: Optional[str] = None
    generalKey: Optional[str] = None

class SummaryRequest(BaseModel):
    fileHash: str
