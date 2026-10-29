from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = root / 'frontend/assets/js/pages/dashboard.js'
if not js.exists():
    raise SystemExit(f'No se encontró {js}. Ejecuta desde la raíz del repositorio.')
source = js.read_text(encoding='utf-8')
line = "import './dashboard-identifiers.js';"
if line in source:
    print('El módulo de identificadores ya está habilitado.')
else:
    js.write_text(line + '\n' + source, encoding='utf-8')
    print('Identificadores habilitados en dashboard.js; tus demás cambios se conservaron.')
