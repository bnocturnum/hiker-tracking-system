
import re

import psycopg
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from .db import connect_db

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def json_payload():
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else {}


def public_user(row):
    return {
        "id_usuario": row["id_usuario"],
        "nombre": row["nombre"],  # Nombre completo; permite frontend anterior.
        "nombres": row.get("nombres"),
        "apellido_paterno": row.get("apellido_paterno"),
        "apellido_materno": row.get("apellido_materno"),
        "correo": row["correo"],
        "rol": row["rol"],
    }


def fail(message, code):
    return jsonify({"mensaje": message}), code


def parse_names(data):
    """Preferir campos separados; aceptar `nombre` heredado sin partirlo arbitrariamente."""
    has_structured = any(key in data for key in ("nombres", "apellido_paterno", "apellido_materno"))
    if not has_structured:
        legacy = data.get("nombre")
        if not isinstance(legacy, str) or not 1 <= len(legacy.strip()) <= 100:
            raise ValueError("El nombre completo debe tener de 1 a 100 caracteres.")
        return legacy.strip(), None, None, None

    values = (data.get("nombres"), data.get("apellido_paterno"), data.get("apellido_materno", ""))
    if not all(isinstance(value, str) for value in values):
        raise ValueError("Los campos de nombre y apellidos deben ser texto.")
    nombres, paterno, materno = (part.strip() for part in values)
    if not 1 <= len(nombres) <= 100:
        raise ValueError("Ingresa tu nombre o nombres (máximo 100 caracteres).")
    if not 1 <= len(paterno) <= 100:
        raise ValueError("Ingresa tu apellido paterno (máximo 100 caracteres).")
    if len(materno) > 100:
        raise ValueError("El apellido materno debe tener máximo 100 caracteres.")
    nombre_completo = " ".join(part for part in (nombres, paterno, materno) if part)
    if len(nombre_completo) > 100:
        raise ValueError("El nombre completo excede 100 caracteres.")
    return nombre_completo, nombres, paterno, materno or None


@bp.post("/register")
def register():
    data = json_payload()
    try:
        nombre, nombres, paterno, materno = parse_names(data)
    except ValueError as exc:
        return fail(str(exc), 400)
    correo = str(data.get("correo") or "").strip().lower()
    password = data.get("contrasena")
    rol = str(data.get("rol") or "").strip().lower()
    code = str(data.get("codigo_vinculacion") or "").strip()

    if len(correo) > 100 or not EMAIL_PATTERN.fullmatch(correo):
        return fail("Ingresa un correo electrónico válido.", 400)
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        return fail("La contraseña debe tener entre 8 y 128 caracteres.", 400)
    if rol not in ("senderista", "monitor"):
        return fail("Solo puedes registrar usuarios senderista o monitor.", 400)
    if rol == "senderista" and (not code or len(code) > 20):
        return fail("El código del dispositivo es obligatorio (máximo 20 caracteres).", 400)

    hashed = generate_password_hash(password)
    try:
        with connect_db() as connection, connection.cursor() as cursor:
            device = None
            if rol == "senderista":
                cursor.execute(
                    """SELECT id_dispositivo FROM public.dispositivos
                       WHERE codigo_vinculacion=%s AND id_senderista IS NULL
                       FOR UPDATE""", (code,),
                )
                device = cursor.fetchone()
                if device is None:
                    return fail("Código inválido o dispositivo ya asignado.", 409)
            cursor.execute(
                """INSERT INTO public.usuarios
                   (nombre, nombres, apellido_paterno, apellido_materno,
                    correo, rol, fecha_registro, password_hash)
                   VALUES (%s, %s, %s, %s, %s, %s, timezone('UTC',now()), %s)
                   RETURNING id_usuario, nombre, nombres, apellido_paterno,
                             apellido_materno, correo, rol""",
                (nombre, nombres, paterno, materno, correo, rol, hashed),
            )
            user = cursor.fetchone()
            if device is not None:
                cursor.execute(
                    """UPDATE public.dispositivos SET id_senderista=%s
                       WHERE id_dispositivo=%s AND id_senderista IS NULL""",
                    (user["id_usuario"], device["id_dispositivo"]),
                )
        return jsonify({"data": {"usuario": public_user(user)}}), 201
    except psycopg.errors.UniqueViolation:
        return fail("El correo ya está registrado.", 409)


@bp.post("/login")
def login():
    data = json_payload()
    correo = str(data.get("correo") or "").strip().lower()
    password = data.get("contrasena")
    if not correo or not isinstance(password, str):
        return fail("Ingresa correo y contraseña.", 400)
    with connect_db() as connection, connection.cursor() as cursor:
        cursor.execute(
            """SELECT id_usuario, nombre, nombres, apellido_paterno, apellido_materno,
                      correo, rol, password_hash
               FROM public.usuarios WHERE LOWER(correo) = %s""", (correo,),
        )
        user = cursor.fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        return fail("Correo o contraseña incorrectos.", 401)
    token = create_access_token(identity=str(user["id_usuario"]))
    return jsonify({"data": {"access_token": token, "usuario": public_user(user)}})


@bp.get("/me")
@jwt_required()
def me():
    try:
        identity = int(get_jwt_identity())
    except (TypeError, ValueError):
        return fail("Identidad no válida.", 401)
    with connect_db() as connection, connection.cursor() as cursor:
        cursor.execute(
            """SELECT id_usuario, nombre, nombres, apellido_paterno,
                      apellido_materno, correo, rol
               FROM public.usuarios WHERE id_usuario = %s""", (identity,),
        )
        user = cursor.fetchone()
    if user is None:
        return fail("La cuenta ya no está disponible.", 401)
    return jsonify({"data": {"usuario": public_user(user)}})
