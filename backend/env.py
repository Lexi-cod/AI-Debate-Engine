from pathlib import Path

from dotenv import load_dotenv


def load_environment() -> None:
    """Load local .env values into process environment if present."""
    project_root = Path(__file__).resolve().parent.parent
    dotenv_path = project_root / ".env"
    load_dotenv(dotenv_path=dotenv_path, override=False)
