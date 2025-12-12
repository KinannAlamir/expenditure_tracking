# Expenditure Tracking

A Python tool to categorize bank transactions using rule-based matching and the French Companies API (Recherche d’entreprises).

## Features

- **Rule-based Categorization**: Uses keywords to identify common transactions (Rent, Utilities, Supermarkets, etc.).
- **API Integration**: Queries the [Recherche d’entreprises API](https://recherche-entreprises.api.gouv.fr/) to identify merchants by name and map their NAF/APE codes to categories.
- **Caching**: Caches API results locally to speed up subsequent runs and reduce API usage.
- **CSV Support**: Reads semicolon-delimited CSV files (common in French banking exports).

## How it Works

The script processes each transaction row through a prioritized pipeline:

1.  **Keyword Matching**: Checks the transaction label against a predefined list of keywords (e.g., "EDF", "Uber", "Carrefour"). If a match is found, the category is assigned immediately.
2.  **Income Detection**: If the amount is positive and hasn't been categorized yet, it is marked as "Income".
3.  **API Lookup**: For remaining transactions, the script cleans the label and queries the French Government's Company API. It retrieves the company's NAF (activity) code and maps it to a category (e.g., NAF Section I -> "Food & Dining").
4.  **Fallback**: If no category is found, it defaults to "Other".

Results from the API are cached in `data/api_cache.json` to improve performance on subsequent runs.

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

## Usage

Run the categorization script on your CSV file:

```bash
uv run scripts/categorize_transactions.py path/to/your/expenditure.csv
```

The script will generate a new file `path/to/your/expenditure_with_category.csv` containing the original data plus:
- `predicted_category`: The inferred category.
- `category_source`: How the category was determined (`keyword`, `api`, `amount`, or `unknown`).

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

## Development

Format and lint code:

```bash
uv run ruff format .
uv run ruff check --fix .
```
