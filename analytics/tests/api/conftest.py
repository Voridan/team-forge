"""
Fixtures for router-level smoke tests.

These tests don't need a real database — they verify the auth + routing layer.
Query functions are monkey-patched to return canned data, and the FastAPI
dependency-override system swaps the auth/authz deps for stubs we control.
"""
from __future__ import annotations

import os
from uuid import UUID, uuid4

# Settings need at least DATABASE_URL + JWT_SECRET to instantiate. The tests
# never actually open the pool — query functions are mocked — but the import
# of settings happens at module load. Set safe placeholder env BEFORE importing
# app.main so pydantic-settings doesn't barf.
os.environ.setdefault("DATABASE_URL", "postgresql://stub:stub@localhost/stub")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET", "x" * 32)

import pytest
from fastapi.testclient import TestClient

from app.core.security import AuthenticatedUser
from app.deps.auth import get_current_user
from app.deps.authz import require_team_admin
from app.main import app


TEST_USER = AuthenticatedUser(id=str(uuid4()), email="test@local")
TEST_TEAM_ID = UUID("00000000-0000-0000-0000-000000000abc")


def _stub_current_user() -> AuthenticatedUser:
    return TEST_USER


def _stub_admin_authz() -> AuthenticatedUser:
    return TEST_USER


@pytest.fixture
def admin_client() -> TestClient:
    """Client whose auth + authz deps return success — simulates an admin user."""
    app.dependency_overrides[get_current_user] = _stub_current_user
    app.dependency_overrides[require_team_admin] = _stub_admin_authz
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def unauth_client() -> TestClient:
    """No dependency overrides — real JWT check runs and rejects unauthenticated calls."""
    with TestClient(app) as client:
        yield client
