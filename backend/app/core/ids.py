from __future__ import annotations

import secrets


def new_id(prefix: str) -> str:
    """Short random id such as `prj_3f9a1c2b`. Collisions are checked by callers."""
    return f"{prefix}_{secrets.token_hex(4)}"
