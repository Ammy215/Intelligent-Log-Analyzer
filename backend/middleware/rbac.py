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


async def require_superadmin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Platform-level gate, orthogonal to require_role — checks the
    is_superadmin JWT claim only, completely independent of org_id/role.
    Every route behind this must ALSO use the service role for its actual
    data access (org-scoped RLS would otherwise still block cross-org
    reads even for a superadmin-flagged token) — this dependency is only
    the gate, not the data-access mechanism.
    """
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user
