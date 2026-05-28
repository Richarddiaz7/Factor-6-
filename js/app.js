// js/app.js
// Punto de entrada principal - Factor 6 Online

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// Estado global
let currentGame = null;
let juegoActivo = false;
let salaActualId = null;
let partidaActualId = null;      // ID del documento en partidas (normalmente = salaId)
let unsubscribeSala = null;
let unsubscribePartida = null;   // Listener de la partida en Firestore
let unsubscribeRanking = null;
let unsubscribeSalas = null;

// ========================================
// INICIALIZACIÓN
// ========================================

async function initApp() {
  console.log('🎲 Iniciando Factor 6 Online...');
  await AuthManager.loginAnonimo();
}

// ========================================
// NAVEGACIÓN ENTRE PANTALLAS
// ========================================

function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  const el = document.getElementById(id);
  if (el) el.classList.add('activa');
}

function mostrarPortada() {
  if (typeof uiManager !== 'undefined') uiManager.ocultarResultadoFinal();
  juegoActivo = false;
  mostrarPantalla('portada');
}

function mostrarInstrucciones() {
  mostrarPantalla('instrucciones');
}

// ========================================
// PERFIL
// ========================================

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
  } catch (e) {
    console.error('Error cargando perfil:', e);
  }
}

async function guardarNombre() {
  const user = auth.currentUser;
  const nombre = document.getElementById('input-nombre').value.trim();
  if (user && nombre) {
    try {
      await AuthManager.actualizarNombre(user.uid, nombre);
      alert('✅ Nombre guardado');
    } catch (e) {
      alert('❌ Error al guardar');
    }
  }
}

// ========================================
// LOBBY Y SALAS
// ========================================

function mostrarLobby() {
  mostrarPantalla('lobby');
  
  const panel = document.getElementById('panel-multijugador');
  if (panel) panel.style.display = 'none';
  
  if (unsubscribeSalas) unsubscribeSalas();
  unsubscribeSalas = LobbyManager.escucharSalas(salas => {
    const contenedor = document.getElementById('salas-disponibles');
    if (!contenedor) return;

    if (salas.length === 0) {
      contenedor.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center;">No hay salas disponibles. ¡Crea una!</p>';
      return;
    }

    const currentUid = auth.currentUser?.uid;

    contenedor.innerHTML = salas.map(sala => {
      const esCreador = currentUid && sala.creador === currentUid;
      const yaEstaEnSala = currentUid && sala.jugadores.some(j => j.uid === currentUid);
      
      let botonesHTML = '';
      
      if (!esCreador && !yaEstaEnSala) {
        botonesHTML += `<button class="btn-pequeno btn-unirse" onclick="unirseASala('${sala.id}')">Unirse</button>`;
      }
      if (esCreador && sala.jugadores.length >= 2) {
        botonesHTML += `<button class="btn-pequeno btn-iniciar" onclick="iniciarPartida('${sala.id}')">Iniciar</button>`;
      }

      return `
        <div class="sala-card">
          <div>
            <strong>${sala.creadorNombre || 'Anónimo'}</strong>
            ${sala.modo === 'solitario' ? '🤖' : '👥'}
            <br><small>${sala.jugadores.length}/${sala.maxJugadores} jugadores</small>
            ${sala.apuesta > 0 ? ` | 💰${sala.apuesta}` : ''}
          </div>
          <div style="display:flex; gap:5px;">${botonesHTML}</div>
        </div>
      `;
    }).join('');
  });
}

function mostrarPanelMultijugador() {
  const panel = document.getElementById('panel-multijugador');
  if (panel) panel.style.display = 'block';
}

async function crearSala(modo, numBots) {
  console.log(`🎯 Creando sala: ${modo}, bots: ${numBots}`);
  try {
    const salaId = await LobbyManager.crearSala(modo, numBots, 0, 1);
    if (salaId) {
      suscribirseASala(salaId);
      console.log('✅ Sala solitario creada:', salaId);
    }
  } catch (e) {
    console.error('Error:', e);
    alert('❌ Error al crear sala');
  }
}

async function crearSalaMultijugador() {
  console.log('🎯 Creando sala multijugador...');
  
  const jugadoresSelect = document.getElementById('jugadores-select');
  const maxJugadores = jugadoresSelect ? parseInt(jugadoresSelect.value) : 2;
  
  const apuestaSelect = document.getElementById('apuesta-select');
  const apuesta = apuestaSelect ? parseInt(apuestaSelect.value) : 0;
  
  console.log(`👥 Max jugadores: ${maxJugadores}, 💰 Apuesta: ${apuesta}`);
  
  try {
    const salaId = await LobbyManager.crearSala('multijugador', 0, apuesta, maxJugadores);
    if (salaId) {
      suscribirseASala(salaId);
      alert(`✅ Sala creada (${maxJugadores} jugadores). Comparte el código o espera.`);
    }
  } catch (e) {
    console.error('Error:', e);
    alert('❌ Error al crear sala multijugador');
  }
}

async function unirseASala(salaId) {
  console.log('🔗 Uniendo a sala:', salaId);
  try {
    await LobbyManager.unirseSala(salaId);
    suscribirseASala(salaId);
    alert('✅ Te has unido a la sala');
  } catch (error) {
    alert('❌ ' + error.message);
  }
}

async function iniciarPartida(salaId) {
  console.log('▶️ Iniciando partida:', salaId);
  await LobbyManager.iniciarPartida(salaId);
}

function suscribirseASala(salaId) {
  salaActualId = salaId;
  if (unsubscribeSala) unsubscribeSala();
  unsubscribeSala = LobbyManager.escucharSala(salaId, sala => {
    if (sala && sala.estado === 'jugando') {
      iniciarPartidaDesdeSala(sala);
    }
    if (sala && sala.estado === 'terminada') {
      console.log('🏁 Sala terminada');
      LobbyManager.eliminarSala(salaId);
      salaActualId = null;
    }
    if (!sala) {
      salaActualId = null;
    }
  });
}

async function salirLobby() {
  if (salaActualId && auth.currentUser) {
    try {
      const salaDoc = await db.collection('salas').doc(salaActualId).get();
      if (salaDoc.exists) {
        const sala = salaDoc.data();
        if (sala.estado === 'esperando' && sala.creador === auth.currentUser.uid) {
          await LobbyManager.eliminarSala(salaActualId);
        }
      }
    } catch (e) {
      console.error('Error al limpiar sala al salir:', e);
    }
  }
  
  if (unsubscribeSalas) unsubscribeSalas();
  if (unsubscribeSala) unsubscribeSala();
  salaActualId = null;
  mostrarPortada();
}

// ========================================
// RANKING
// ========================================

function mostrarRanking() {
  mostrarPantalla('ranking');
  if (unsubscribeRanking) unsubscribeRanking();
  unsubscribeRanking = RankingManager.escucharRanking(ranking => {
    const contenedor = document.getElementById('ranking-lista');
    if (!contenedor) return;
    if (ranking.length === 0) {
      contenedor.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center;">No hay jugadores aún</p>';
      return;
    }
    contenedor.innerHTML = ranking.map((jugador, index) => {
      const medallas = ['🥇', '🥈', '🥉'];
      const medalla = index < 3 ? medallas[index] : `${index + 1}️⃣`;
      return `
        <div class="ranking-item">
          ${medalla} <strong>${jugador.nombre || 'Anónimo'}</strong>
          <span style="float:right;">🏆 ${jugador.puntuacion} | ✅ ${jugador.partidasGanadas || 0}</span>
        </div>
      `;
    }).join('');
  });
}

function salirRanking() {
  if (unsubscribeRanking) unsubscribeRanking();
  mostrarPortada();
}

// ========================================
// INICIAR PARTIDA DESDE SALA (con Firestore)
// ========================================

async function iniciarPartidaDesdeSala(sala) {
  console.log('🎮 Iniciando partida desde sala:', sala.id);
  
  partidaActualId = sala.id; // usamos el mismo ID de sala para la partida
  
  // Construir jugadores
  const jugadores = sala.jugadores.map(j => ({
    nombre: j.nombre,
    emoji: '😎',
    fichas: 6,
    esIA: false,
    uid: j.uid
  }));

  // Añadir bots en solitario
  if (sala.modo === 'solitario') {
    for (let i = 0; i < sala.numBots; i++) {
      jugadores.push({
        nombre: `Bot-${i + 1}`,
        emoji: '🤖',
        fichas: 6,
        esIA: true,
        uid: 'bot_' + i
      });
    }
  }

  // Sorteo para ver quién empieza
  const turnoInicial = await realizarSorteoLocal(jugadores);

  // Crear documento de partida en Firestore
  await GameManager.crearPartida(partidaActualId, jugadores, turnoInicial, sala.apuesta || 0);

  // Mostrar pantalla de juego
  mostrarPantalla('juego');
  uiManager.ocultarResultadoFinal();

  // Escuchar cambios en la partida
  if (unsubscribePartida) unsubscribePartida();
  unsubscribePartida = GameManager.escucharPartida(partidaActualId, (partida) => {
    // Actualizar UI con el estado remoto
    uiManager.actualizarPanelJugadores(partida.jugadores, partida.turnoActual);
    uiManager.actualizarTablero(partida.casillas, partida.pozo);
    
    const jugadorActual = partida.jugadores[partida.turnoActual];
    const esHumano = !jugadorActual.esIA;
    uiManager.actualizarIndicadorTurno(jugadorActual, esHumano);
    uiManager.habilitarGiro(esHumano && partida.estado === 'jugando');

    // Iluminar última tirada
    if (partida.ultimaTirada) {
      uiManager.iluminarCasilla(partida.ultimaTirada.numero);
    }

    // Verificar fin de partida
    if (partida.estado === 'terminada') {
      juegoActivo = false;
      const ganador = partida.jugadores[partida.ganador];
      const esHumanoGanador = !ganador.esIA;
      uiManager.mostrarResultadoFinal(ganador, esHumanoGanador);
      uiManager.habilitarGiro(false);
      
      // Limpiar
      if (unsubscribePartida) unsubscribePartida();
      GameManager.eliminarPartida(partidaActualId);
      partidaActualId = null;
      
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(esHumanoGanador ? 'success' : 'error');
    }

    // Si el turno es de un bot, hacer que tire automáticamente
    if (partida.estado === 'jugando' && jugadorActual.esIA && partida.turnoActual !== undefined) {
      setTimeout(() => turnoIA(partidaActualId, partida.turnoActual), 1500);
    }
  });

  juegoActivo = true;
}

// Sorteo local (sin Firestore)
async function realizarSorteoLocal(jugadores) {
  let ganador = null;
  let intentos = 0;
  while (!ganador && intentos < 20) {
    intentos++;
    const resultados = jugadores.map(() => Math.floor(Math.random() * 6) + 1);
    const maxNum = Math.max(...resultados);
    const ganadoresIndices = resultados.reduce((acc, num, idx) => {
      if (num === maxNum) acc.push(idx);
      return acc;
    }, []);
    if (ganadoresIndices.length === 1) ganador = ganadoresIndices[0];
    await new Promise(r => setTimeout(r, 300));
  }
  if (ganador === null) ganador = Math.floor(Math.random() * jugadores.length);
  return ganador;
}

// ========================================
// GESTIÓN DE TURNOS (basado en Firestore)
// ========================================

async function tirarPalanca() {
  if (!juegoActivo || !partidaActualId) return;

  const user = auth.currentUser;
  if (!user) return;

  const numero = Math.floor(Math.random() * 6) + 1;
  console.log('🎲 Tirando dado:', numero);

  // Deshabilitar botón inmediatamente
  uiManager.habilitarGiro(false);

  try {
    await GameManager.tirarDado(partidaActualId, user.uid, numero);
    // La UI se actualizará a través del listener
    document.getElementById('resultado').textContent = `🎯 ${numero}`;
    document.getElementById('resultado').style.display = 'block';
  } catch (error) {
    console.error('Error al tirar:', error);
    alert(error.message);
    // Re-habilitar si falla
    uiManager.habilitarGiro(true);
  }
}

async function turnoIA(partidaId, turnoIA) {
  if (!juegoActivo) return;
  
  const numero = Math.floor(Math.random() * 6) + 1;
  console.log('🤖 IA tirando:', numero);
  
  try {
    // Construir un uid para el bot (debe coincidir con el que está en el documento)
    const botUid = 'bot_' + turnoIA; // asumiendo que los bots se nombraron así
    await GameManager.tirarDado(partidaId, botUid, numero);
  } catch (error) {
    console.error('Error en turno IA:', error);
  }
}

function animarRodilloSimple(numeroFinal, callback) {
  const rodillo = document.getElementById('numeros');
  if (!rodillo) { if (callback) callback(); return; }
  let frames = 0;
  const total = 30;
  const intervalo = setInterval(() => {
    rodillo.innerHTML = `<div class="numero-rodillo">${Math.floor(Math.random() * 6) + 1}</div>`;
    if (++frames >= total) {
      clearInterval(intervalo);
      rodillo.innerHTML = `<div class="numero-rodillo">${numeroFinal}</div>`;
      if (callback) callback();
    }
  }, 50);
}

function configurarListeners() {
  const boton = document.getElementById('boton');
  if (boton) {
    boton.addEventListener('click', (e) => {
      e.preventDefault();
      tirarPalanca();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  configurarListeners();
  initApp();
});
