from google import genai
import concurrent.futures
from core.config import settings
from google.cloud import storage, documentai
from google.api_core.client_options import ClientOptions

executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

clientOptions = ClientOptions(api_endpoint=f"{settings.PROCESSOR_LOCATION}-documentai.googleapis.com")
documentai_client = documentai.DocumentProcessorServiceClient(client_options=clientOptions)
storage_client = storage.Client()
_genaiClient = genai.Client(api_key=settings.GEMINI_API_KEY)


def getGenaiClient() -> genai.Client:
    return _genaiClient


def generateText(prompt: str, response_schema: dict | None = None) -> str:
    config = {}
    if response_schema:
        config = {
            "response_mime_type": "application/json",
            "response_schema": response_schema
        }
    
    resp = _genaiClient.models.generate_content(
        model=settings.GENERATION_MODEL_ID,
        contents=prompt,
        config=config
    )
    return resp.text


def embedTexts(texts: list[str]) -> list[list[float]]:
    resp = _genaiClient.models.embed_content(
        model=settings.EMBEDDING_MODEL_ID,
        contents=texts,
    )
    return [emb.values for emb in resp.embeddings]


def generateSummaryFromFile(file_path: str, prompt: str) -> str:
    uploaded = _genaiClient.files.upload(file=file_path)
    resp = _genaiClient.models.generate_content(
        model=settings.GENERATION_MODEL_ID,
        contents=[uploaded, prompt],
    )
    return resp.text
