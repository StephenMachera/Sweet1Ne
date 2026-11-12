import csv
import io
import re
from dataclasses import dataclass

from openpyxl import load_workbook

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_ROWS = 25000

_EMAIL_HEADERS = {"email", "e-mail", "email address", "emailaddress", "mail"}
_SOURCE_HEADERS = {"source", "came from", "channel"}
_CONSENT_HEADERS = {"consent", "consented", "agreed", "opt in", "opt-in", "optin", "subscribed", "newsletter"}
_YES = re.compile(r"^(y|yes|true|1|x|ok|agreed|✓|✔)$", re.IGNORECASE)


_NO_PLACE = re.compile(r"^(sheet\s*\d*|no location.*|unknown|none|all|other|)$", re.IGNORECASE)


class ImportFileError(ValueError):
    pass


@dataclass
class ImportRow:
    email: str
    source: str | None
    consented: bool | None
    location: str | None = None


def _text(cell) -> str:
    return "" if cell is None else str(cell).strip()


def _read_tables(filename: str, content: bytes) -> list[tuple[str, list[list]]]:
    """One table per sheet (every tab of a workbook), or one for a CSV."""
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm")):
        try:
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            return [
                (sheet.title, [list(r) for r in sheet.iter_rows(values_only=True, max_row=MAX_ROWS + 2)])
                for sheet in workbook.worksheets
            ]
        except Exception:
            raise ImportFileError("That doesn't look like a valid Excel file.")
    if name.endswith(".csv"):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
        return [("", [row for row in csv.reader(io.StringIO(text))][: MAX_ROWS + 2])]
    if name.endswith(".xls"):
        raise ImportFileError("Old .xls files aren't supported. Save it as .xlsx in Excel and try again.")
    raise ImportFileError("Upload an Excel (.xlsx) or CSV file.")


def _parse_table(table: list[list]) -> list[tuple[str, str | None, bool | None]] | None:
    """Rows of (email, source, consented) from one sheet; None if the sheet has no email column."""
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
            return None
        source_col = consent_col = None
        body = table

    out = []
    for r in body:
        email = (_text(r[email_col]) if email_col < len(r) else "").lower()
        source = _text(r[source_col])[:60] if source_col is not None and source_col < len(r) else ""
        consent = None
        if consent_col is not None and consent_col < len(r):
            consent = bool(_YES.match(_text(r[consent_col])))
        out.append((email, source or None, consent))
    return out


def parse_leads(filename: str, content: bytes) -> tuple[list[ImportRow], int, bool]:
    """Returns (rows, number of rows with no email, whether the file was cut at MAX_ROWS).
    Every sheet in a workbook is read."""
    sheets = [(name, [r for r in t if any(_text(c) for c in r)]) for name, t in _read_tables(filename, content)]
    sheets = [(name, t) for name, t in sheets if t]
    if not sheets:
        raise ImportFileError("That file is empty.")

    # A tab name is a location only when the workbook has several tabs and the
    # name says something ("Chingford"), not "Sheet1" or "No Location Specified".
    use_tabs = len(sheets) > 1
    everything: list[tuple[str, str | None, bool | None, str | None]] = []
    for name, t in sheets:
        parsed = _parse_table(t)
        if parsed is None:
            continue
        place = name.strip()[:40] if use_tabs and not _NO_PLACE.match(name.strip()) else None
        everything += [(e, s_, c, place) for e, s_, c in parsed]
    if not everything and not any(_parse_table(t) is not None for _, t in sheets):
        raise ImportFileError("No email column found. Add a column headed \"email\".")

    truncated = len(everything) > MAX_ROWS
    everything = everything[:MAX_ROWS]

    rows: list[ImportRow] = []
    unreadable = 0
    for email, source, consent, place in everything:
        if not email:
            unreadable += 1
            continue
        rows.append(ImportRow(email=email, source=source, consented=consent, location=place))
    return rows, unreadable, truncated
