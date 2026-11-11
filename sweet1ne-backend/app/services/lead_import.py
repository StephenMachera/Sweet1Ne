import csv
import io
import re
from dataclasses import dataclass

from email_validator import EmailNotValidError, validate_email
from openpyxl import load_workbook

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000

_EMAIL_HEADERS = {"email", "e-mail", "email address", "emailaddress", "mail"}
_SOURCE_HEADERS = {"source", "came from", "channel"}
_CONSENT_HEADERS = {"consent", "consented", "agreed", "opt in", "opt-in", "optin", "subscribed", "newsletter"}
_YES = re.compile(r"^(y|yes|true|1|x|ok|agreed|✓|✔)$", re.IGNORECASE)


class ImportFileError(ValueError):
    pass


@dataclass
class ImportRow:
    email: str
    source: str | None
    consented: bool | None


def _text(cell) -> str:
    return "" if cell is None else str(cell).strip()


def _read_table(filename: str, content: bytes) -> list[list]:
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm")):
        try:
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            sheet = workbook.active
            return [list(r) for r in sheet.iter_rows(values_only=True, max_row=MAX_ROWS + 2)]
        except Exception:
            raise ImportFileError("That doesn't look like a valid Excel file.")
    if name.endswith(".csv"):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
        return [row for row in csv.reader(io.StringIO(text))][: MAX_ROWS + 2]
    if name.endswith(".xls"):
        raise ImportFileError("Old .xls files aren't supported. Save it as .xlsx in Excel and try again.")
    raise ImportFileError("Upload an Excel (.xlsx) or CSV file.")


def parse_leads(filename: str, content: bytes) -> tuple[list[ImportRow], int, bool]:
    """Returns (rows, number of unreadable rows, whether the file was cut at MAX_ROWS)."""
    table = [r for r in _read_table(filename, content) if any(_text(c) for c in r)]
    if not table:
        raise ImportFileError("That file is empty.")

    header = [_text(c).lower() for c in table[0]]
    email_col = next((i for i, h in enumerate(header) if h in _EMAIL_HEADERS), None)

    if email_col is not None:
        source_col = next((i for i, h in enumerate(header) if h in _SOURCE_HEADERS), None)
        consent_col = next((i for i, h in enumerate(header) if h in _CONSENT_HEADERS), None)
        body = table[1:]
    else:
        email_col = next(
            (i for r in table[:20] for i, c in enumerate(r) if "@" in _text(c)),
            None,
        )
        if email_col is None:
            raise ImportFileError("No email column found. Add a column headed \"email\".")
        source_col = consent_col = None
        body = table

    truncated = len(body) > MAX_ROWS
    body = body[:MAX_ROWS]

    rows: list[ImportRow] = []
    unreadable = 0
    for r in body:
        raw = _text(r[email_col]) if email_col < len(r) else ""
        try:
            email = validate_email(raw, check_deliverability=False).normalized.lower()
        except EmailNotValidError:
            unreadable += 1
            continue
        source = _text(r[source_col])[:60] if source_col is not None and source_col < len(r) else ""
        consent = None
        if consent_col is not None and consent_col < len(r):
            consent = bool(_YES.match(_text(r[consent_col])))
        rows.append(ImportRow(email=email, source=source or None, consented=consent))
    return rows, unreadable, truncated
