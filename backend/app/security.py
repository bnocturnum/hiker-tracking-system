"""Autorización del lado servidor: no confiar en el rol recibido por el navegador."""
from datetime import datetime, timezone
from functools import wraps

from flask import g, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from .db import connect_db


def error(message, code=400):
    return jsonify({'mensaje': message}), code


def require_role(*roles):
    def decorator(function):
        @wraps(function)
        @jwt_required()
        def wrapped(*args, **kwargs):
            try:
                user_id = int(get_jwt_identity())
            except (TypeError, ValueError):
                return error('Identidad no válida.', 401)
            with connect_db() as db, db.cursor() as cur:
                cur.execute('SELECT id_usuario, rol, nombre FROM public.usuarios WHERE id_usuario = %s', (user_id,))
                user = cur.fetchone()
            if not user:
                return error('Usuario inexistente.', 401)
            if user['rol'] not in roles:
                return error('No tienes permisos para realizar esta operación.', 403)
            g.auth_user = user
            return function(*args, **kwargs)
        return wrapped
    return decorator


def parse_datetime(value):
    """Recibe ISO-8601 con zona (Z u offset); devuelve datetime UTC consciente."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError('Fecha inválida.')
    try:
        dt = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError('Fecha inválida: usa ISO 8601.') from exc
    if dt.tzinfo is None:
        raise ValueError('La fecha debe incluir zona horaria.')
    return dt.astimezone(timezone.utc)


def utc_naive(dt):
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def iso_utc(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def positive_int(value):
    try:
        n = int(value)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None
