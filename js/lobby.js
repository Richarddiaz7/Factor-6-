// js/lobby.js
// Lógica de creación, unión y gestión de salas

class LobbyManager {

  static async crearSala(modo, numBots = 1, apuesta = 0, maxJugadores = 4) {
    const user = auth.currentUser;
    if (!user) {
      alert('Debes iniciar sesión primero');
      return null;
    }

    console.log('Creando sala:', modo, numBots, apuesta, maxJugadores);

    let perfil = null;
    try {
      perfil = await AuthManager.obtenerPerfil(user.uid);
    } catch (e) {
      console.error('Error obteniendo perfil:', e);
    }
    
    const nombre = perfil?.nombre || 'Jugador';

    if (apuesta > 0 && perfil && perfil.monedas < apuesta) {
      alert('No tienes suficientes monedas');
      return null;
    }

    try {
      const docData = {
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
      };

      const salaRef = await db.collection('salas').add(docData);
      console.log('Sala creada con ID:', salaRef.id);

      if (modo === 'solitario') {
        await salaRef.update({ estado: 'jugando' });
      }

      return salaRef.id;

    } catch (error) {
      console.error('Error al crear sala:', error);
      alert('Error al crear la sala');
      return null;
    }
  }

  static async unirseSala(salaId) {
    const user = auth.currentUser;
    if (!user) {
      alert('Debes iniciar sesión');
      return;
    }

    let perfil = null;
    try {
      perfil = await AuthManager.obtenerPerfil(user.uid);
    } catch (e) {
      console.error('Error obteniendo perfil:', e);
    }
    const nombre = perfil?.nombre || 'Jugador';
    const salaRef = db.collection('salas').doc(salaId);

    try {
      await db.runTransaction(async (transaction) => {
        const salaDoc = await transaction.get(salaRef);
        if (!salaDoc.exists) throw new Error('La sala ya no existe');

        const sala = salaDoc.data();
        if (sala.estado !== 'esperando') throw new Error('La partida ya empezó');
        if (sala.jugadores.length >= sala.maxJugadores) throw new Error('Sala llena');
        if (sala.jugadores.some(j => j.uid === user.uid)) throw new Error('Ya estás en esta sala');
        if (sala.apuesta > 0 && perfil && perfil.monedas < sala.apuesta) {
          throw new Error('Monedas insuficientes');
        }

        if (sala.apuesta > 0) {
          await AuthManager.actualizarMonedas(user.uid, -sala.apuesta);
        }

        const nuevosJugadores = [...sala.jugadores, {
          uid: user.uid,
          nombre: nombre,
          listo: true
        }];

        const nuevoEstado = (nuevosJugadores.length >= sala.maxJugadores) ? 'jugando' : 'esperando';
        transaction.update(salaRef, { jugadores: nuevosJugadores, estado: nuevoEstado });
      });

      console.log('Unido a sala:', salaId);

    } catch (error) {
      console.error('Error al unirse:', error);
      throw error;
    }
  }

  static async iniciarPartida(salaId) {
    const user = auth.currentUser;
    const salaRef = db.collection('salas').doc(salaId);

    try {
      const salaDoc = await salaRef.get();
      if (!salaDoc.exists) {
        alert('La sala ya no existe');
        return;
      }
      const sala = salaDoc.data();
      if (sala.creador !== user.uid) {
        alert('Solo el creador puede iniciar');
        return;
      }
      if (sala.jugadores.length < 2) {
        alert('Se necesitan al menos 2 jugadores');
        return;
      }

      await salaRef.update({ estado: 'jugando' });
      console.log('Partida iniciada manualmente');
    } catch (error) {
      console.error('Error al iniciar:', error);
      alert('Error al iniciar');
    }
  }

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

  static escucharSala(salaId, callback) {
    return db.collection('salas').doc(salaId)
      .onSnapshot(doc => {
        if (doc.exists) callback({ id: doc.id, ...doc.data() });
        else callback(null);
      }, error => {
        console.error('Error escuchando sala:', error);
      });
  }

  static async eliminarSala(salaId) {
    try {
      await db.collection('salas').doc(salaId).delete();
      console.log('🗑️ Sala eliminada:', salaId);
    } catch (error) {
      console.error('Error al eliminar sala:', error);
    }
  }
}
