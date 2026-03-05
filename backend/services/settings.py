from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Azure OpenAI (required)
    azure_openai_endpoint: str = Field(alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_api_key: str = Field(alias="AZURE_OPENAI_API_KEY")
    azure_openai_deployment: str = Field(alias="AZURE_OPENAI_DEPLOYMENT")

    # Azure OpenAI — optional separate deployment for web search calls
    # If not set, AZURE_OPENAI_DEPLOYMENT is used for everything
    azure_openai_search_deployment: str | None = Field(
        default=None, alias="AZURE_OPENAI_SEARCH_DEPLOYMENT"
    )

    # Azure OpenAI API version — must be 2025-01-01-preview or later for web search
    azure_openai_api_version: str = Field(
        default="2025-01-01-preview", alias="AZURE_OPENAI_API_VERSION"
    )

    # Cosmos DB (required)
    cosmos_connection_string: str = Field(alias="COSMOS_CONNECTION_STRING")
    cosmos_db_name: str = Field(alias="COSMOS_DB_NAME")
    cosmos_container_name: str = Field(alias="COSMOS_CONTAINER_NAME")

    # App authentication — set before deploying; leave blank for dev mode
    app_api_key: str | None = Field(default=None, alias="APP_API_KEY")

    # Azure AI Search — optional, enables private uploaded-document search
    azure_search_endpoint: str | None = Field(default=None, alias="AZURE_SEARCH_ENDPOINT")
    azure_search_api_key: str | None = Field(default=None, alias="AZURE_SEARCH_API_KEY")
    azure_search_index_name: str | None = Field(default=None, alias="AZURE_SEARCH_INDEX_NAME")


@lru_cache
def get_settings() -> Settings:
    return Settings()