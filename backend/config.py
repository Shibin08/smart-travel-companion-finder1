"""
Centralized environment configuration.

Loads variables from a .env file (if present) and validates that all
required settings are provided.
"""

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")

# Google OAuth Client ID (optional — needed only for Google Sign-In)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# Google Gemini API Key (optional — used for AI-generated destination tags)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
