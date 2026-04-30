# Expenditure Tracking

A Python tool to categorize bank transactions using rule-based matching, the French Companies API (Recherche d'entreprises), and an LLM for understanding French transaction labels.

## Features

- **Rule-based Categorization**: Uses keywords to identify common transactions (Rent, Utilities, Supermarkets, etc.).
- **API Integration**: Queries the [Recherche d'entreprises API](https://recherche-entreprises.api.gouv.fr/) to identify merchants by name and map their NAF/APE codes to categories.
- **LLM Classification**: Sends unresolved French transaction labels ("Libellé opération") to an LLM (GPT-4o-mini) that understands French banking terminology for accurate categorization.
- **Caching**: Caches API and LLM results locally to speed up subsequent runs and reduce costs.
- **CSV Support**: Reads semicolon-delimited CSV files (common in French banking exports).

## How it Works

The script processes each transaction row through a prioritized pipeline:

1.  **Keyword Matching**: Checks the transaction label against a predefined list of keywords (e.g., "EDF", "Uber", "Carrefour"). If a match is found, the category is assigned immediately.
2.  **Income Detection**: If the amount is positive and hasn't been categorized yet, it is marked as "Income".
3.  **API Lookup**: For remaining transactions, the script cleans the label and queries the French Government's Company API. It retrieves the company's NAF (activity) code and maps it to a category (e.g., NAF Section I -> "Food & Dining").
4.  **LLM Classification**: Transactions still unresolved after the above steps are sent in batches to an LLM. The model reads the French "Libellé opération" and assigns a category.
5.  **Fallback**: If no category is found (or LLM is disabled), it defaults to "Other".

Results are cached in `data/api_cache.json` (API) and `data/llm_cache.json` (LLM) to improve performance on subsequent runs.

## Setup

This project uses `uv` for dependency management.

1.  **Install uv**:
    ```bash
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ```

2.  **Install dependencies**:
    ```bash
    uv sync
    ```

3.  **Set your OpenRouter API key** (required for LLM classification):
    ```bash
    cp .env.example .env
    ```
    Then edit `.env` and replace `sk-or-...` with your actual key from [openrouter.ai/keys](https://openrouter.ai/keys). This file is git-ignored and will never be committed.

## Usage

Run the categorization script on your CSV file:

```bash
uv run scripts/categorize_transactions.py path/to/your/expenditure.csv
```

To disable LLM classification and use only rules + API:

```bash
uv run scripts/categorize_transactions.py --no-llm path/to/your/expenditure.csv
```

The script will generate a new file `path/to/your/expenditure_with_category.csv` containing the original data plus:
- `predicted_category`: The inferred category.
- `category_source`: How the category was determined (`keyword`, `api`, `llm`, `amount`, or `unknown`).

## Categories

- Income
- Housing & Utilities
- Food & Dining
- Transport
- Shopping
- Leisure & Culture
- Health
- Education
- Finance & Transfers
- Other

## Web App

The project includes a full web interface — upload your CSV(s), get interactive charts.

### First-time setup

```bash
# 1. Install Python dependencies
uv sync

# 2. Install frontend dependencies
cd frontend && npm install && cd ..
```

### Running the app

Open **two terminals**, both from the **project root** (`expenditure_tracking/`):

```bash
# Terminal 1 — Python backend (API on http://localhost:8000)
# Must be run from the project root, not from inside frontend/
uv run uvicorn backend.main:app --reload --port 8000    

# Terminal 2 — React frontend (UI on http://localhost:5173)
cd frontend && npm run dev
```

Then open **http://localhost:5173** in your browser.

Drop in your bank CSV export(s), toggle LLM classification on or off, and click **Analyse**. The dashboard shows:
- Spending by category (pie + bar)
- Monthly income vs expenses
- Monthly breakdown by category (stacked bar)
- Top 20 individual expenses
- Top 15 merchants
- Daily spending with 7-day rolling average
- Category × month heatmap
- Box plot distribution per category
- Cumulative spending by category
- Full category breakdown table

### Building for production

```bash
cd frontend && npm run build
```

The compiled frontend is output to `frontend/dist/`. The FastAPI backend will automatically serve it — you only need to run the backend **from the project root**:

```bash
# Run from the project root (expenditure_tracking/), not from inside frontend/
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Development

Format and lint Python code:

```bash
uv run ruff format .
uv run ruff check --fix .
```