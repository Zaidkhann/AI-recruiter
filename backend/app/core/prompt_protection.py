import re
from fastapi import HTTPException, status

# Case-insensitive prompt injection signatures
INJECTION_PATTERNS = [
    r"ignore\s+(?:all\s+)?previous\s+instructions",
    r"system\s+override",
    r"jailbreak",
    r"you\s+must\s+now\s+act\s+as",
    r"bypass\s+safety",
    r"forget\s+everything\s+(?:you\s+have\s+been\s+told|before)",
    r"ignore\s+the\s+(?:above|below)",
    r"translate\s+the\s+above\s+instructions",
    r"decode\s+the\s+following\s+base64",
    r"switch\s+to\s+developer\s+mode",
    r"new\s+role\s+instructions:",
    r"do\s+not\s+follow\s+any\s+other\s+instructions"
]

def scan_text_for_injection(text: str) -> bool:
    """Scan input text for potential prompt injection patterns. Returns True if injection is found."""
    if not text:
        return False
    
    text_lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower):
            return True
            
    return False

def enforce_prompt_protection(text: str):
    """Enforce prompt injection check and raise HTTP 400 if validation fails."""
    if scan_text_for_injection(text):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security error: Potential prompt injection or jailbreak attempt detected."
        )
