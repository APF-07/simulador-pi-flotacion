from flask import Flask, jsonify, render_template, request
from control_pid import simular

app = Flask(__name__)


@app.get('/')
def inicio():
    return render_template('index.html')


@app.get('/health')
def salud():
    return jsonify({'estado': 'ok', 'motor': 'Python PI/PI+FF'})


@app.post('/api/simular')
def api_simular():
    try:
        datos = request.get_json(force=True) or {}
        resultado = simular(
            modo=datos.get('modo', 'comparacion'),
            nivel_objetivo=datos.get('nivel_objetivo', 32),
            perturbacion=datos.get('perturbacion', 14),
            duracion=datos.get('duracion', 600)
        )
        return jsonify(resultado)
    except (ValueError, TypeError, OverflowError) as error:
        return jsonify({'error': str(error)}), 400


if __name__ == '__main__':
    import os
    app.run(debug=False, host='127.0.0.1', port=int(os.environ.get('PORT', 5000)))
