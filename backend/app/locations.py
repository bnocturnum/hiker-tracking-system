"""Lecturas GPS: acceso exclusivo para monitores con vinculación activa."""
from flask import Blueprint, g, jsonify, request
from .db import connect_db
from .security import error, iso_utc, parse_datetime, positive_int, require_role

bp = Blueprint('locations', __name__, url_prefix='/api/ubicaciones')


def authorized_device(cur, device_id, user_id):
    cur.execute('''SELECT 1 FROM public.vinculaciones v
                   JOIN public.dispositivos d ON d.id_dispositivo = v.id_dispositivo
                   WHERE v.id_dispositivo=%s AND v.id_monitor=%s AND v.estado='activa'
                     AND d.id_senderista IS NOT NULL LIMIT 1''', (device_id, user_id))
    return cur.fetchone() is not None


def serialize(row):
    row = dict(row)
    for name in ('latitud','longitud','altitud','nivel_energia'):
        if row.get(name) is not None:
            row[name] = float(row[name])
    row['timestamp'] = iso_utc(row['timestamp'])
    return row


def get_device():
    return positive_int(request.args.get('dispositivo'))


@bp.get('/ultima')
@require_role('monitor')
def latest():
    device_id = get_device()
    if device_id is None:
        return error('Especifica un identificador de dispositivo válido.')
    with connect_db() as db, db.cursor() as cur:
        if not authorized_device(cur, device_id, g.auth_user['id_usuario']):
            return error('No tienes acceso a este dispositivo.', 403)
        cur.execute('''SELECT id_ubicacion,id_dispositivo,latitud,longitud,altitud,"timestamp",nivel_energia
                       FROM public.ubicaciones WHERE id_dispositivo=%s
                       ORDER BY "timestamp" DESC,id_ubicacion DESC LIMIT 1''', (device_id,))
        row = cur.fetchone()
    return jsonify({'data': {'ubicacion': serialize(row) if row else None}})


@bp.get('/historial')
@require_role('monitor')
def history():
    device_id = get_device()
    if device_id is None:
        return error('Especifica un identificador de dispositivo válido.')
    try:
        start = parse_datetime(request.args['desde']) if request.args.get('desde') else None
        end = parse_datetime(request.args['hasta']) if request.args.get('hasta') else None
    except ValueError as e:
        return error(str(e))
    if start and end and start > end:
        return error('La fecha inicial debe ser anterior a la final.')
    with connect_db() as db, db.cursor() as cur:
        if not authorized_device(cur, device_id, g.auth_user['id_usuario']):
            return error('No tienes acceso a este dispositivo.', 403)
        cur.execute('''SELECT id_ubicacion,id_dispositivo,latitud,longitud,altitud,"timestamp",nivel_energia
                       FROM public.ubicaciones
                       WHERE id_dispositivo=%s
                         AND (%s::timestamptz IS NULL OR "timestamp" >= %s::timestamptz)
                         AND (%s::timestamptz IS NULL OR "timestamp" <= %s::timestamptz)
                       ORDER BY "timestamp" DESC,id_ubicacion DESC LIMIT 1500''',
                    (device_id, start, start, end, end))
        rows = cur.fetchall()
    return jsonify({'data': [serialize(row) for row in rows]})
