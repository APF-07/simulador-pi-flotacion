# Guía de despliegue y comprobación — Simulador PI

## Qué se entrega
- `app.py`: servidor Flask, rutas `/`, `/api/simular` y `/health`.
- `control_pid.py`: cálculo Python de tres celdas, PI, PI+feedforward, retardo, balance e índices IAE y SSE.
- `templates/index.html`: panel de simulación web.
- `static/style.css` y `static/script.js`: gráficos, animaciones y peticiones a la API Python.
- `tests/test_control.py`: comprobaciones automáticas.
- `render.yaml`, `requirements.txt`, `Procfile`: configuración de hospedaje.

## En Windows (equipo del ingeniero)
1. Instalar Python 3.11 o posterior desde python.org, activar 'Add Python to PATH'.
2. Extraer el ZIP y entrar en la carpeta `simulador_pi_despliegue`.
3. Ejecutar `iniciar_windows.bat` (necesita Internet para instalar Flask una primera vez).
4. Abrir `http://127.0.0.1:5000` en el navegador de esa computadora.
5. Usar `verificar_modelo.bat` para las pruebas matemáticas y un ejemplo de resultados por consola.
6. Si se desea hacer manualmente: `py -m pip install -r requirements.txt` y después `py app.py`.

**No abrir `templates/index.html` haciendo doble clic**: necesita Flask para enviar las simulaciones al motor Python.

## En línea (Render)
1. Crear una cuenta en https://github.com y un repositorio nuevo, por ejemplo `simulador-pi-flotacion`.
2. Subir a la **raíz** del repositorio el contenido de esta carpeta (no subir el ZIP como un único archivo).
3. Crear una cuenta en https://render.com y autorizar la conexión con GitHub.
4. Render: `New` → `Web Service`; seleccionar el repositorio de GitHub.
5. Seleccionar Python y el plan Free; usar las instrucciones de `render.yaml` o definir manualmente:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn --bind 0.0.0.0:$PORT app:app`
6. Pulsar `Deploy Web Service`, esperar a que Render indique que está en línea y copiar la URL real que asigna, que será del tipo `https://<nombre>.onrender.com`.
7. Abrir la dirección y comprobar `https://<nombre>.onrender.com/health` (respuesta JSON con `estado: ok`).
8. En la web cambiar parámetros, pulsar Ejecutar simulación e inspeccionar gráficas y ecuaciones.

Nota: el plan gratuito de Render entra en suspensión tras inactividad y puede tardar al reactivarse. No se garantiza una dirección hasta completar el despliegue en una cuenta real.

## Modelos matemáticos disponibles
- Error: `e_i = SP_i - h_i`.
- PI discreto: `P_i = Kc_i * e_i`, `I_i = (Kc_i / Ti_i) * sum(e_i*dt)`.
- Feedforward del modelo didáctico: `FF_i = Kff_i * sum(Delta Q_entrada)`.
- Actuador: `Q_i = saturar(45 + P_i + I_i + FF_i, 0, 100)`.
- Balance integrador: `h_i(t+dt) = h_i(t) + k'*(Q_salida,retardado - Q_entrada)*dt`.
- Errores: `IAE=sum(abs(e_i)*dt)` y `SSE=sum(e_i**2)`.
- Parámetros de las tres celdas tomados de tabla 2: Kc=(-62,-76,-85), Ti=(56,30,44)s, retardos=(7,6,3)s, k'=-0.001018; Kff=(0.8,0.8,1.0) del texto de la página 12.

**Alcance:** el artículo presenta un sistema experimental real. El proyecto implementa una aproximación matemática educativa con perturbaciones sintéticas, límites de caudal ilustrativos y saturación; no pretende reproducir todas las mediciones experimentales.

## Entrega al docente
Enviar (1) la URL pública real de Render y (2) este archivo ZIP. El revisor puede usar la web o inspeccionar/ejecutar `control_pid.py` y los tests sin necesitar conexión a Render.
