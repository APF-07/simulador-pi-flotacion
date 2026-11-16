'use strict';
const $ = id => document.getElementById(id);
const colores = {pi:'#29c8e9', piff:'#35d7ad', sp:'#f7c56b', grid:'#34445e'};
let datos = null, tActual = 0, timer = null, celda = 0;
const formato = (n, dec=2) => Number(n).toFixed(dec);

async function ejecutar() {
  detener();
  $('notice').textContent = '';
  $('run').disabled = true;
  $('estado').textContent = 'Calculando…';
  try {
    const res = await fetch('/api/simular', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        modo:$('modo').value, nivel_objetivo:Number($('sp').value),
        perturbacion:Number($('dist').value), duracion:Number($('duracion').value)
      })
    });
    const obj = await res.json();
    if (!res.ok) throw new Error(obj.error || `Error ${res.status}`);
    datos = obj;
    $('slider').max = obj.configuracion.duracion;
    $('estado').textContent = 'Simulación calculada';
    cambiarInstante(0);
    pintarEstadisticas();
    dibujarGraficas();
    reproducir();
  } catch (err) {
    $('estado').textContent = 'Error';
    $('notice').textContent = err.message + '. Confirma que el servidor Flask esté encendido.';
  } finally { $('run').disabled = false; }
}
function activo() { return datos?.piff || datos?.pi; }
function detener() { clearInterval(timer); timer = null; $('play').textContent = '▶ Reproducir'; }
function reproducir() {
  if (!datos) return;
  if (timer) { detener(); return; }
  if (tActual >= datos.configuracion.duracion) cambiarInstante(0);
  $('play').textContent = '❚❚ Pausar';
  timer = setInterval(() => {
    if (tActual >= datos.configuracion.duracion) { detener(); return; }
    cambiarInstante(Math.min(tActual + 3, datos.configuracion.duracion));
  }, 45);
}
function cambiarInstante(segundo) {
  if (!datos) return;
  tActual = Math.round(Number(segundo));
  const punto = activo().series[tActual];
  $('slider').value = tActual;
  $('tiempo').textContent = `${tActual} s`;
  for (let i=0; i<3; i++) {
    $('agua'+i).style.height = `${Math.min(100,Math.max(0,punto.h[i] / 39 * 100))}%`;
    $('h'+i).textContent = `${formato(punto.h[i])} cm`;
    $('qin'+i).textContent = formato(punto.q_in[i],1);
    $('qout'+i).textContent = formato(punto.q_out[i],1);
  }
  pintarEcuaciones(punto);
  dibujarGraficas();
}
function pintarEcuaciones(p) {
  if (!datos) return;
  const i=celda, prm=datos.parametros;
  const kc=prm.kc[i], ti=prm.ti[i], ff=prm.kff[i], theta=prm.theta[i];
  const integralError = p.i[i]*ti/kc;
  const referencia = datos.configuracion.nivel_objetivo;
  $('eqError').textContent =
    `e${i+1} = SP − h = ${formato(p.sp)} − ${formato(p.h_anterior[i],4)} = ${formato(p.e[i],4)} cm\n`+
    `P${i+1} = Kc · e = (${kc}) · (${formato(p.e[i],4)}) = ${formato(p.p[i],4)} L/min`;
  $('eqControl').textContent =
    `I${i+1} = (Kc / Ti) · ∫e dt = (${kc} / ${ti}) · (${formato(integralError,4)}) = ${formato(p.i[i],4)} L/min\n`+
    `FF${i+1} = Kff · ΣΔQ = ${ff} · ΣΔQ = ${formato(p.ff[i],4)} L/min\n`+
    `Qorden = sat[45 + P + I + FF] = ${formato(p.q_cmd[i],4)} L/min\n`+
    `Qreal = Qorden(t − ${theta}s) = ${formato(p.q_out[i],4)} L/min`;
  $('eqNivel').textContent =
    `dh/dt = k' · [Qsalida(t−θ) − Qentrada]\n`+
    `dh/dt = (${prm.k_prima}) × [${formato(p.q_out[i],4)} − ${formato(p.q_in[i],4)}]\n`+
    `dh/dt = ${formato(p.dh[i],6)} cm/s\n`+
    `h(t+1) = sat[${formato(p.h_anterior[i],4)} + (${formato(p.dh[i],6)})×1]\n`+
    `h(t+1) = ${formato(p.h[i],4)} cm`;
  const res = activo();
  $('eqMetrica').textContent =
    `IAE${i+1} = Σ |SP − h| Δt = ${formato(res.iae[i],3)} cm·s\n`+
    `SSE${i+1} = Σ (SP − h)² = ${formato(res.sse[i],3)} cm²\n`+
    `Método: integración Euler, Δt = 1 s.\n`+
    `Objetivo posterior al escalón: ${referencia} cm`;
}
function pintarEstadisticas() {
  if (!datos) return;
  const a=datos.pi, b=datos.piff;
  let html='';
  for (let i=0;i<3;i++) {
    let texto='';
    if (a && b) {
      const mejora = a.iae[i] ? 100*(a.iae[i]-b.iae[i])/a.iae[i] : 0;
      texto = `<small>${mejora>=0?'Mejora':'Empeora'} ${Math.abs(mejora).toFixed(1)}% frente a PI</small>`;
    }
    const principal=b||a;
    html += `<div class="stat"><span>Celda ${i+1} · IAE ${b?'PI + FF':'PI'}</span><strong>${formato(principal.iae[i],1)}</strong><span>cm·s</span>${texto}</div>`;
  }
  $('stats').innerHTML = html;
}
function canvasPreparado(id) {
  const can=$(id), ctx=can.getContext('2d'), ratio=window.devicePixelRatio||1;
  const w=can.clientWidth, h=can.clientHeight;
  can.width=Math.max(1,Math.round(w*ratio)); can.height=Math.max(1,Math.round(h*ratio));
  ctx.setTransform(ratio,0,0,ratio,0,0);
  return {ctx,w,h};
}
function graficoLineas(id, series, limY, etiquetaY) {
  const {ctx,w,h}=canvasPreparado(id), pad={l:48,r:12,t:18,b:30};
  const x0=pad.l,y0=pad.t, pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
  const maxT=datos.configuracion.duracion;
  ctx.font='11px Segoe UI, sans-serif';
  ctx.strokeStyle=colores.grid; ctx.lineWidth=1;
  for(let j=0;j<=4;j++) {
    const y=y0+j*ph/4, val=limY[1]-(limY[1]-limY[0])*j/4;
    ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+pw,y);ctx.stroke();
    ctx.fillStyle='#9db4d0';ctx.fillText(formato(val,0),4,y+4);
  }
  for(let j=0;j<=4;j++) {
    const x=x0+j*pw/4;
    ctx.fillStyle='#9db4d0';ctx.fillText(`${Math.round(j*maxT/4)}s`,x-10,h-9);
  }
  ctx.fillStyle='#b0c3d9';ctx.fillText(etiquetaY,7,12);
  for(const s of series) {
    if(!s.puntos)continue;
    ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();
    s.puntos.forEach((v,j)=>{
      const x=x0+j/maxT*pw, y=y0+(limY[1]-v)/(limY[1]-limY[0])*ph;
      j===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });ctx.stroke();
  }
  ctx.strokeStyle='#fff9';ctx.setLineDash([4,4]);ctx.beginPath();
  let cursorX=x0+tActual/maxT*pw;ctx.moveTo(cursorX,y0);ctx.lineTo(cursorX,y0+ph);ctx.stroke();ctx.setLineDash([]);
}
function dibujarBarras() {
  if(!datos)return;
  const {ctx,w,h}=canvasPreparado('errorChart'), izq=43, top=20, alto=h-50;
  const pares=[];
  for(let i=0;i<3;i++) {
    if(datos.pi) pares.push({label:`PI C${i+1}`,valor:datos.pi.iae[i],color:colores.pi});
    if(datos.piff) pares.push({label:`FF C${i+1}`,valor:datos.piff.iae[i],color:colores.piff});
  }
  const max=Math.max(1,...pares.map(x=>x.valor))*1.2;
  const ancho=(w-izq-12)/pares.length;
  ctx.font='10px Segoe UI';
  pares.forEach((p,j)=>{
    const barra=Math.max(0,p.valor/max*alto), x=izq+j*ancho+4, y=top+alto-barra;
    ctx.fillStyle=p.color;ctx.fillRect(x,y,Math.max(4,ancho-8),barra);
    ctx.fillStyle='#d8e6f5';ctx.fillText(p.valor.toFixed(0),x,y-5);
    ctx.fillStyle='#aabfd8';ctx.fillText(p.label,x,h-11);
  });
}
function dibujarGraficas() {
  if(!datos)return;
  const indice=celda, a=datos.pi?.series, b=datos.piff?.series;
  graficoLineas('nivelChart',[
    {color:colores.sp,puntos:(a||b).map(p=>p.sp)},
    {color:colores.pi,puntos:a?.map(p=>p.h[indice])},
    {color:colores.piff,puntos:b?.map(p=>p.h[indice])}
  ],[27,37],`Nivel C${indice+1} (cm)`);
  graficoLineas('bombaChart',[
    {color:colores.pi,puntos:a?.map(p=>p.q_out[indice])},
    {color:colores.piff,puntos:b?.map(p=>p.q_out[indice])}
  ],[0,100],`Bomba ${indice+1} (L/min)`);
  dibujarBarras();
}
function csvDescarga() {
  if(!datos)return;
  const sep=';';
  const lineas=[['modo','tiempo_s','celda','setpoint_cm','nivel_cm','entrada_lpm','salida_lpm','orden_bomba_lpm','error_cm','P_lpm','I_lpm','FF_lpm','dh_cm_s'].join(sep)];
  for(const modo of ['pi','piff']) {
    if(!datos[modo])continue;
    for(const p of datos[modo].series)for(let i=0;i<3;i++) {
      lineas.push([modo,p.t,i+1,p.sp,p.h[i],p.q_in[i],p.q_out[i],p.q_cmd[i],p.e[i],p.p[i],p.i[i],p.ff[i],p.dh[i]].join(sep));
    }
  }
  const blob=new Blob(['\ufeff'+lineas.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob), enlace=document.createElement('a');
  enlace.href=url;enlace.download='resultados_simulador_pid.csv';enlace.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('run').addEventListener('click',ejecutar);
$('play').addEventListener('click',reproducir);
$('slider').addEventListener('input', e=>{detener();cambiarInstante(e.target.value)});
$('celda').addEventListener('change',e=>{celda=Number(e.target.value);if(datos)cambiarInstante(tActual)});
$('exportar').addEventListener('click',csvDescarga);
window.addEventListener('resize',()=>{if(datos)dibujarGraficas()});
ejecutar();
