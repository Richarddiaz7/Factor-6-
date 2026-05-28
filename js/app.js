// js/app.js
// Punto de entrada principal - Factor 6 Online

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

let juegoActivo = false;
let salaActualId = null;
let partidaActualId = null;
let unsubscribeSala = null;
let unsubscribePartida = null;
let unsubscribeRanking = null;
let unsubscribeSalas = null;
let ultimaTiradaTimestamp = 0;  // Para evitar animaciones duplicadas

async function initApp() {
  console.log('🎲 Iniciando Factor 6 Online...');
  await AuthManager.loginAnonimo();
}

function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  const el = document.getElementById(id);
  if (el) el.classList.add('activa');
}

function mostrarPortada() {
  if (typeof uiManager !== 'undefined') uiManager.ocultarResultadoFinal();
  juegoActivo = false;
  if (typeof soundManager !== 'undefined') soundManager.stopMusic();
  mostrarPantalla('portada');
}

function mostrarInstrucciones() { mostrarPantalla('instrucciones'); }
function mostrarCreditos() {
  mostrarPantalla('creditos');
}
async function mostrarPerfil() {
  mostrarPantalla('perfil');
  const user = auth.currentUser;
  if (!user) return;
  try {
    const perfil = await AuthManager.obtenerPerfil(user.uid);
    if (perfil) {
      document.getElementById('perfil-monedas').textContent = perfil.monedas || 0;
      document.getElementById('perfil-puntuacion').textContent = perfil.puntuacion || 0;
      document.getElementById('perfil-partidas').textContent = perfil.partidasJugadas || 0;
      document.getElementById('perfil-ganadas').textContent = perfil.partidasGanadas || 0;
      document.getElementById('input-nombre').value = perfil.nombre || '';
    }
  } catch (e) {}
}

async function guardarNombre() {
  const user = auth.currentUser;
  const nombre = document.getElementById('input-nombre').value.trim();
  if (user && nombre) await AuthManager.actualizarNombre(user.uid, nombre);
}

// ========== LOBBY ==========
function mostrarLobby() {
  mostrarPantalla('lobby');
  document.getElementById('panel-multijugador').style.display = 'none';
  if (unsubscribeSalas) unsubscribeSalas();
  unsubscribeSalas = LobbyManager.escucharSalas(salas => {
    const contenedor = document.getElementById('salas-disponibles');
    if (!contenedor) return;
    if (salas.length === 0) {
      contenedor.innerHTML = '<p style="color:rgba(255,255,255,0.5);">No hay salas</p>';
      return;
    }
    const currentUid = auth.currentUser?.uid;
    contenedor.innerHTML = salas.map(sala => {
      const esCreador = currentUid && sala.creador === currentUid;
      const yaEsta = currentUid && sala.jugadores.some(j => j.uid === currentUid);
      let btns = '';
      if (!esCreador && !yaEsta) btns += `<button class="btn-pequeno btn-unirse" onclick="unirseASala('${sala.id}')">Unirse</button>`;
      if (esCreador && sala.jugadores.length >= 2) btns += `<button class="btn-pequeno btn-iniciar" onclick="iniciarPartida('${sala.id}')">Iniciar</button>`;
      return `<div class="sala-card"><div><strong>${sala.creadorNombre}</strong> ${sala.modo==='solitario'?'🤖':'👥'}<br><small>${sala.jugadores.length}/${sala.maxJugadores}</small> ${sala.apuesta>0?'💰'+sala.apuesta:''}</div><div>${btns}</div></div>`;
    }).join('');
  });
}

function mostrarPanelMultijugador() { document.getElementById('panel-multijugador').style.display = 'block'; }
async function crearSala(modo, numBots) { const id = await LobbyManager.crearSala(modo, numBots, 0, 1); if (id) suscribirseASala(id); }
async function crearSalaMultijugador() {
  const max = parseInt(document.getElementById('jugadores-select')?.value || 2);
  const apuesta = parseInt(document.getElementById('apuesta-select')?.value || 0);
  const id = await LobbyManager.crearSala('multijugador', 0, apuesta, max);
  if (id) suscribirseASala(id);
}
async function unirseASala(salaId) { await LobbyManager.unirseSala(salaId); suscribirseASala(salaId); }
async function iniciarPartida(salaId) { await LobbyManager.iniciarPartida(salaId); }

function suscribirseASala(salaId) {
  salaActualId = salaId;
  if (unsubscribeSala) unsubscribeSala();
  unsubscribeSala = LobbyManager.escucharSala(salaId, sala => {
    if (sala?.estado === 'jugando') iniciarPartidaDesdeSala(sala);
    if (sala?.estado === 'terminada') { LobbyManager.eliminarSala(salaId); salaActualId = null; }
    if (!sala) salaActualId = null;
  });
}

async function salirLobby() {
  if (salaActualId && auth.currentUser) {
    const doc = await db.collection('salas').doc(salaActualId).get();
    if (doc.exists && doc.data().estado === 'esperando' && doc.data().creador === auth.currentUser.uid)
      await LobbyManager.eliminarSala(salaActualId);
  }
  if (unsubscribeSalas) unsubscribeSalas();
  if (unsubscribeSala) unsubscribeSala();
  salaActualId = null;
  mostrarPortada();
}

// ========== RANKING ==========
function mostrarRanking() {
  mostrarPantalla('ranking');
  if (unsubscribeRanking) unsubscribeRanking();
  unsubscribeRanking = RankingManager.escucharRanking(ranking => {
    const contenedor = document.getElementById('ranking-lista');
    if (!contenedor) return;
    contenedor.innerHTML = ranking.length === 0 ? '<p>No hay jugadores</p>' :
      ranking.map((j, i) => `<div class="ranking-item">${['🥇','🥈','🥉'][i]||(i+1+'️⃣')} <strong>${j.nombre}</strong> <span style="float:right;">🏆 ${j.puntuacion} ✅ ${j.partidasGanadas||0}</span></div>`).join('');
  });
}
function salirRanking() { if (unsubscribeRanking) unsubscribeRanking(); mostrarPortada(); }

// ========== INICIAR PARTIDA DESDE SALA ==========
async function iniciarPartidaDesdeSala(sala) {
  partidaActualId = sala.id;
  const jugadores = sala.jugadores.map(j => ({
    nombre: j.nombre,
    emoji: '😎',
    fichas: 6,
    esIA: false,
    uid: j.uid
  }));

  // Añadir bots con uid predecible
  if (sala.modo === 'solitario') {
    for (let i = 0; i < sala.numBots; i++) {
      jugadores.push({
        nombre: `Bot-${i+1}`,
        emoji: '🤖',
        fichas: 6,
        esIA: true,
        uid: 'bot_' + (jugadores.length)  // uid único: bot_2, bot_3, etc.
      });
    }
  }

  const turnoInicial = await realizarSorteoLocal(jugadores);
  await GameManager.crearPartida(partidaActualId, jugadores, turnoInicial, sala.apuesta || 0);

  mostrarPantalla('juego');
  uiManager.ocultarResultadoFinal();
  if (typeof soundManager !== 'undefined') soundManager.startMusic();

  if (unsubscribePartida) unsubscribePartida();
  ultimaTiradaTimestamp = 0;

  unsubscribePartida = GameManager.escucharPartida(partidaActualId, partida => {
    if (!partida) return;

    uiManager.actualizarPanelJugadores(partida.jugadores, partida.turnoActual);
    uiManager.actualizarTablero(partida.casillas, partida.pozo);

    const actual = partida.jugadores[partida.turnoActual];
    const esHumano = !actual.esIA && actual.uid === auth.currentUser?.uid;
    uiManager.actualizarIndicadorTurno(actual, esHumano);
    uiManager.habilitarGiro(esHumano && partida.estado === 'jugando');
    uiManager.cambiarColorBoton(esHumano && partida.estado === 'jugando');

    // Animar solo si hay una nueva tirada
    if (partida.ultimaTirada && partida.ultimaTirada.timestamp !== ultimaTiradaTimestamp) {
      ultimaTiradaTimestamp = partida.ultimaTirada.timestamp;
      uiManager.animarRodillo(partida.ultimaTirada.numero, () => {
        uiManager.iluminarCasilla(partida.ultimaTirada.numero);
      });
    }

    if (partida.estado === 'terminada') {
      juegoActivo = false;
      const ganador = partida.jugadores[partida.ganador];
      const ganoYo = !ganador.esIA && ganador.uid === auth.currentUser?.uid;
      uiManager.mostrarResultadoFinal(ganador, ganoYo);
      if (typeof soundManager !== 'undefined') soundManager.stopMusic();
      if (unsubscribePartida) unsubscribePartida();
      GameManager.eliminarPartida(partidaActualId);
      partidaActualId = null;
      return;
    }

    // Turno de bot: usar el uid real del bot
    if (partida.estado === 'jugando' && actual.esIA) {
      setTimeout(() => {
        if (partidaActualId === sala.id) turnoIA(partidaActualId, actual.uid);
      }, 1500);
    }
  });

  juegoActivo = true;
}

async function realizarSorteoLocal(jugadores) {
  let ganador = null, intentos = 0;
  while (!ganador && intentos++ < 20) {
    const resultados = jugadores.map(() => Math.floor(Math.random() * 6) + 1);
    const max = Math.max(...resultados);
    const indices = resultados.reduce((a, n, i) => { if (n === max) a.push(i); return a; }, []);
    if (indices.length === 1) ganador = indices[0];
    await new Promise(r => setTimeout(r, 300));
  }
  return ganador === null ? Math.floor(Math.random() * jugadores.length) : ganador;
}

async function tirarPalanca() {
  if (!juegoActivo || !partidaActualId) return;
  const user = auth.currentUser;
  if (!user) return;

  uiManager.habilitarGiro(false);
  uiManager.cambiarColorBoton(false);

  const numero = Math.floor(Math.random() * 6) + 1;
  try {
    await GameManager.tirarDado(partidaActualId, user.uid, numero);
  } catch (e) {
    if (typeof soundManager !== 'undefined') soundManager.playError();
    uiManager.mostrarMensajeTemporal(e.message);
    // Restaurar botón si sigue siendo tu turno
    const doc = await db.collection('partidas').doc(partidaActualId).get();
    if (doc.exists && doc.data().estado === 'jugando') {
      const actual = doc.data().jugadores[doc.data().turnoActual];
      const esHumano = !actual.esIA && actual.uid === user.uid;
      uiManager.habilitarGiro(esHumano);
      uiManager.cambiarColorBoton(esHumano);
    }
  }
}

async function turnoIA(partidaId, botUid) {
  const numero = Math.floor(Math.random() * 6) + 1;
  try {
    await GameManager.tirarDado(partidaId, botUid, numero);
  } catch (e) {
    console.error('Error en turno IA:', e);
  }
}

// Controles de audio
function toggleMusica() {
  if (typeof soundManager === 'undefined') return;
  const enabled = soundManager.toggleMusic();
  const btn = document.getElementById('btnMusica');
  if (btn) btn.textContent = enabled ? '🎵' : '🎵🚫';
}

function toggleSonido() {
  if (typeof soundManager === 'undefined') return;
  const enabled = soundManager.toggleSfx();
  const btn = document.getElementById('btnSonido');
  if (btn) btn.textContent = enabled ? '🔊' : '🔇';
}

function configurarListeners() {
  document.getElementById('boton')?.addEventListener('click', e => {
    e.preventDefault();
    tirarPalanca();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  configurarListeners();
  initApp();
});
