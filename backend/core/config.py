import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

class Settings(BaseSettings):
    PROJECT_ID: str = os.getenv("PROJECT_ID")
    BUCKET_NAME: str = os.getenv("BUCKET_NAME")
    PROCESSOR_ID: str = os.getenv("PROCESSOR_ID")
    PROCESSOR_LOCATION: str = os.getenv("PROCESSOR_LOCATION")
    EMBEDDING_MODEL_ID: str = os.getenv("EMBEDDING_MODEL_ID", "text-embedding-004")
    GENERATION_MODEL_ID: str = os.getenv("GENERATION_MODEL_ID", "gemini-2.5-flash-lite")
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")

settings = Settings()
