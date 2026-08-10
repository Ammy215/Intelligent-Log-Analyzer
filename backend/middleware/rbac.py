"""Role-based access control, layered on top of JWT identity verification."""
from fastapi import Depends, HTTPException

from middleware.auth import CurrentUser, get_current_user


def require_role(*allowed_roles: str):
    """FastAPI dependency factory: 403s unless the caller's role is allowed.

    Usage:
        @router.get("/admin-thing")
        async def handler(user: CurrentUser = Depends(require_role("admin"))):
            ...
    """

    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role in {list(allowed_roles)}, got '{user.role}'",
            )
        return user

    return _check
