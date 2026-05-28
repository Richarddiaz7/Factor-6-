// js/ui.js
// Manejo de la interfaz de usuario

class UIManager {
  constructor() {
    this.elementos = {
      turnoIndicador: document.getElementById('turno-indicador'),
      panelJugadores: document.getElementById('panel-jugadores'),
      botonGirar: document.getElementById('boton'),
      resultado: document.getElementById('resultado'),
      contadorPozo: document.getElementById('contador-pozo'),
      sorteoInfo: document.getElementById('sorteo-info'),
      mensajeVictoria: document.getElementById('mensaje-victoria'),
      mensajeTitulo: document.getElementById('mensaje-titulo'),
      mensajeTexto: document.getElementById('mensaje-texto')
    };
  }

  actualizarPanelJugadores(jugadores, turnoActual) {
    const panel = this.elementos.panelJugadores;
    if (!panel) return;
    
    panel.innerHTML = '';
    jugadores.forEach((jugador, index) => {
      const card = document.createElement('div');
      card.className = `jugador-card ${jugador.esIA ? 'ia' : ''} ${index === turnoActual ? 'activo' : ''}`;
      card.innerHTML = `
        <div class="jugador-emoji">${jugador.emoji || '🎮'}</div>
        <div class="jugador-nombre">${jugador.nombre || 'Jugador'}</div>
        <div class="jugador-fichas">🪙 ${jugador.fichas}</div>
      `;
      panel.appendChild(card);
    });
  }

  actualizarTablero(casillas, pozo) {
    // Actualizar casillas 1-5
    for (let i = 1; i <= 5; i++) {
      const casilla = document.getElementById(`casilla-${i}`);
      if (casilla) {
        if (casillas[i] !== null && casillas[i] !== undefined) {
          casilla.classList.add('ocupado');
        } else {
          casilla.classList.remove('ocupado');
        }
      }
    }

    // Actualizar pozo
    if (this.elementos.contadorPozo) {
      this.elementos.contadorPozo.textContent = pozo || 0;
      if (pozo > 0) {
        this.elementos.contadorPozo.classList.add('visible');
      } else {
        this.elementos.contadorPozo.classList.remove('visible');
      }
    }
  }

  actualizarIndicadorTurno(jugador, esHumano) {
    if (this.elementos.turnoIndicador) {
      this.elementos.turnoIndicador.textContent = esHumano 
        ? '🎮 Tu turno' 
        : `🤖 Turno de ${jugador.nombre}`;
    }
  }

  habilitarGiro(habilitar) {
    if (this.elementos.botonGirar) {
      this.elementos.botonGirar.disabled = !habilitar;
    }
  }

  mostrarResultadoTirada(numero) {
    if (this.elementos.resultado) {
      this.elementos.resultado.textContent = `🎯 ${numero}`;
      this.elementos.resultado.style.display = 'block';
    }
  }

  iluminarCasilla(numero) {
    document.querySelectorAll('.cuadrado, #c6').forEach(el => el.classList.remove('iluminado'));
    if (numero === 6) {
      document.getElementById('c6')?.classList.add('iluminado');
    } else {
      document.getElementById(`casilla-${numero}`)?.classList.add('iluminado');
    }
  }

  mostrarResultadoFinal(ganador, esHumano) {
    const mensaje = this.elementos.mensajeVictoria;
    if (mensaje) {
      mensaje.style.display = 'block';
      if (this.elementos.mensajeTitulo) {
        this.elementos.mensajeTitulo.textContent = esHumano ? '🎉 ¡VICTORIA!' : '😢 ¡DERROTA!';
      }
      if (this.elementos.mensajeTexto) {
        this.elementos.mensajeTexto.textContent = esHumano 
          ? '¡Has ganado la partida!' 
          : `${ganador.nombre} ha ganado.`;
      }
    }
  }

  ocultarResultadoFinal() {
    if (this.elementos.mensajeVictoria) {
      this.elementos.mensajeVictoria.style.display = 'none';
    }
  }
}

const uiManager = new UIManager();
