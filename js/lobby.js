static async crearSala(modo, numBots = 1, apuesta = 0) {
    const user = auth.currentUser;
    if (!user) {
      alert('❌ Debes iniciar sesión primero');
      return null;
    }
    
    const perfil = await AuthManager.obtenerPerfil(user.uid);
    const nombre = perfil?.nombre || 'Jugador';
    
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
        maxJugadores: modo === 'solitario' ? 1 : 4,
        jugadores: [{
          uid: user.uid,
          nombre: nombre,
          listo: true
        }],
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // 🔥 CORRECCIÓN: Si es solitario, iniciar la partida automáticamente
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
