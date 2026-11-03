def normalise_email(email: str) -> str:
    """Lower-cased and trimmed, so the same address always matches itself."""
    return email.strip().lower()
