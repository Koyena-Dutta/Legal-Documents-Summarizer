import re
import uuid
import asyncio
import hashlib
import pickle
from core.config import settings
from fastapi import HTTPException
from google.cloud import documentai
from typing import List, Dict, Any, Optional
from google.cloud.documentai_v1.types import document
from services.embedding_service import getEmbeddings, _embeddingCache
from utils.gcp_clients import storage_client, documentai_client, executor

documentCache: Dict[str, Dict] = {}

def computeFileHash(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()

async def saveDocumentCacheToGcs(fileHash: str, documentData: Dict):
    loop = asyncio.get_event_loop()
    
    def _save():
        try:
            bucket = storage_client.bucket(settings.BUCKET_NAME)
            cacheBlobName = f"document_cache/{fileHash}.pkl"
            cacheBlob = bucket.blob(cacheBlobName)
            
            serializedData = pickle.dumps(documentData)
            cacheBlob.upload_from_string(serializedData, content_type='application/octet-stream')
            print(f"Cached document data for hash {fileHash[:8]}...")
        except Exception as e:
            print(f"Failed to cache document: {e}")
    
    await loop.run_in_executor(executor, _save)

async def loadDocumentCacheFromGcs(fileHash: str) -> Optional[Dict]:
    loop = asyncio.get_event_loop()
    
    def _load():
        try:
            bucket = storage_client.bucket(settings.BUCKET_NAME)
            cacheBlobName = f"document_cache/{fileHash}.pkl"
            cacheBlob = bucket.blob(cacheBlobName)
            
            if not cacheBlob.exists():
                return None
                
            serializedData = cacheBlob.download_as_bytes()
            documentData = pickle.loads(serializedData)
            print(f"Loaded cached document for hash {fileHash[:8]}...")
            return documentData
        except Exception as e:
            print(f"Failed to load cached document: {e}")
            return None
    
    return await loop.run_in_executor(executor, _load)

async def cleanupGcsAsync(blob, blobList):
    loop = asyncio.get_event_loop()
    
    def _cleanup():
        try:
            blob.delete()
            for b in blobList:
                b.delete()
        except Exception as e:
            print(f"Cleanup warning: {e}")
    
    await loop.run_in_executor(executor, _cleanup)

RISKY_KEYWORDS = [
    "indemnity", "liability", "auto-renewal", "terminate for convenience",
    "without cause", "waiver", "limitation of liability", "exclusive jurisdiction"
]

RISKY_PATTERNS = [re.compile(r'\b' + keyword + r'\b', re.IGNORECASE) for keyword in RISKY_KEYWORDS]

async def findRedFlagsAsync(chunks: List[str]) -> List[Dict[str, Any]]:
    loop = asyncio.get_event_loop()
    
    def _findRedFlags():
        redFlags = []
        for i, chunk in enumerate(chunks):
            for j, pattern in enumerate(RISKY_PATTERNS):
                if pattern.search(chunk):
                    redFlags.append({
                        "chunk_index": i, 
                        "keyword": RISKY_KEYWORDS[j], 
                        "text": chunk
                    })
                    break
        return redFlags
    
    return await loop.run_in_executor(executor, _findRedFlags)

async def processDocumentSync(fileContent: bytes, fileContentType: str, fileFilename: str):
    fileHash = computeFileHash(fileContent)
    print(f"Processing (sync) file with hash: {fileHash[:8]}...")
    
    if fileHash in documentCache:
        print(f"Found document in memory cache!")
        return documentCache[fileHash], "memory"
    
    print(f"Checking GCS cache for document...")
    cachedData = await loadDocumentCacheFromGcs(fileHash)
    
    if cachedData:
        print(f"Found document in GCS cache!")
        documentCache[fileHash] = cachedData
        return cachedData, "gcs"

    processorName = f"projects/{settings.PROJECT_ID}/locations/{settings.PROCESSOR_LOCATION}/processors/{settings.PROCESSOR_ID}"
    rawDocument = documentai.RawDocument(content=fileContent, mime_type=fileContentType)
    request = documentai.ProcessRequest(name=processorName, raw_document=rawDocument)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, lambda: documentai_client.process_document(request=request))
    docProto = result.document
    fullText = docProto.text or ""

    print(f"DocumentAI Response Analysis:")
    print(f"Full text length: {len(fullText)}")
    print(f"Number of pages: {len(docProto.pages)}")
    
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = splitter.split_text(fullText)
    chunks = [chunk.strip() for chunk in chunks if len(chunk.strip()) > 20]

    print(f"Total chunks extracted using langchain: {len(chunks)}")
    if chunks:
        print(f"Sample chunk: {chunks[0][:100]}...")
    else:
        print(f"No chunks extracted from full text.")
        chunks = [fullText[:1200]] if fullText else []

    async def processChunks():
        loop = asyncio.get_event_loop()
        embeddingsFuture = loop.run_in_executor(executor, getEmbeddings, chunks)
        redFlagsCoro = findRedFlagsAsync(chunks)
        embeddings, redFlags = await asyncio.gather(embeddingsFuture, redFlagsCoro)
        return embeddings, redFlags

    embeddings, redFlags = await processChunks()

    cacheData = {
        "text": fullText,
        "chunks": chunks,
        "embeddings": embeddings,
        "redFlags": redFlags
    }
    
    documentCache[fileHash] = cacheData
    asyncio.create_task(saveDocumentCacheToGcs(fileHash, cacheData))
    return cacheData, "none"

async def processDocument(fileContent: bytes, fileContentType: str, fileFilename: str):
    fileHash = computeFileHash(fileContent)
    print(f"Processing file with hash: {fileHash[:8]}...")
    
    if fileHash in documentCache:
        print(f"Found document in memory cache!")
        return documentCache[fileHash], "memory"
    
    print(f"Checking GCS cache for document...")
    cachedData = await loadDocumentCacheFromGcs(fileHash)
    
    if cachedData:
        print(f"Found document in GCS cache!")
        documentCache[fileHash] = cachedData
        return cachedData, "gcs"
    
    print(f"No cache hit. Processing document from scratch...")
    fileId = str(uuid.uuid4())

    async def uploadToGcs():
        loop = asyncio.get_event_loop()
        bucket = storage_client.bucket(settings.BUCKET_NAME)
        gcsInputUri = f"uploads/{fileId}-{fileFilename}"
        blob = bucket.blob(gcsInputUri)
        await loop.run_in_executor(executor, blob.upload_from_string, fileContent, fileContentType)
        return gcsInputUri, blob

    uploadTask = asyncio.create_task(uploadToGcs())
    
    processorName = f"projects/{settings.PROJECT_ID}/locations/{settings.PROCESSOR_LOCATION}/processors/{settings.PROCESSOR_ID}"
    
    gcsInputUri, blob = await uploadTask
    
    gcsDocument = documentai.GcsDocument(
        gcs_uri=f"gs://{settings.BUCKET_NAME}/{gcsInputUri}",
        mime_type=fileContentType,
    )
    batchInputConfig = documentai.BatchDocumentsInputConfig(
        gcs_documents=documentai.GcsDocuments(documents=[gcsDocument])
    )
    gcsOutputUri = f"gs://{settings.BUCKET_NAME}/ocr_results/{fileId}/"
    outputConfig = documentai.DocumentOutputConfig(gcs_output_config={"gcs_uri": gcsOutputUri})
    request = documentai.BatchProcessRequest(
        name=processorName,
        input_documents=batchInputConfig,
        document_output_config=outputConfig,
    )

    operation = documentai_client.batch_process_documents(request)
    print(f"Started Document AI batch operation: {operation.operation.name}")
    
    # timeout for large documents
    try:
        operation.result(timeout=1200)  # 20 minutes timeout
        print("Document AI batch operation finished successfully.")
    except Exception as e:
        print(f"Document AI operation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

    async def fetchAndProcess():
        loop = asyncio.get_event_loop()
        
        def _fetchResults():
            match = re.match(r"gs://([^/]+)/(.+)", gcsOutputUri)
            if not match:
                raise HTTPException(status_code=500, detail=f"Invalid GCS output URI format: {gcsOutputUri}")
            outputBucketName = match.group(1)
            prefix = match.group(2)
            outputBucket = storage_client.get_bucket(outputBucketName)
            blobList = list(outputBucket.list_blobs(prefix=prefix))
            
            if not blobList:
                raise HTTPException(status_code=500, detail="Document AI output not found in GCS.")
            
            documentJsonBlob = next((b for b in blobList if b.name.endswith('.json')), None)
            if not documentJsonBlob:
                raise HTTPException(status_code=500, detail="Document AI JSON output not found.")
            
            return blobList, documentJsonBlob
        
        blobList, documentJsonBlob = await loop.run_in_executor(executor, _fetchResults)
        
        jsonString = await loop.run_in_executor(executor, documentJsonBlob.download_as_string)
        docProto = document.Document.from_json(jsonString)
        
        return blobList, docProto

    blobList, docProto = await fetchAndProcess()
    fullText = docProto.text

    print(f"DocumentAI Response Analysis (Async):")
    print(f"Full text length: {len(fullText)}")
    print(f"Number of pages: {len(docProto.pages)}")
    
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = splitter.split_text(fullText)
    chunks = [chunk.strip() for chunk in chunks if len(chunk.strip()) > 20]

    print(f"Total chunks extracted using langchain: {len(chunks)}")
    if chunks:
        print(f"Sample chunk: {chunks[0][:100]}...")
    else:
        print(f"No chunks extracted from full text.")
        chunks = [fullText[:1200]] if fullText else []

    async def processChunks():
        loop = asyncio.get_event_loop()
        embeddingsFuture = loop.run_in_executor(executor, getEmbeddings, chunks)
        
        redFlagsCoro = findRedFlagsAsync(chunks)
        cleanupCoro = cleanupGcsAsync(blob, blobList)
        
        embeddings, redFlags, _ = await asyncio.gather(
            embeddingsFuture, redFlagsCoro, cleanupCoro
        )
        
        return embeddings, redFlags

    embeddings, redFlags = await processChunks()

    cacheData = {
        "text": fullText,
        "chunks": chunks,
        "embeddings": embeddings,
        "redFlags": redFlags
    }
    
    documentCache[fileHash] = cacheData
    
    asyncio.create_task(saveDocumentCacheToGcs(fileHash, cacheData))

    return cacheData, "none"

def getCacheInfo():
    return {
        "embeddings": len(_embeddingCache),
        "documentsMemory": len(documentCache),
        "memoryCacheKeys": list(documentCache.keys())[:3] if documentCache else []
    }

def clearCache():
    global _embeddingCache, documentCache
    
    embeddingCount = len(_embeddingCache)
    documentCount = len(documentCache)
    
    _embeddingCache.clear()
    documentCache.clear()
    
    return {
        "embeddings": embeddingCount,
        "documents": documentCount
    }
