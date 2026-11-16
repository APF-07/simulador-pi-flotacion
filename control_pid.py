"""Simulación educativa: 3 celdas de flotación con bombas peristálticas.
Modelo incremental integrador con retardo basado en Table 2 de Quintanilla et al. (2023).
El acoplamiento por caudales, las perturbaciones y los límites constituyen
simplificaciones didácticas; NO son datos experimentales originales.
Unidades: nivel [cm], caudal [L/min], tiempo [s].
"""
from collections import deque
from dataclasses import dataclass

K_PRIMA = -0.001018  # [cm/s]/[L/min] (tabla 2)
KC = (-62.0, -76.0, -85.0)  # L/min por cm, ganancias PI finales
TI = (56.0, 30.0, 44.0)  # s
THETA = (7, 6, 3)  # s
KFF = (0.8, 0.8, 1.0)
BASE = 45.0  # L/min; alimentación de referencia
MIN_Q, MAX_Q = 0.0, 100.0  # límites ilustrativos, no límites experimentales del artículo
MIN_H, MAX_H = 0.0, 39.0  # rango instrumental del artículo


def limite(valor, minimo, maximo):
    return max(minimo, min(maximo, valor))


def simular(modo='comparacion', nivel_objetivo=32.0, perturbacion=14.0, duracion=600):
    """Retorna trayectorias PI y PI+FF con dt=1 s y desglose matemático."""
    if modo not in ('pi', 'piff', 'comparacion'):
        raise ValueError('Modo no válido')
    nivel_objetivo = float(nivel_objetivo)
    perturbacion = float(perturbacion)
    duracion = int(duracion)
    if not (23 <= nivel_objetivo <= 36):
        raise ValueError('Nivel objetivo fuera de rango (23–36 cm)')
    if not (-20 <= perturbacion <= 20):
        raise ValueError('Perturbación fuera de rango (-20 a 20 L/min)')
    if not (180 <= duracion <= 1200):
        raise ValueError('Duración fuera de rango (180–1200 s)')

    inicio_pert = min(120, max(40, duracion // 5))
    fin_pert = min(320, max(inicio_pert + 30, int(duracion * .55)))
    cambio_sp = int(duracion * .66)

    def recorrer(con_ff):
        nivel = [30.0] * 3
        integral = [0.0] * 3  # cm s
        q_pasados = [deque([BASE] * (retardo + 1), maxlen=retardo + 1) for retardo in THETA]
        ff_acumulado = [0.0] * 3
        qin_ant = [BASE] * 3
        series = []
        iae = [0.0] * 3
        sse = [0.0] * 3

        for t in range(duracion + 1):
            sp = nivel_objetivo if t >= cambio_sp else 30.0
            entrada_externa = BASE + (perturbacion if inicio_pert <= t < fin_pert else 0.0)
            # El caudal saliente de la celda anterior alimenta la siguiente.
            entradas = [entrada_externa, 0.0, 0.0]
            salidas = [0.0, 0.0, 0.0]  # caudales reales tras retardo
            consignas_bomba = [0.0, 0.0, 0.0]
            errores = [0.0, 0.0, 0.0]
            proporcionales = [0.0, 0.0, 0.0]
            integrales = [0.0, 0.0, 0.0]
            ff_terminos = [0.0, 0.0, 0.0]
            d_niveles = [0.0, 0.0, 0.0]
            antes = nivel[:]

            for i in range(3):
                if i > 0:
                    entradas[i] = salidas[i - 1]
                errores[i] = sp - antes[i]
                # Ecuación (7): PI + Kff * ΔQ; ΔQ es el cambio incremental
                # del caudal medido, por lo que se acumula para una acción persistente.
                delta_entrada = entradas[i] - qin_ant[i]
                if con_ff:
                    ff_acumulado[i] += KFF[i] * delta_entrada
                ff_terminos[i] = ff_acumulado[i] if con_ff else 0.0
                proporcionales[i] = KC[i] * errores[i]
                candidata = integral[i] + errores[i]  # dt=1 s
                integrales[i] = KC[i] / TI[i] * candidata
                q_sin_limite = BASE + proporcionales[i] + integrales[i] + ff_terminos[i]
                q_lim = limite(q_sin_limite, MIN_Q, MAX_Q)
                # Anti-windup por integración condicional (saturación del actuador).
                if q_sin_limite == q_lim or (q_sin_limite < MIN_Q and KC[i] * errores[i] > 0) or (q_sin_limite > MAX_Q and KC[i] * errores[i] < 0):
                    integral[i] = candidata
                integrales[i] = KC[i] / TI[i] * integral[i]
                consignas_bomba[i] = limite(BASE + proporcionales[i] + integrales[i] + ff_terminos[i], MIN_Q, MAX_Q)
                q_pasados[i].append(consignas_bomba[i])
                q_retrasado = q_pasados[i][0]
                salidas[i] = q_retrasado
                # Ecuación integradora en desviaciones respecto del caudal de entrada:
                # dh/dt = k' * [Q_salida(t-theta) - Q_entrada(t)]
                d_niveles[i] = K_PRIMA * (q_retrasado - entradas[i])
                qin_ant[i] = entradas[i]
                if t < duracion:
                    iae[i] += abs(errores[i])
                    sse[i] += errores[i] ** 2

            nivel = [limite(antes[i] + d_niveles[i], MIN_H, MAX_H) for i in range(3)]
            series.append({
                't': t, 'sp': round(sp, 3),
                'h': [round(x, 4) for x in nivel],
                'q_in': [round(x, 4) for x in entradas],
                'q_out': [round(x, 4) for x in salidas],
                'q_cmd': [round(x, 4) for x in consignas_bomba],
                'h_anterior': [round(x, 4) for x in antes],
                'e': [round(x, 4) for x in errores],
                'p': [round(x, 4) for x in proporcionales],
                'i': [round(x, 4) for x in integrales],
                'ff': [round(x, 4) for x in ff_terminos],
                'dh': [round(x, 6) for x in d_niveles]
            })
        return {'series': series, 'iae': [round(x, 3) for x in iae], 'sse': [round(x, 3) for x in sse]}

    salida = {
        'parametros': {'kc': KC, 'ti': TI, 'theta': THETA, 'kff': KFF, 'k_prima': K_PRIMA, 'base': BASE, 'dt': 1},
        'eventos': {'perturbacion_inicio': inicio_pert, 'perturbacion_fin': fin_pert, 'cambio_sp': cambio_sp},
        'configuracion': {'modo': modo, 'nivel_objetivo': nivel_objetivo, 'perturbacion': perturbacion, 'duracion': duracion},
    }
    if modo in ('pi', 'comparacion'):
        salida['pi'] = recorrer(False)
    if modo in ('piff', 'comparacion'):
        salida['piff'] = recorrer(True)
    return salida


if __name__ == '__main__':
    demo = simular()
    print('SIMULADOR MATEMÁTICO - 3 CELDAS')
    for nombre in ('pi', 'piff'):
        d = demo[nombre]
        print(nombre.upper(), '| IAE por celda [cm*s]:', d['iae'], '| SSE:', d['sse'])
    instante = demo['piff']['series'][200]
    print('Ejemplo desarrollado t=200 s:', instante)
