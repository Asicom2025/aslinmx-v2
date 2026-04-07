"""
Tests para el módulo de usuarios
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.db.session import get_db

# Base de datos de pruebas en memoria
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override de la dependencia get_db para tests"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Configurar base de datos antes de cada test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_register_user():
    """Test de registro de usuario"""
    response = client.post(
        "/api/v1/users/register",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "nombre": "Test",
            "apellido_paterno": "User",
            "apellido_materno": "Example",
            "password": "testpass123"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert data["nombre"] == "Test"
    assert data["apellido_paterno"] == "User"
    assert data["apellido_materno"] == "Example"
    assert data["full_name"] == "Test User Example"
    assert data["perfil"]["nombre"] == "Test"
    assert "id" in data


def test_login_user():
    """Test de login de usuario"""
    # Primero registrar usuario
    client.post(
        "/api/v1/users/register",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "nombre": "Test",
            "apellido_paterno": "User",
            "apellido_materno": "Example",
            "password": "testpass123"
        }
    )
    
    # Intentar login
    response = client.post(
        "/api/v1/users/login",
        json={
            "username": "testuser",
            "password": "testpass123"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["requires_2fa"] is False


def test_health_check():
    """Test del endpoint de health check"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "storage" in data
    assert "ready" in data["storage"]

