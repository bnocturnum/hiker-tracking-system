"""Consultas de supervisión para cuentas administrador provisionadas fuera del registro público."""
from flask import Blueprint, jsonify
from .db import connect_db
from .security import iso_utc, require_role

bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@bp.get('/usuarios')
@require_role('administrador')
def users():
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''SELECT id_usuario,nombre,correo,rol,fecha_registro
                       FROM public.usuarios ORDER BY fecha_registro DESC''')
        rows = cur.fetchall()
    return jsonify({'data': [{**row, 'fecha_registro': iso_utc(row['fecha_registro'])} for row in rows]})


@bp.get('/resumen')
@require_role('administrador')
def summary():
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''SELECT (SELECT count(*) FROM public.usuarios) AS usuarios_registrados,
                              (SELECT count(*) FROM public.dispositivos) AS dispositivos_registrados''')
        stats = cur.fetchone()
    return jsonify({'data': stats})


@bp.get('/salud')
@require_role('administrador')
def services():
    with connect_db() as db, db.cursor() as cur:
        cur.execute('SELECT 1')
        cur.fetchone()
    return jsonify({'data': {'api': 'operativa', 'base_datos': 'conectada'}})
