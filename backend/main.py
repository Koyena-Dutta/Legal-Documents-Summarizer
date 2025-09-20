import time
import asyncio
import numpy as np
from io import BytesIO
import os
import tempfile
from pypdf import PdfReader
from typing import List, Dict
from core.config import settings
from fastapi.middleware.cors import CORSMiddleware
from services.embedding_service import getEmbeddings
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from services.retrieval_service import queryDocument, exportPdfFromSummary, explainText
from services.document_service import processDocument, computeFileHash, processDocumentSync
from utils.gcp_clients import executor, generateText, generateSummaryFromFile, getGenaiClient
from models.schemas import QueryRequest, ExportRequest, ExplainRequest, ChatRequest, SummaryRequest, BatchExportRequest, BatchSummaryRequest
import hashlib
import faiss
from services.rag_service import build_index, search_index
from pydantic import BaseModel
from typing import Optional

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

proactiveCache: Dict[str, Dict] = {}
_chatLruOrder: List[str] = []
_CHAT_MAX_ENTRIES = 200

documentStore = {"chunks": [], "embeddings": []}

def _touch_chat_key(key: str):
    # move key to end (most-recent)
    if key in _chatLruOrder:
        _chatLruOrder.remove(key)
    _chatLruOrder.append(key)
    # evict if too many
    while len(_chatLruOrder) > _CHAT_MAX_ENTRIES:
        evict_key = _chatLruOrder.pop(0)
        if evict_key in proactiveCache:
            entry = proactiveCache.get(evict_key)
            if entry and "geminiChat" in entry:
                # drop chat to free memory
                entry.pop("geminiChat", None)
            # if the key is exclusively a general chat entry, clean it entirely
            if evict_key.startswith("__general__:"):
                proactiveCache.pop(evict_key, None)

async def generateSummary(fileHash: str) -> str:
    entry = proactiveCache.get(fileHash) or {}
    file_bytes = entry.get("fileContent")
    print(f"[SUMMARY] Called for fileHash: {fileHash}")
    if not file_bytes:
        print(f"[SUMMARY] No file bytes found for {fileHash}")
        raise Exception("Original file not available for summary generation")

    print(f"Starting summary generation using uploaded file for hash: {fileHash[:8]}")
    prompt = (
        "Summarize the key points of this document using markdown format. Do not mention this in your response "
        "Use bullet points (- or *) on new lines for each key point. "
        "Use bold (**text**) for important terms like names, amounts, dates. "
        "Group into sections with headings if appropriate. "
        "Use paragraphs for descriptions. "
        "Avoid legal advice. Focus on sections, obligations, timelines, parties, risks, and notable clauses."
    )
    loop = asyncio.get_event_loop()

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(entry.get("fileName", ".pdf"))[1]) as temp_file:
        temp_file.write(file_bytes)
        temp_path = temp_file.name

    try:
        responseText = await asyncio.wait_for(
            loop.run_in_executor(
                executor,
                lambda: generateSummaryFromFile(temp_path, prompt),
            ),
            timeout=60.0,
        )
        print(
            f"Summary generated successfully: {len(responseText) if responseText else 0} chars"
        )
        return responseText
    except asyncio.TimeoutError:
        print("Summary generation timed out after 60 seconds")
        raise Exception("Summary generation timed out. Please try again.")
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        raise e
    finally:
        os.unlink(temp_path)

async def runProactiveProcessing(fileHash: str, redFlags: List[Dict]):
    entry = proactiveCache.get(fileHash) or {}
    entry.setdefault("summary", None)
    entry.setdefault("explanations", {})
    entry.setdefault("exportBlob", None)
    proactiveCache[fileHash] = entry

    print(f"[PROACTIVE] Starting summary generation for {fileHash}")
    summary_task = asyncio.create_task(generateSummary(fileHash))

    idxMap: List[int] = []
    explain_tasks: List[asyncio.Future] = []
    for rf in redFlags:
        raw_idx = rf.get("chunk_index")
        if raw_idx is None:
            continue
        try:
            idx = int(raw_idx)
        except Exception:
            continue
        idxMap.append(idx)
        explain_tasks.append(asyncio.create_task(explainText(rf.get("text", ""))))

    explain_results = []
    if explain_tasks:
        explain_results = await asyncio.gather(*explain_tasks, return_exceptions=True)

    
    summaryResult = await summary_task
    print(f"[PROACTIVE] Summary result for {fileHash}: {summaryResult}")
    if isinstance(summaryResult, Exception):
        print(f"[PROACTIVE] Error generating summary for {fileHash}: {summaryResult}")
        entry["summaryError"] = str(summaryResult)
    else:
        entry["summary"] = summaryResult
        print(f"[PROACTIVE] Summary stored for {fileHash}")

    explanations: Dict[int, str] = {}
    errors: Dict[int, str] = {}
    for idx, res in zip(idxMap, explain_results):
        if isinstance(res, Exception):
            errors[idx] = str(res)
        else:
            exp_val = res.get("explanation") if isinstance(res, dict) else str(res)
            explanations[idx] = str(exp_val) if exp_val is not None else ""

    if explanations:
        entry["explanations"] = {**entry.get("explanations", {}), **explanations}
    if errors:
        entry["explanationsErrors"] = errors
    proactiveCache[fileHash] = entry

def findCacheKeyForChunks(chunks: List[str]):
    for fh, entry in proactiveCache.items():
        if entry.get("chunks") == chunks and entry.get("vectorIndex") is not None:
            return fh
    return None

async def streamChatGenerator(messages, chunks: List[str], mode: str = "document", general_key: str | None = None):
    last = messages[-1]
    query = last.content

    client = getGenaiClient()

    if mode == "general":
        prompt = f"""
You are a helpful lawyer. Have a natural conversation with the user.

User Question:
{query}

Respond naturally and conversationally.
"""
        chat = None
        if general_key:
            cacheKey = f"__general__:{general_key}"
            genEntry = proactiveCache.get(cacheKey) or {}
            chat = genEntry.get("geminiChat")
            if chat is None:
                chat = client.chats.create(model=settings.GENERATION_MODEL_ID)
                genEntry["geminiChat"] = chat
                proactiveCache[cacheKey] = genEntry
            _touch_chat_key(cacheKey)
        if chat is None:
            chat = client.chats.create(model=settings.GENERATION_MODEL_ID)
    else:
        fh = findCacheKeyForChunks(chunks)
        if fh:
            loop = asyncio.get_event_loop()
            queryEmbList = await loop.run_in_executor(executor, getEmbeddings, [query])
            queryVec = queryEmbList[0]
            index: faiss.Index = proactiveCache[fh]["vectorIndex"]
            topKIndices = search_index(index, queryVec, min(3, len(chunks)))
        else:
            loop = asyncio.get_event_loop()
            queryEmbList = await loop.run_in_executor(executor, getEmbeddings, [query])
            chunkEmbs = await loop.run_in_executor(executor, getEmbeddings, chunks)
            if not chunkEmbs:
                topKIndices = []
            else:
                index = build_index(chunkEmbs)
                topKIndices = search_index(index, queryEmbList[0], min(3, len(chunks)))
        
        context = "\n\n".join([chunks[i] for i in topKIndices]) if topKIndices else ""
        prompt = f"""
You are a legal document analysis assistant.

Document Context:
{context}

User Question: {query}

Guidelines:
- Use the document context strictly for questions about the document's content. If an answer is not present in the context, state that it is not available in the provided context.
- Use the conversation history to answer meta-questions about this chat (e.g., what was the previous response, what did I ask before, summarize your last answer).
- For greetings or general conversational turns, respond briefly and continue the conversation.
- Be concise and precise in your legal analysis and do not fabricate facts outside the provided document context.
"""
        chat = None
        if fh:
            entry = proactiveCache.get(fh) or {}
            chat = entry.get("geminiChat")
            if chat is None:
                chat = client.chats.create(model=settings.GENERATION_MODEL_ID)
                entry["geminiChat"] = chat
                proactiveCache[fh] = entry
            _touch_chat_key(fh)
        else:
            docKey = "__doc__:" + hashlib.sha256("||".join(chunks).encode("utf-8")).hexdigest()
            entry = proactiveCache.get(docKey) or {}
            chat = entry.get("geminiChat")
            if chat is None:
                chat = client.chats.create(model=settings.GENERATION_MODEL_ID)
                entry["geminiChat"] = chat
                proactiveCache[docKey] = entry
            _touch_chat_key(docKey)

    for chunk in chat.send_message_stream(prompt):
        text = getattr(chunk, "text", None)
        if text:
            yield text.encode("utf-8")

@app.post("/upload")
async def uploadDocument(file: UploadFile = File(...), backgroundTasks: BackgroundTasks = None):
    global documentStore
    documentStore = {"chunks": [], "embeddings": []}

    startTime = time.time()
    contents = await file.read()
    fileHash = computeFileHash(contents)

    entry = proactiveCache.get(fileHash) or {}
    entry["fileContent"] = contents
    entry["fileContentType"] = file.content_type
    entry["fileName"] = file.filename
    proactiveCache[fileHash] = entry

    pageCount = 0
    if file.content_type in ("application/pdf", "application/x-pdf", "application/acrobat"):
        try:
            reader = PdfReader(BytesIO(contents))
            pageCount = len(reader.pages)
        except Exception:
            pageCount = 0

    if pageCount and pageCount <= 15:
        cacheData, cacheHit = await processDocumentSync(contents, file.content_type, file.filename)
        documentStore["chunks"] = cacheData["chunks"]
        documentStore["embeddings"] = cacheData["embeddings"]
        embeddingsList = cacheData["embeddings"]
        if embeddingsList:
            index = build_index(embeddingsList)
            entry = proactiveCache.get(fileHash) or {}
            entry["vectorIndex"] = index
            entry["chunks"] = cacheData["chunks"]
            proactiveCache[fileHash] = entry
        if backgroundTasks is not None:
            backgroundTasks.add_task(runProactiveProcessing, fileHash, cacheData["redFlags"])
        else:
            asyncio.create_task(runProactiveProcessing(fileHash, cacheData["redFlags"]))
    else:
        cacheData, cacheHit = await processDocument(contents, file.content_type, file.filename)
        documentStore["chunks"] = cacheData["chunks"]
        documentStore["embeddings"] = cacheData["embeddings"]
        embeddingsList = cacheData["embeddings"]
        if embeddingsList:
            index = build_index(embeddingsList)
            entry = proactiveCache.get(fileHash) or {}
            entry["vectorIndex"] = index
            entry["chunks"] = cacheData["chunks"]
            proactiveCache[fileHash] = entry
        if backgroundTasks is not None:
            backgroundTasks.add_task(runProactiveProcessing, fileHash, cacheData["redFlags"])
        else:
            asyncio.create_task(runProactiveProcessing(fileHash, cacheData["redFlags"]))
    
    totalTime = time.time() - startTime

    return JSONResponse(content={
        "text": cacheData["text"],
        "chunks": cacheData["chunks"],
        "red_flags": cacheData["redFlags"],
        "processingTime": f"{totalTime:.2f}s",
        "cacheHit": cacheHit,
        "file_hash": fileHash,
        "pageCount": pageCount or None,
        "path": "fast" if pageCount and pageCount <= 15 else "robust"
    })

# helper background task
async def generateSummary(fileHash: str, text: str):
    # 👉 replace this with your actual LLM summarizer
    summary = f"Auto-summary for document {fileHash} ({len(text.split())} words)"
    entry = proactiveCache.get(fileHash, {})
    entry["summary"] = summary
    proactiveCache[fileHash] = entry
    print(f"✅ Summary ready for {fileHash}")
@app.post("/query")
async def queryEndpoint(request: QueryRequest):
    startTime = time.time()
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="No query provided")
    
    if not request.chunks:
        raise HTTPException(status_code=400, detail="No document chunks provided")

    def findCacheKeyForChunks(chunks: List[str]):
        for fh, entry in proactiveCache.items():
            if entry.get("chunks") == chunks and entry.get("vectorIndex") is not None:
                return fh
        return None

    fh = findCacheKeyForChunks(request.chunks)
    if fh:
        loop = asyncio.get_event_loop()
        queryEmbList = await loop.run_in_executor(executor, getEmbeddings, [request.query])
        queryVec = queryEmbList[0]
        index: faiss.Index = proactiveCache[fh]["vectorIndex"]
        topKIndices = search_index(index, queryVec, min(3, len(request.chunks)))
        context = "\n---\n".join([request.chunks[i] for i in topKIndices])
        prompt = f"""
You are a legal document assistant. Based on the context answer the user's question. If the answer is not in the context, say you don't have enough information.

Context:
{context}

Question:
{request.query}

Be precise and helpful in your legal analysis.
"""
        response = await loop.run_in_executor(executor, lambda: generateText(prompt))
        totalTime = time.time() - startTime
        return JSONResponse(content={
            "answer": response,
            "model": settings.GENERATION_MODEL_ID,
            "embeddingModel": settings.EMBEDDING_MODEL_ID,
            "processingTime": f"{totalTime:.2f}s"
        })

    result = await queryDocument(request.query, request.chunks)
    totalTime = time.time() - startTime
    return JSONResponse(content={
        **result,
        "processingTime": f"{totalTime:.2f}s"
    })

@app.post("/export")
async def exportEndpoint(request: ExportRequest):
    fh = request.fileHash
    cacheEntry = proactiveCache.get(fh)
    
    if not cacheEntry or not cacheEntry.get("summary"):
        try:
            summary = await generateSummary(fh)
            if not cacheEntry:
                cacheEntry = proactiveCache.setdefault(fh, {})
            cacheEntry["summary"] = summary
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

    if cacheEntry.get("exportBlob"):
        from services.retrieval_service import getSignedUrlForBlob
        url = await getSignedUrlForBlob(cacheEntry["exportBlob"])
        return JSONResponse(content={"public_url": url, "blob_name": cacheEntry["exportBlob"]})

    result = await exportPdfFromSummary(cacheEntry["summary"])
    cacheEntry["exportBlob"] = result.get("blob_name")
    proactiveCache[fh] = cacheEntry
    return JSONResponse(content={"public_url": result.get("public_url"), "blob_name": result.get("blob_name")})

@app.post("/export/batch")
async def exportBatchEndpoint(request: BatchExportRequest):
    from services.retrieval_service import getSignedUrlForBlob
    results = []
    for fh in request.fileHashes:
        cacheEntry = proactiveCache.get(fh)
        if not cacheEntry or not cacheEntry.get("summary"):
            try:
                summary = await generateSummary(fh)
                if not cacheEntry:
                    cacheEntry = proactiveCache.setdefault(fh, {})
                cacheEntry["summary"] = summary
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to generate summary for {fh[:8]}: {str(e)}")
        if cacheEntry.get("exportBlob"):
            url = await getSignedUrlForBlob(cacheEntry["exportBlob"])
            results.append({"fileHash": fh, "public_url": url, "blob_name": cacheEntry["exportBlob"]})
            continue
        exportRes = await exportPdfFromSummary(cacheEntry["summary"])
        cacheEntry["exportBlob"] = exportRes.get("blob_name")
        proactiveCache[fh] = cacheEntry
        results.append({"fileHash": fh, "public_url": exportRes.get("public_url"), "blob_name": exportRes.get("blob_name")})
    return JSONResponse(content={"results": results})


class ExplainRequest(BaseModel):
    fileHash: Optional[str] = None
    chunk_index: Optional[int] = None
    text: Optional[str] = None
    role: Optional[str] = "Neutral"   # 👈 NEW

@app.post("/explain")
async def explainEndpoint(request: ExplainRequest):
    if request.fileHash and request.chunk_index is not None:
        fh = request.fileHash
        idx = int(request.chunk_index)
        cacheEntry = proactiveCache.get(fh)
        if cacheEntry and idx in cacheEntry.get("explanations", {}):
            return JSONResponse(content={"explanation": cacheEntry["explanations"][idx]})
        raise HTTPException(status_code=404, detail="Explanation not ready or does not exist.")
    
    if request.text and request.text.strip():
        try:
            role = request.role or "Neutral"
            # Infuse role into the prompt
            prompt = (
                f"Explain this clause from the perspective of a {role}. "
                f"What are the risks, obligations, and implications for them?\n\n"
                f"Clause: {request.text}"
            )
            result = await explainText(prompt)
            return JSONResponse(content=result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating explanation: {str(e)}")
    
    raise HTTPException(status_code=400, detail="Invalid request parameters")

@app.post("/summary")
async def summaryEndpoint(request: SummaryRequest):
    fh = request.fileHash
    cacheEntry = proactiveCache.get(fh)
    if cacheEntry and cacheEntry.get("summary"):
        return JSONResponse(content={"summary": cacheEntry["summary"]})
    raise HTTPException(status_code=404, detail="Summary not ready or does not exist.")

@app.post("/summary/batch")
async def batchSummaryEndpoint(request: BatchSummaryRequest):
    results = {}
    for fh in request.fileHashes:
        entry = proactiveCache.get(fh)
        if entry and entry.get("summary"):
            results[fh] = entry["summary"]
    return JSONResponse(content={"summaries": results})

@app.post("/summary/status")
async def summaryStatusEndpoint(hashes: List[str]):
    status = {fh: bool(proactiveCache.get(fh, {}).get("summary")) for fh in hashes}
    return JSONResponse(content={"status": status})

@app.post("/chat")
async def chatEndpoint(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")
    last = request.messages[-1]
    if last.role != 'user':
        raise HTTPException(status_code=400, detail="Last message must be from user")
    
    if request.mode == "document" and not request.chunks:
        raise HTTPException(status_code=400, detail="No document chunks provided for document mode")
    
    general_key = request.generalKey if request.mode == "general" else None

    return StreamingResponse(
        streamChatGenerator(
            request.messages,
            request.chunks or [],
            request.mode or "document",
            general_key
        ), 
        media_type="text/plain"
    )

@app.get("/")
def readRoot():
    return {"Hello": "Legal Lens Backend"}

from services.retrieval_service import analyzeRiskText
from models.schemas import RiskAnalyzeRequest

@app.post("/risk/analyze")
async def riskAnalyzeEndpoint(request: RiskAnalyzeRequest):
    # Priority: explicit text -> (fileHash+chunk) -> error
    target_text = None
    if request.text and request.text.strip():
        target_text = request.text.strip()
    elif request.fileHash and request.chunk_index is not None:
        entry = proactiveCache.get(request.fileHash)
        try:
            idx = int(request.chunk_index)
        except Exception:
            idx = None
        if entry and idx is not None and 0 <= idx < len(entry.get("chunks", []) or []):
            target_text = entry["chunks"][idx]
    if not target_text:
        raise HTTPException(status_code=400, detail="No text provided for risk analysis")
    try:
        result = await analyzeRiskText(target_text)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk analysis failed: {str(e)}")


