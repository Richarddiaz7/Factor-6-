// Configuración de Firebase para Factor 6
const firebaseConfig = {
  apiKey: "AIzaSyBXL1cjaBSvaeauWfXPyQVLVFrdUJwf8jE",
  authDomain: "factor-6-70652.firebaseapp.com",
  projectId: "factor-6-70652",
  storageBucket: "factor-6-70652.firebasestorage.app",
  messagingSenderId: "569702874734",
  appId: "1:569702874734:web:ae2179c00f5a0062f4f07f"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias globales
const auth = firebase.auth();
const db = firebase.firestore();

console.log('🔥 Firebase inicializado correctamente');
