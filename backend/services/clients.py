from typing import Any

import httpx
from azure.cosmos import CosmosClient, ContainerProxy

from backend.services.settings import Settings


class AzureOpenAIService:
    def __init__(self, settings: Settings) -> None:
        self._endpoint = settings.azure_openai_endpoint.rstrip("/")
        self._api_key = settings.azure_openai_api_key
        self._deployment = settings.azure_openai_deployment

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        url = (
            f"{self._endpoint}/openai/deployments/{self._deployment}"
            "/chat/completions?api-version=2024-02-15-preview"
        )
        headers = {"api-key": self._api_key, "Content-Type": "application/json"}
        payload = {"messages": messages, "temperature": temperature}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()


class CosmosService:
    def __init__(self, settings: Settings) -> None:
        self._client = CosmosClient.from_connection_string(settings.cosmos_connection_string)

    def container(self, database_id: str, container_id: str) -> ContainerProxy:
        db = self._client.get_database_client(database_id)
        return db.get_container_client(container_id)


def get_openai_service(settings: Settings) -> AzureOpenAIService:
    return AzureOpenAIService(settings)


def get_cosmos_service(settings: Settings) -> CosmosService:
    return CosmosService(settings)
