"""CRUD acotado de rutas del senderista."""
from datetime import datetime, timezone
from flask import Blueprint, g, jsonify, request
from .db import connect_db
from .security import error, iso_utc, parse_datetime, require_role, utc_naive

bp = Blueprint('routes', __name__, url_prefix='/api/rutas')


def serialize(row):
    return {**row, 'fecha_inicio': iso_utc(row['fecha_inicio'])}


def validate(data):
    if not isinstance(data, dict):
        raise ValueError('Se esperaba un objeto JSON.')
    name = data.get('nombre_ruta')
    dest = data.get('destino')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
        raise ValueError('Nombre de ruta inválido (máximo 100 caracteres).')
    if not isinstance(dest, str) or not 1 <= len(dest.strip()) <= 150:
        raise ValueError('Destino inválido (máximo 150 caracteres).')
    dt = parse_datetime(data.get('fecha_inicio'))
    if dt <= datetime.now(timezone.utc):
        raise ValueError('La ruta debe tener una fecha futura.')
    return name.strip(), dest.strip(), utc_naive(dt)


@bp.get('')
@require_role('senderista')
def list_routes():
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''SELECT id_ruta, nombre_ruta, destino, fecha_inicio, estado
                       FROM public.rutas WHERE id_senderista = %s
                       ORDER BY fecha_inicio DESC''', (g.auth_user['id_usuario'],))
        rows = cur.fetchall()
    return jsonify({'data': [serialize(row) for row in rows]})


@bp.post('')
@require_role('senderista')
def create_route():
    try:
        name, dest, start = validate(request.get_json(silent=True))
    except ValueError as e:
        return error(str(e))
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''INSERT INTO public.rutas (id_senderista,nombre_ruta,destino,fecha_inicio,estado)
                       VALUES (%s,%s,%s,%s,'programada')
                       RETURNING id_ruta, nombre_ruta, destino, fecha_inicio, estado''',
                    (g.auth_user['id_usuario'], name, dest, start))
        row = cur.fetchone()
    return jsonify({'data': serialize(row)}), 201


@bp.patch('/<int:route_id>')
@require_role('senderista')
def update_route(route_id):
    try:
        name, dest, start = validate(request.get_json(silent=True))
    except ValueError as e:
        return error(str(e))
    with connect_db() as db, db.cursor() as cur:
        cur.execute('''UPDATE public.rutas
                       SET nombre_ruta=%s, destino=%s, fecha_inicio=%s
                       WHERE id_ruta=%s AND id_senderista=%s
                         AND fecha_inicio > timezone('UTC', now()) AND estado = 'programada'
                       RETURNING id_ruta, nombre_ruta, destino, fecha_inicio, estado''',
                    (name, dest, start, route_id, g.auth_user['id_usuario']))
        row = cur.fetchone()
    if not row:
        return error('Ruta inexistente o no editable.', 404)
    return jsonify({'data': serialize(row)})
