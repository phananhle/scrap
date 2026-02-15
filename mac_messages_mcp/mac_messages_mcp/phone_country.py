"""
Phone country code utility: E.164 dial codes, flag emojis, and formatting.
Standalone module with no dependencies on mac_messages_mcp internals.
"""

from typing import Any

# Curated E.164 dial codes (ITU-T). dial_code, alpha2 (ISO 3166-1), name
_COUNTRY_DATA: list[dict[str, Any]] = [
    {"dial_code": "+1", "alpha2": "US", "name": "United States"},
    {"dial_code": "+1", "alpha2": "CA", "name": "Canada"},
    {"dial_code": "+44", "alpha2": "GB", "name": "United Kingdom"},
    {"dial_code": "+33", "alpha2": "FR", "name": "France"},
    {"dial_code": "+49", "alpha2": "DE", "name": "Germany"},
    {"dial_code": "+39", "alpha2": "IT", "name": "Italy"},
    {"dial_code": "+34", "alpha2": "ES", "name": "Spain"},
    {"dial_code": "+31", "alpha2": "NL", "name": "Netherlands"},
    {"dial_code": "+32", "alpha2": "BE", "name": "Belgium"},
    {"dial_code": "+41", "alpha2": "CH", "name": "Switzerland"},
    {"dial_code": "+43", "alpha2": "AT", "name": "Austria"},
    {"dial_code": "+46", "alpha2": "SE", "name": "Sweden"},
    {"dial_code": "+47", "alpha2": "NO", "name": "Norway"},
    {"dial_code": "+45", "alpha2": "DK", "name": "Denmark"},
    {"dial_code": "+358", "alpha2": "FI", "name": "Finland"},
    {"dial_code": "+353", "alpha2": "IE", "name": "Ireland"},
    {"dial_code": "+351", "alpha2": "PT", "name": "Portugal"},
    {"dial_code": "+48", "alpha2": "PL", "name": "Poland"},
    {"dial_code": "+420", "alpha2": "CZ", "name": "Czech Republic"},
    {"dial_code": "+36", "alpha2": "HU", "name": "Hungary"},
    {"dial_code": "+30", "alpha2": "GR", "name": "Greece"},
    {"dial_code": "+90", "alpha2": "TR", "name": "Turkey"},
    {"dial_code": "+7", "alpha2": "RU", "name": "Russia"},
    {"dial_code": "+380", "alpha2": "UA", "name": "Ukraine"},
    {"dial_code": "+61", "alpha2": "AU", "name": "Australia"},
    {"dial_code": "+64", "alpha2": "NZ", "name": "New Zealand"},
    {"dial_code": "+81", "alpha2": "JP", "name": "Japan"},
    {"dial_code": "+82", "alpha2": "KR", "name": "South Korea"},
    {"dial_code": "+86", "alpha2": "CN", "name": "China"},
    {"dial_code": "+91", "alpha2": "IN", "name": "India"},
    {"dial_code": "+62", "alpha2": "ID", "name": "Indonesia"},
    {"dial_code": "+60", "alpha2": "MY", "name": "Malaysia"},
    {"dial_code": "+65", "alpha2": "SG", "name": "Singapore"},
    {"dial_code": "+63", "alpha2": "PH", "name": "Philippines"},
    {"dial_code": "+66", "alpha2": "TH", "name": "Thailand"},
    {"dial_code": "+84", "alpha2": "VN", "name": "Vietnam"},
    {"dial_code": "+971", "alpha2": "AE", "name": "United Arab Emirates"},
    {"dial_code": "+966", "alpha2": "SA", "name": "Saudi Arabia"},
    {"dial_code": "+972", "alpha2": "IL", "name": "Israel"},
    {"dial_code": "+27", "alpha2": "ZA", "name": "South Africa"},
    {"dial_code": "+234", "alpha2": "NG", "name": "Nigeria"},
    {"dial_code": "+254", "alpha2": "KE", "name": "Kenya"},
    {"dial_code": "+233", "alpha2": "GH", "name": "Ghana"},
    {"dial_code": "+55", "alpha2": "BR", "name": "Brazil"},
    {"dial_code": "+52", "alpha2": "MX", "name": "Mexico"},
    {"dial_code": "+54", "alpha2": "AR", "name": "Argentina"},
    {"dial_code": "+57", "alpha2": "CO", "name": "Colombia"},
    {"dial_code": "+56", "alpha2": "CL", "name": "Chile"},
    {"dial_code": "+51", "alpha2": "PE", "name": "Peru"},
]


def get_flag_emoji(alpha2: str) -> str:
    """
    Convert ISO 3166-1 alpha-2 to flag emoji via regional indicator symbols.

    Args:
        alpha2: Two-letter country code (e.g. "US")

    Returns:
        Flag emoji string (e.g. "🇺🇸")
    """
    if not alpha2 or len(alpha2) != 2:
        return ""
    alpha2 = alpha2.upper()
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in alpha2 if "A" <= c <= "Z")


def get_country_for_dial_code(dial_code: str) -> dict[str, Any] | None:
    """
    Lookup country by E.164 dial code (e.g. "+1", "+33").

    Args:
        dial_code: Dial code with optional + prefix

    Returns:
        First matching entry or None
    """
    code = dial_code.strip()
    if not code.startswith("+"):
        code = "+" + code
    for entry in _COUNTRY_DATA:
        if entry["dial_code"] == code:
            out = dict(entry)
            out["flag"] = get_flag_emoji(out["alpha2"])
            return out
    return None


def list_countries() -> list[dict[str, Any]]:
    """
    All country entries with dial_code, name, alpha2, and flag.

    Returns:
        List of dicts with dial_code, name, alpha2, flag
    """
    return [
        {**entry, "flag": get_flag_emoji(entry["alpha2"])}
        for entry in _COUNTRY_DATA
    ]


def format_e164(dial_code: str, local_number: str) -> str:
    """
    Combine dial code and local number into E.164 format.

    Args:
        dial_code: E.g. "+1" or "1"
        local_number: Local digits (spaces, dashes, parens stripped)

    Returns:
        Full number like "+15551234567"
    """
    code = dial_code.strip()
    if not code.startswith("+"):
        code = "+" + code
    digits = "".join(c for c in local_number if c.isdigit())
    return code + digits
