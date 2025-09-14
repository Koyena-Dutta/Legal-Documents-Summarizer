import uuid
import asyncio
import numpy as np
from weasyprint import HTML
from typing import List
from core.config import settings
from datetime import datetime, timedelta, timezone
from services.embedding_service import getEmbeddings
from utils.gcp_clients import executor, generateText, storage_client
from services.rag_service import build_index, search_index

async def queryDocument(query: str, chunks: List[str]):
    async def computeEmbeddings():
        loop = asyncio.get_event_loop()
        queryTask = loop.run_in_executor(executor, getEmbeddings, [query])
        chunksTask = loop.run_in_executor(executor, getEmbeddings, chunks)
        queryEmbList, chunkEmbeddings = await asyncio.gather(queryTask, chunksTask)
        return queryEmbList[0], chunkEmbeddings
    
    queryEmbedding, chunkEmbeddings = await computeEmbeddings()
    if not chunkEmbeddings:
        context = ""
        topKIndices: List[int] = []
    else:
        index = build_index(chunkEmbeddings)
        topKIndices = search_index(index, queryEmbedding, min(3, len(chunks)))
        context = "\n---\n".join([chunks[i] for i in topKIndices])

    prompt = f"""
You are a legal document assistant. Based on the context answer the user's question. If the answer is not in the context, say you don't have enough information.

Context:
{context}

Question:
{query}
"""
    
    loop = asyncio.get_event_loop()
    responseText = await loop.run_in_executor(executor, lambda: generateText(prompt))
    
    return {
        "answer": responseText,
        "model": settings.GENERATION_MODEL_ID,
        "embeddingModel": settings.EMBEDDING_MODEL_ID
    }

async def explainText(text: str):
    prompt = f"Explain this legal clause in simple plain English without giving legal advice:\n\n{text}"
    loop = asyncio.get_event_loop()
    responseText = await loop.run_in_executor(executor, lambda: generateText(prompt))
    return {
        "explanation": responseText,
        "model": settings.GENERATION_MODEL_ID
    }

async def analyzeRiskText(text: str):
    import json

    response_schema = {
        "type": "object",
        "properties": {
            "hasRisk": {"type": "boolean"},
            "analysis": {"type": "string"}
        },
        "required": ["hasRisk", "analysis"],
    }

    prompt = f"""Analyze the following legal text for potential risks.

Text: {text}

- Set hasRisk to true if risks (e.g., indemnity, liability limits, termination, penalties, confidentiality, IP, jurisdiction, payment terms) are present; false otherwise.
- In analysis, provide concise markdown explanation of risks (or "No risks identified." if none). Do not give legal advice."""

    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(executor, lambda: generateText(prompt, response_schema))

    try:
        data = json.loads(raw.strip())
        hasRisk = bool(data.get("hasRisk", False))
        analysis = str(data.get("analysis", "No risks identified in the provided text."))
    except json.JSONDecodeError:
        # if schema fails (rare)
        lower = raw.lower()
        hasRisk = not any(kw in lower for kw in ["no risk", "no risks", "no significant risk", "not risky"])
        analysis = raw or "Analysis unavailable."

    return {
        "hasRisk": hasRisk,
        "analysis": analysis,
        "model": settings.GENERATION_MODEL_ID,
    }

async def exportPdfFromSummary(summaryText: str):
    from markdown import markdown
    summary_html = markdown(summaryText, extensions=['extra'])
    summaryHtml = f"""
    <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }}
                h1 {{ font-size: 24px; margin-bottom: 20px; }}
                div {{ margin-bottom: 15px; }}
                p {{ margin-bottom: 12px; text-align: justify; }}
                ul {{ margin-left: 25px; list-style-type: disc; padding-left: 0; }}
                li {{ margin-bottom: 8px; }}
                strong {{ font-weight: bold; color: #000; }}
            </style>
        </head>
        <body>
            <h1>AI-Generated Summary</h1>
            <p style="color:red; border: 1px solid red; padding: 10px; margin-bottom: 20px;">
                <strong>Disclaimer:</strong> AI-generated summary; not legal advice.
            </p>
            <div>{summary_html}</div>
        </body>
    </html>
    """
    pdf = HTML(string=summaryHtml).write_pdf()
    bucket = storage_client.bucket(settings.BUCKET_NAME)
    pdfBlobName = f"exports/{uuid.uuid4()}-summary.pdf"
    pdfBlob = bucket.blob(pdfBlobName)
    pdfBlob.upload_from_string(pdf, content_type='application/pdf')
    expiration = datetime.now(timezone.utc) + timedelta(hours=1)
    publicUrl = pdfBlob.generate_signed_url(expiration=expiration, method='GET')
    return {"public_url": publicUrl, "blob_name": pdfBlobName}

async def getSignedUrlForBlob(blob_name: str) -> str:
    bucket = storage_client.bucket(settings.BUCKET_NAME)
    pdfBlob = bucket.blob(blob_name)
    expiration = datetime.now(timezone.utc) + timedelta(hours=1)
    return pdfBlob.generate_signed_url(expiration=expiration, method='GET')
