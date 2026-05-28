// js/lobby.js
// Lógica de creación, unión y gestión de salas

class LobbyManager {

  /**
   * Crea una nueva sala en Firestore.
   * @param {string} modo - 'solitario' o 'multijugador'
   * @param {number} numBots - número de bots (solo para solitario)
   * @param {number} apuesta - monedas apostadas
   * @param {number} maxJugadores - máximo de jugadores humanos (solo multijugador)
   * @returns {Promise<string|null>} ID de la sala creada
   */
  static async crearSala(modo, numBots = 1, apuesta = 0, maxJugadores = 4) {
    const user = auth.currentUser;
    if (!user) {
      alert('❌ Debes iniciar sesión primero');
      return null;
    }

    const perfil = await AuthManager.obtenerPerfil(user.uid);
    const nombre = perfil?.nombre || 'Jugador';

    // Verificar monedas si hay apuesta
    if (apuesta > 0 && perfil && perfil.monedas < apuesta) {
      alert(`❌ No tienes suficientes monedas. Tienes ${perfil.monedas} 💰`);
      return null;
    }

    try {
      const salaRef = await db.collection('salas').add({
        creador: user.uid,
        creadorNombre: nombre,
        estado: 'esperando',
        modo: modo,
        numBots: numBots,
        apuesta: apuesta,
        maxJugadores: modo === 'solitario' ? 1 : maxJugadores,
        jugadores: [{
          uid: user.uid,
          nombre: nombre,
          listo: true
        }],
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Si es solitario, iniciar automáticamente
      if (modo === 'solitario') {
        await salaRef.update({ estado: 'jugando' });
      }

      console.log('✅ Sala creada:', salaRef.id);
      return salaRef.id;

    } catch (error) {
      console.error('Error al crear sala:', error);
      alert('❌ Error al crear la sala');
      return null;
    }
  }

  /**
   * Une al usuario actual a una sala existente.
   * @param {string} salaId 
   */
  static async unirseSala(salaId) {
    const user = auth.currentUser;
    if (!user) {
      alert('❌ Debes iniciar sesión primero');
      return;
    }

    const perfil = await AuthManager.obtenerPerfil(user.uid);
    const nombre = perfil?.nombre || 'Jugador';
    const salaRef = db.collection('salas').doc(salaId);

    try {
      await db.runTransaction(async (transaction) => {
        const salaDoc = await transaction.get(salaRef);
        if (!salaDoc.exists) throw new Error('La sala ya no existe');

        const sala = salaDoc.data();
        if (sala.estado !== 'esperando') throw new Error('La partida ya empezó');
        if (sala.jugadores.length >= sala.maxJugadores) throw new Error('Sala llena');

        // Verificar duplicado
        if (sala.jugadores.some(j => j.uid === user.uid)) {
          throw new Error('Ya estás en esta sala');
        }

        // Verificar apuesta
        if (sala.apuesta > 0 && perfil && perfil.monedas < sala.apuesta) {
          throw new Error(`Necesitas ${sala.apuesta} monedas. Tienes ${perfil.monedas}`);
        }

        // Descontar apuesta
        if (sala.apuesta > 0) {
          await AuthManager.actualizarMonedas(user.uid, -sala.apuesta);
        }

        const nuevosJugadores = [...sala.jugadores, {
          uid: user.uid,
          nombre: nombre,
          listo: true
        }];

        // Si se llena, iniciar automáticamente
        const nuevoEstado = (nuevosJugadores.length >= sala.maxJugadores) ? 'jugando' : 'esperando';
        transaction.update(salaRef, { jugadores: nuevosJugadores, estado: nuevoEstado });
      });

      console.log('✅ Unido a sala:', salaId);

    } catch (error) {
      console.error('Error al unirse:', error);
      throw error; // relanzar para que app.js muestre el mensaje
    }
  }

  /**
   * El creador inicia manualmente la partida aunque no esté llena.
   */
  static async iniciarPartida(salaId) {
    const user = auth.currentUser;
    const salaRef = db.collection('salas').doc(salaId);

    try {
      const salaDoc = await salaRef.get();
      const sala = salaDoc.data();
      if (sala.creador !== user.uid) {
        alert('❌ Solo el creador puede iniciar la partida');
        return;
      }
      if (sala.jugadores.length < 2) {
        alert('❌ Se necesitan al menos 2 jugadores');
        return;
      }

      await salaRef.update({ estado: 'jugando' });
      console.log('✅ Partida iniciada manualmente');
    } catch (error) {
      console.error('Error al iniciar:', error);
    }
  }

  /**
   * Escucha las salas en estado 'esperando' para mostrarlas en el lobby.
   */
  static escucharSalas(callback) {
    return db.collection('salas')
      .where('estado', '==', 'esperando')
      .orderBy('creado', 'desc')
      .limit(20)
      .onSnapshot(snapshot => {
        const salas = [];
        snapshot.forEach(doc => salas.push({ id: doc.id, ...doc.data() }));
        callback(salas);
      }, error => {
        console.error('Error escuchando salas:', error);
        callback([]);
      });
  }

  /**
   * Escucha cambios en una sala concreta (usado para detectar inicio).
   */
  static escucharSala(salaId, callback) {
    return db.collection('salas').doc(salaId)
      .onSnapshot(doc => {
        if (doc.exists) callback({ id: doc.id, ...doc.data() });
        else callback(null);
      });
  }

  /**
   * Salir de una sala.
   */
  static async salirSala(salaId) {
    const user = auth.currentUser;
    if (!user) return;

    const salaRef = db.collection('salas').doc(salaId);
    try {
      await db.runTransaction(async (transaction) => {
        const salaDoc = await transaction.get(salaRef);
        if (!salaDoc.exists) return;

        const sala = salaDoc.data();
        const nuevosJugadores = sala.jugadores.filter(j => j.uid !== user.uid);

        if (nuevosJugadores.length === 0) {
          transaction.delete(salaRef);
        } else {
          const nuevoCreador = sala.creador === user.uid ? nuevosJugadores[0].uid : sala.creador;
          const nuevoCreadorNombre = sala.creador === user.uid ? nuevosJugadores[0].nombre : sala.creadorNombre;
          transaction.update(salaRef, {
            jugadores: nuevosJugadores,
            creador: nuevoCreador,
            creadorNombre: nuevoCreadorNombre
          });
        }
      });
    } catch (error) {
      console.error('Error al salir:', error);
    }
  }
}
