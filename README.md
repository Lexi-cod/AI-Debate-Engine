# Decision Arena — AI Decision Support System

> **Stop spending hours researching. Start deciding.**

Whether you are figuring out a personal life choice or a million-dollar corporate strategy, every decision deserves more than a gut feeling. Decision Arena puts two independent AI agents head-to-head in a live debate, then brings in a third Judge AI to evaluate both sides and deliver a structured verdict with confidence scores, risk breakdown and a clear suggested action.

### Why is this different from just asking an AI?

Most AI tools give you one perspective, a single model generating both sides of an argument from the same weights, the same bias, the same blind spots. Decision Arena is different.

Two fully independent agents are deployed with opposing mandates, one is hardwired to argue **for**, the other is hardwired to argue **against**. They do not share context. They do not agree. They fight. A separate Judge agent then steps in, with no stake in either side, to evaluate both arguments on logical coherence, evidence strength and relevance before reaching a verdict.

The result is a decision process that mirrors how the best human teams actually work: structured debate, adversarial challenge, independent review — compressed into seconds instead of hours. Every decision is saved to history so you can revisit your reasoning, track patterns and build a personal or team decision log over time.

---

## Screenshots

**Live Debate — Nvidia Stock Decision (Proceed ✅)**
![Nvidia Stock Decision](demo_2_nvidia_results.png)

**Google Stocks — Debate Running**
![Google Stocks](demo_1_google_stocks.png)

**Document Upload — Business Plan Analysis (Do Not Proceed ❌)**
![Document Upload](demo_4_document_upload.png)

**Startup vs Stable Job — Deep Debate**
![Startup Decision](demo_3_startup_job.png)

**Quick 1-Round Decision**
![Simple Decision](demo_5_simple_decision.png)


---

## How It Works

```
User Question + Documents
        ↓
   Input Analysis          ← understands the question, decides if web search needed
        ↓
   Web Retrieval           ← live web search for relevant context (if required)
        ↓
   Multi-Round Debate      ← Agent A (for) vs Agent B (against), 1–4 rounds
        ↓
   Judge AI                ← evaluates both sides, picks winner with confidence score
        ↓
   Decision Summary        ← executive summary, key risks, opportunities & action
        ↓
   Saved to Cosmos DB      ← every decision stored and retrievable
        ↓
   React Dashboard         ← results, history and analytics visualised
```

---

## Tech Stack

**Backend**
- **FastAPI** — async REST API
- **Azure OpenAI (GPT-4.1)** — LLM for all agents, judge and summary
- **Azure OpenAI Web Search** — live web retrieval grounded in the query
- **Azure AI Search** — private document index for RAG
- **Azure Cosmos DB** — stores all decisions and debate transcripts
- **httpx** — async HTTP client

**Frontend**
- **React** — single component file (`UI.jsx`)
- **Recharts** — decision analytics (line, pie, radar charts)
- **Vite** — frontend build tool (also CRA compatible)

---

## Project Structure

```
SEP/
├── backend/
│   ├── db/
│   │   └── cosmos.py               # Cosmos DB connection
│   ├── models/
│   │   └── decision.py             # Pydantic response models
│   ├── routes/
│   │   ├── decision.py             # Main decision endpoint
│   │   └── health.py               # Health check endpoint
│   ├── services/
│   │   ├── analyzer_service.py     # Analyses and classifies user input
│   │   ├── azure_search_service.py # Private document search (RAG)
│   │   ├── clients.py              # Shared service clients
│   │   ├── db_service.py           # Cosmos DB read/write
│   │   ├── debate_service.py       # Multi-round agent debate logic
│   │   ├── document_service.py     # Parses uploaded files
│   │   ├── judge_service.py        # Evaluates debate and picks winner
│   │   ├── openai_service.py       # Azure OpenAI wrapper (LLM + web search)
│   │   ├── retrieval_service.py    # Web context fetching
│   │   ├── settings.py             # App settings
│   │   └── summary_service.py      # Generates executive summary
│   ├── dependencies.py             # API key auth dependency
│   └── env.py                      # Loads .env into environment
├── src/                            # Frontend source
├── public/                         # Static assets
├── scripts/                        # Utility scripts
├── main.py                         # FastAPI app entry point + CORS config
├── UI.jsx                          # React frontend component
├── vite.config.js                  # Frontend build config
├── package.json                    # Frontend dependencies
├── requirements.txt                # Python dependencies
├── .env.example                    # Template — copy to .env and fill in
└── .gitignore
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Azure account with OpenAI, Cosmos DB and AI Search resources

---

### Backend Setup

**1. Clone the repo**
```bash
git clone <your-repo-url>
cd SEP
```

**2. Create a virtual environment**
```bash
python -m venv .venv
source .venv/bin/activate       # Mac/Linux
.venv\Scripts\activate          # Windows
```

**3. Install Python dependencies**
```bash
pip install -r requirements.txt
```

**4. Configure environment variables**
```bash
cp .env.example .env
```

Open `.env` and fill in your Azure credentials:

```env
# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small

# Cosmos DB
COSMOS_CONNECTION_STRING=your-connection-string
COSMOS_DB_NAME=your-db-name
COSMOS_CONTAINER_NAME=conversations

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_API_KEY=your-key-here
AZURE_SEARCH_INDEX_NAME=document-index

# CORS — comma separated list of allowed frontend origins
CORS_ALLOWED_ORIGINS=http://localhost:5173

# LLM Controls
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=1500
```

**5. Start the backend**
```bash
uvicorn main:app --reload
```

API available at `http://localhost:8000`
Swagger docs at `http://localhost:8000/docs`

---

### Frontend Setup

**1. Install dependencies**
```bash
npm install
```

**2. Configure frontend environment**

Create a `.env.local` file:
```env
VITE_API_BASE=http://localhost:8000/api
VITE_API_KEY=your-api-key
```

**3. Start the frontend**
```bash
npm run dev
```

App available at `http://localhost:5173`

---

## API Endpoints

### `POST /api/decision`
Submit a question for full debate analysis.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | ✅ | The decision topic or question |
| `additional_details` | string | ❌ | Extra context or constraints |
| `decision_type` | string | ❌ | e.g. Strategic, Financial, Operational |
| `rounds` | int | ❌ | Debate rounds 1–4 (default: 2) |
| `files` | files | ❌ | Supporting documents to include |

**Example response:**
```json
{
  "id": "abc123",
  "topic": "Should I invest in Nvidia stock?",
  "judge": {
    "winner": "Agent A",
    "confidence": 0.85,
    "verdict": "Proceed — Nvidia's market position and AI tailwinds justify investment..."
  },
  "summary": {
    "executive_summary": "...",
    "key_risks": [...],
    "opportunities": [...],
    "suggested_action": "..."
  },
  "debate": {
    "agent_a": "...",
    "agent_b": "...",
    "rounds": 2
  }
}
```

### `GET /api/decisions`
Returns all saved decisions from Cosmos DB.

### `GET /api/decisions/{id}`
Returns a single decision by ID.

### `GET /health`
Health check endpoint.

---

## Frontend Pages

| Page | Description |
|------|-------------|
| **New Decision** | Submit a question, upload documents, choose debate rounds and decision type |
| **Decision History** | Browse all past decisions with verdicts and confidence scores |
| **Analytics** | Charts showing decision trends, confidence over time, outcome breakdown |
| **Settings** | Configure API base URL and key from the UI |

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | GPT deployment name |
| `AZURE_OPENAI_API_VERSION` | API version — use `2025-01-01-preview` for web search |
| `COSMOS_CONNECTION_STRING` | Full Cosmos DB connection string |
| `COSMOS_DB_NAME` | Cosmos database name |
| `COSMOS_CONTAINER_NAME` | Cosmos container name |
| `AZURE_SEARCH_ENDPOINT` | Azure AI Search endpoint |
| `AZURE_SEARCH_API_KEY` | Azure AI Search API key |
| `AZURE_SEARCH_INDEX_NAME` | Search index name |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |
| `LLM_TEMPERATURE` | Model temperature (default: 0.3) |
| `LLM_MAX_TOKENS` | Max tokens per response (default: 1500) |

---

## Security Notes

- **Never commit `.env`** — it contains live API keys
- Set `CORS_ALLOWED_ORIGINS` explicitly in production — never use `*`
- All `/api` routes require `X-API-Key` header authentication
- Inject `VITE_API_KEY` via your CI/CD pipeline in production — never hardcode it
- Rotate your Azure keys if they are ever accidentally exposed
