import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.env import load_environment
from backend.routes import health, decision

load_environment()

app = FastAPI(title="AI Decision Engine", version="0.1.0")

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Set CORS_ALLOWED_ORIGINS in your .env as a comma-separated list of the
# exact frontend origins you want to allow. Examples:
#
#   Local dev:   CORS_ALLOWED_ORIGINS=http://localhost:3000
#   Production:  CORS_ALLOWED_ORIGINS=https://yourdomain.com
#   Both:        CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
#
# If the variable is not set, defaults to localhost:3000 for dev convenience.
# The old allow_origins=["*"] is intentionally removed — it allowed any website
# on the internet to call this API and generate Azure OpenAI costs.
# ---------------------------------------------------------------------------

_raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)

app.include_router(health.router)
app.include_router(decision.router, prefix="/api")