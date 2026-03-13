from pathlib import Path

API_URL = "https://recherche-entreprises.api.gouv.fr/search"
CACHE_FILE = Path("data/api_cache.json")
LLM_CACHE_FILE = Path("data/llm_cache.json")

# LLM Configuration
LLM_BASE_URL = "https://openrouter.ai/api/v1"
LLM_MODEL = "openai/gpt-4o-mini"
LLM_BATCH_SIZE = 20  # Number of transactions to classify per LLM call
LLM_SYSTEM_PROMPT = """\
You are a French banking transaction classifier. You receive French bank transaction \
labels ("Libellé opération") and must assign each one to exactly ONE category from \
the list below.

Categories:
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

Rules:
- Transaction labels are in French. Use your understanding of French to interpret them.
- "PRLV" = prélèvement (direct debit), "VIR SEPA" = virement SEPA (bank transfer), \
"CB" = carte bancaire (card payment), "DAB" = distributeur automatique (ATM).
- "ENVOI WERO" or "WERO" are peer-to-peer instant transfers → Finance & Transfers.
- Supermarkets, groceries, restaurants, bakeries → Food & Dining.
- Rent, electricity, gas, water, internet, phone → Housing & Utilities.
- Train (SNCF), tram, bus, flights, taxi, Uber, parking, tolls → Transport.
- Subscriptions (Netflix, Spotify), hotels, cinemas, sports → Leisure & Culture.
- Pharmacy, doctor, mutual insurance (mutuelle) → Health.
- University, driving school, training → Education.
- Bank fees, savings, transfers between accounts → Finance & Transfers.
- Salary, CAF, APL, reimbursements from employer → Income.

Respond ONLY with a valid JSON array of objects, one per transaction, in the same \
order as the input. Each object must have exactly two keys:
  "index": the 0-based index of the transaction
  "category": one of the categories listed above

Example input:
0: CB CARREFOUR GRENOBLE
1: PRLV SFR TELECOM

Example output:
[{"index": 0, "category": "Food & Dining"}, {"index": 1, "category": "Housing & Utilities"}]
"""

# User-defined compact categories (Max 10)
CATEGORIES = [
    "Income",
    "Housing & Utilities",
    "Food & Dining",
    "Transport",
    "Shopping",
    "Leisure & Culture",
    "Health",
    "Education",
    "Finance & Transfers",
    "Other",
]

# Keyword rules for high-confidence matches (skip API)
KEYWORD_MAP = {
    "Housing & Utilities": [
        "foncia",
        "syndicat",
        "loyer",
        "revenus locatifs",
        "copropriet",
        "sindic",
        "edf",
        "electricite",
        "gaz",
        "geg",
        "eau",
        "fioul",
        "sfr",
        "internet",
        "telephonie",
        "gaz et electricite",
    ],
    "Food & Dining": [
        "carrefour",
        "supermarche",
        "hyper",
        "courses",
        "leclerc",
        "intermarche",
        "auchan",
        "monoprix",
        "aldi",
        "lidl",
        "foods",
        "kfc",
        "restaurant",
        "poulet",
        "kebab",
        "mcdo",
        "pizza",
        "burger",
        "eat",
        "ubereats",
        "deliveroo",
    ],
    "Transport": [
        "sncf",
        "train",
        "tram",
        "ticket",
        "ticket tram",
        "air",
        "klm",
        "uber",
        "taxi",
        "billet",
        "avion",
        "flight",
        "voie",
        "peage",
        "parking",
    ],
    "Leisure & Culture": [
        "pathe",
        "cinema",
        "museum",
        "loisirs",
        "airbnb",
        "hotel",
        "spectacle",
        "decathlon",
        "kt grenoble",
        "netflix",
        "spotify",
        "amazon prime",
        "abonnement",
        "abonn",
    ],
    "Finance & Transfers": [
        "virement",
        "vir sepa",
        "virement recu",
        "virement emis",
        "virement interne",
        "livret",
        "epargne",
        "virement vers",
        "cotisations bancaires",
        "frais bancaires",
        "frais",
        "banque",
        "remise cotisations",
    ],
    "Health": [
        "pharmacie",
        "mutuelle",
        "medic",
        "medicament",
        "chirurgien",
        "rembt medic",
        "docteur",
        "sante",
    ],
    "Shopping": [
        "amazon",
        "vinted",
        "shopping",
        "chaussures",
        "pull bear",
        "macbook",
        "tablette",
        "accessoire",
        "lebons",
        "fnac",
        "darty",
        "boulanger",
        "ikea",
        "zara",
        "h&m",
    ],
    "Education": [
        "inscription",
        "iae",
        "permis",
        "ecole",
        "inscription iae",
        "auto ecole",
        "formation",
    ],
}

# NAF Section Mapping
NAF_MAPPING = {
    "A": "Other",  # Agriculture
    "B": "Other",  # Mining
    "C": "Shopping",  # Manufacturing
    "D": "Housing & Utilities",  # Electricity, Gas
    "E": "Housing & Utilities",  # Water, Waste
    "F": "Housing & Utilities",  # Construction
    "G": "Shopping",  # Trade (Retail/Wholesale) - will refine for Food
    "H": "Transport",  # Transport
    # Accommodation & Food (Hotels -> Leisure, Restaurants -> Food)
    "I": "Food & Dining",
    "J": "Leisure & Culture",  # Info & Comm
    "K": "Finance & Transfers",  # Financial
    "L": "Housing & Utilities",  # Real Estate
    "M": "Other",  # Professional/Scientific
    "N": "Other",  # Admin/Support
    "O": "Other",  # Public Admin
    "P": "Education",  # Education
    "Q": "Health",  # Health
    "R": "Leisure & Culture",  # Arts/Entertainment
    "S": "Other",  # Other Services
    "T": "Other",  # Households
    "U": "Other",  # Extraterritorial
}
