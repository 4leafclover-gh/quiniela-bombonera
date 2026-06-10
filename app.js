/* =====================================================
   QUINIELA LA BOMBONERA · app.js (versión mínima funcional)
   Stack: Vanilla JS + Firebase Compat 10.12.2
   ===================================================== */

/* ===== 1) PEGA AQUÍ LA CONFIG DE TU PROYECTO FIREBASE ===== */
/* Console de Firebase → Configuración del proyecto → Tus apps → Web */
const firebaseConfig = {
  apiKey: "AIzaSyC7maKamaritBEEFzV_3-DC1JfKhIMuzAs",
  authDomain: "quiniela-bombonera-2026.firebaseapp.com",
  projectId: "quiniela-bombonera-2026",
  storageBucket: "quiniela-bombonera-2026.firebasestorage.app",
  messagingSenderId: "1079388852828",
  appId: "1:1079388852828:web:a202a5dcacaef837558c99",
  measurementId: "G-02D0DHPG52"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ===== Estado ===== */
let usuarioActual = null;   // { id, nombre, rol, pagado, ... }
let partidosCache = [];     // [{ id, ...datos }]

/* ===== Helpers ===== */
const $ = sel => document.querySelector(sel);
const mostrar = el => el.classList.remove('hidden');
const ocultar = el => el.classList.add('hidden');

/* ===== Banderas (nombre del equipo -> código ISO para flagcdn) ===== */
const BANDERAS = {
  "México":"mx", "Sudáfrica":"za", "Corea del Sur":"kr", "República Checa":"cz",
  "Canadá":"ca", "Bosnia y Herzegovina":"ba", "Catar":"qa", "Suiza":"ch",
  "Brasil":"br", "Marruecos":"ma", "Haití":"ht", "Escocia":"gb-sct",
  "Estados Unidos":"us", "Paraguay":"py", "Australia":"au", "Turquía":"tr",
  "Alemania":"de", "Curazao":"cw", "Costa de Marfil":"ci", "Ecuador":"ec",
  "Países Bajos":"nl", "Japón":"jp", "Túnez":"tn", "Suecia":"se",
  "Bélgica":"be", "Egipto":"eg", "Irán":"ir", "Nueva Zelanda":"nz",
  "España":"es", "Cabo Verde":"cv", "Arabia Saudita":"sa", "Uruguay":"uy",
  "Francia":"fr", "Senegal":"sn", "Irak":"iq", "Noruega":"no",
  "Argentina":"ar", "Argelia":"dz", "Austria":"at", "Jordania":"jo",
  "Portugal":"pt", "RD Congo":"cd", "Uzbekistán":"uz", "Colombia":"co",
  "Inglaterra":"gb-eng", "Croacia":"hr", "Ghana":"gh", "Panamá":"pa"
};
function bandera(nombre){
  const code = BANDERAS[nombre];
  if(!code) return '';
  return `<img class="flag" src="https://flagcdn.com/40x30/${code}.png" alt="" loading="lazy">`;
}

/* ===== LOGIN (con auto-registro la primera vez) ===== */
async function entrar(){
  const nombre = $('#inNombre').value.trim();
  const pin    = $('#inPin').value.trim();
  const msg    = $('#loginMsg');
  msg.style.color = 'var(--rojo)';
  msg.textContent = '';

  if(!nombre || !pin){ msg.textContent = 'Pon nombre y PIN.'; return; }

  const id  = nombre.toLowerCase();
  const ref = db.collection('usuarios').doc(id);

  try {
    const snap = await ref.get();
    if(!snap.exists){
      await ref.set({
        nombre, pin, rol:'jugador', pagado:false,
        puntos_totales:0, puntos_fase_grupos:0, puntos_bonus:0, aciertos_exactos:0
      });
      usuarioActual = { id, nombre, rol:'jugador', pagado:false };
    } else {
      const data = snap.data();
      if(String(data.pin) !== String(pin)){ msg.textContent = 'PIN incorrecto.'; return; }
      usuarioActual = { id, ...data };
    }
    iniciarApp();
  } catch(e){
    msg.textContent = 'Error de conexión. Revisa la config de Firebase.';
    console.error(e);
  }
}

function salir(){
  usuarioActual = null;
  ocultar($('#vistaApp')); mostrar($('#vistaLogin')); ocultar($('#userBox'));
  $('#inNombre').value=''; $('#inPin').value='';
}

/* ===== Arranque de la app tras login ===== */
async function iniciarApp(){
  ocultar($('#vistaLogin')); mostrar($('#vistaApp')); mostrar($('#userBox'));
  $('#userName').textContent = usuarioActual.nombre;

  if(usuarioActual.pagado === false) mostrar($('#alertaPago')); else ocultar($('#alertaPago'));
  if(usuarioActual.rol === 'admin')  mostrar($('#adminPanel')); else ocultar($('#adminPanel'));

  await cargarPartidos();
  await pintarPronosticos();
}

/* ===== Partidos ===== */
async function cargarPartidos(){
  const snap = await db.collection('partidos_oficiales').orderBy('id_orden').get();
  partidosCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function pintarPronosticos(){
  const cont = $('#listaPartidos');
  cont.innerHTML = '';

  if(partidosCache.length === 0){
    cont.innerHTML = '<p class="muted">Aún no hay partidos cargados. El admin debe agregarlos.</p>';
    return;
  }

  // Pronósticos previos del usuario
  let guardados = {};
  const ps = await db.collection('pronosticos').doc(usuarioActual.id).get();
  if(ps.exists){
    const d = ps.data();
    guardados = { ...(d.fase_grupos||{}), ...(d.fase_final||{}) };
  }

  let grupoActual = null;
  partidosCache.forEach(p => {
    if(p.grupo !== grupoActual){
      grupoActual = p.grupo;
      const h = document.createElement('h3');
      h.className = 'grupo-titulo';
      h.textContent = (p.fase === 'grupos' ? 'Grupo ' : '') + grupoActual;
      cont.appendChild(h);
    }
    const pred = guardados[p.id] || {};
    const card = document.createElement('div');
    card.className = 'partido';
    card.dataset.id = p.id;
    card.dataset.fase = p.fase || 'grupos';
    card.innerHTML = `
      <div class="equipos">
        <span>${p.equipo_a} ${bandera(p.equipo_a)}</span>
        <input class="goles ga" type="number" min="0" inputmode="numeric" value="${pred.goles_a ?? ''}">
        <span class="vs">-</span>
        <input class="goles gb" type="number" min="0" inputmode="numeric" value="${pred.goles_b ?? ''}">
        <span>${bandera(p.equipo_b)} ${p.equipo_b}</span>
      </div>
      <div class="meta">${p.fecha || ''} ${p.hora || ''}</div>`;
    cont.appendChild(card);
  });
}

async function guardarPronosticos(){
  const msg = $('#saveMsg');
  msg.style.color = 'var(--muted)';
  msg.textContent = 'Guardando...';

  const fase_grupos = {}, fase_final = {};
  document.querySelectorAll('.partido').forEach(card => {
    const ga = card.querySelector('.ga').value;
    const gb = card.querySelector('.gb').value;
    if(ga === '' || gb === '') return; // sin pronóstico, se omite
    const pred = { goles_a:Number(ga), goles_b:Number(gb) };
    if(card.dataset.fase === 'grupos') fase_grupos[card.dataset.id] = pred;
    else fase_final[card.dataset.id] = pred;
  });

  try {
    await db.collection('pronosticos').doc(usuarioActual.id)
      .set({ nombre:usuarioActual.nombre, fase_grupos, fase_final }, { merge:true });
    msg.style.color = 'var(--ok)';
    msg.textContent = '✅ Pronósticos guardados.';
  } catch(e){
    msg.style.color = 'var(--rojo)';
    msg.textContent = 'Error al guardar.';
    console.error(e);
  }
}

/* ===== Admin: agregar partido ===== */
async function agregarPartido(){
  const msg = $('#adminMsg');
  msg.style.color = 'var(--rojo)';
  const equipo_a = $('#aEqA').value.trim();
  const equipo_b = $('#aEqB').value.trim();
  const grupo    = $('#aGrupo').value.trim().toUpperCase();
  const fecha    = $('#aFecha').value;
  const hora     = $('#aHora').value;

  if(!equipo_a || !equipo_b || !grupo){ msg.textContent = 'Faltan equipos o grupo.'; return; }

  const id_orden = partidosCache.length + 1;
  const id = 'partido_' + String(id_orden).padStart(2,'0');

  try {
    await db.collection('partidos_oficiales').doc(id).set({
      fase:'grupos', grupo, equipo_a, equipo_b, fecha, hora,
      estado:'pendiente', resultado_real:null, id_orden
    });
    msg.style.color = 'var(--ok)';
    msg.textContent = `✅ ${equipo_a} vs ${equipo_b} agregado.`;
    $('#aEqA').value=''; $('#aEqB').value='';
    await cargarPartidos();
    await pintarPronosticos();
  } catch(e){
    msg.textContent = 'Error al agregar el partido.';
    console.error(e);
  }
}

/* ===== Eventos ===== */
$('#btnEntrar').addEventListener('click', entrar);
$('#btnSalir').addEventListener('click', salir);
$('#btnGuardar').addEventListener('click', guardarPronosticos);
$('#btnAddPartido').addEventListener('click', agregarPartido);
$('#inPin').addEventListener('keydown', e => { if(e.key === 'Enter') entrar(); });
