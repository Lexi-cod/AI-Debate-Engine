import os

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from backend.services.settings import Settings, get_settings

# ---------------------------------------------------------------------------
# API-key authentication
# ---------------------------------------------------------------------------
# The client must pass the key in the  X-API-Key  request header.
# Set  APP_API_KEY  in your .env (or Azure App Service config).
# If the env var is absent the app starts in DEVELOPMENT MODE — all requests
# are allowed and a warning is logged.  Never deploy without setting this.
# ---------------------------------------------------------------------------

_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(
    api_key: str | None = Security(_API_KEY_HEADER),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    FastAPI dependency — raises 401 if the request does not supply a valid key.
    Attach to any router or individual route with:

        @router.post("/decision", dependencies=[Depends(verify_api_key)])

    or at router level:

        router = APIRouter(dependencies=[Depends(verify_api_key)])
    """
    expected = getattr(settings, "app_api_key", None) or os.getenv("APP_API_KEY", "").strip()

    if not expected:
        # Dev-mode: no key configured — allow all traffic but warn loudly.
        import warnings
        warnings.warn(
            "APP_API_KEY is not set. Running in unauthenticated development mode. "
            "Set APP_API_KEY in your .env before deploying.",
            stacklevel=2,
        )
        return

    if not api_key or api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key. Supply a valid X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )