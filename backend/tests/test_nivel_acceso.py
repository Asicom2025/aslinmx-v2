from types import SimpleNamespace

from app.core.nivel_acceso import ROL_SUPER_ADMIN_ID, usuario_bypass_permisos


def test_usuario_bypass_permisos_ignores_legacy_role_id_when_level_is_not_zero() -> None:
    user = SimpleNamespace(
        rol_id=ROL_SUPER_ADMIN_ID,
        rol=SimpleNamespace(nivel=4),
    )

    assert usuario_bypass_permisos(db=None, user=user) is False


def test_usuario_bypass_permisos_allows_only_level_zero() -> None:
    user = SimpleNamespace(
        rol_id=None,
        rol=SimpleNamespace(nivel=0),
    )

    assert usuario_bypass_permisos(db=None, user=user) is True
