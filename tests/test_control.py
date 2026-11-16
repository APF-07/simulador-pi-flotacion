import unittest
from control_pid import simular, KC, TI, THETA


class PruebasSimulador(unittest.TestCase):
    def test_tabla_dos(self):
        self.assertEqual(KC, (-62.0, -76.0, -85.0))
        self.assertEqual(TI, (56.0, 30.0, 44.0))
        self.assertEqual(THETA, (7, 6, 3))

    def test_longitud_y_restricciones(self):
        r = simular(duracion=180)
        for modo in ('pi', 'piff'):
            self.assertEqual(len(r[modo]['series']), 181)
            for p in r[modo]['series']:
                self.assertTrue(all(0 <= h <= 39 for h in p['h']))
                self.assertTrue(all(0 <= q <= 100 for q in p['q_out']))
                self.assertTrue(all(0 <= q <= 100 for q in p['q_cmd']))

    def test_feedforward_mejora_error_predeterminado(self):
        r = simular()
        self.assertTrue(all(x < y for x, y in zip(r['piff']['iae'], r['pi']['iae'])))

    def test_ejemplo_balance(self):
        r = simular(modo='piff')
        p = r['piff']['series'][200]
        for i in range(3):
            calculado = -0.001018*(p['q_out'][i]-p['q_in'][i])
            self.assertAlmostEqual(calculado, p['dh'][i], places=5)

    def test_validacion(self):
        with self.assertRaises(ValueError):
            simular(duracion=100)
        with self.assertRaises(ValueError):
            simular(nivel_objetivo=99)


if __name__ == '__main__':
    unittest.main()
