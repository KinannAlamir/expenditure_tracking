from pathlib import Path

API_URL = "https://recherche-entreprises.api.gouv.fr/search"
CACHE_FILE = Path("data/api_cache.json")

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
