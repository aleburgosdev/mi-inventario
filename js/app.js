/* =========================================================
   APP CONECTADA A FIREBASE Y WOOCOMMERCE (REALTIME DATABASE + ECOMMERCE)
   Sincronización automática entre dispositivos + tienda online
   ESTRUCTURA COMPATIBLE CON WOOCOMMERCE: productos como objetos con SKU como clave
   
   CONFIGURACIÓN DINÁMICA DE FIREBASE + WOOCOMMERCE
   Cualquier usuario puede conectar su propia base de datos Firebase y tienda WooCommerce
========================================================= */
// En app.js, al inicio del archivo

// =========================================================
// FUNCIONES AUXILIARES PARA TIMESTAMPS
// =========================================================

/**
 * Formatea un timestamp para mostrar la última sincronización
 * @param {Date} date - Fecha a formatear
 * @returns {string} - String formateado con hora y fecha
 */
function formatTimestamp(date) {
  if (!date) return '';
  
  const now = new Date();
  const diff = now - date;
  
  // Si es muy reciente (menos de 1 minuto), mostrar "ahora"
  if (diff < 60000) {
    return 'ahora';
  }
  
  // Si es menos de 1 hora, mostrar minutos
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `hace ${minutes} min`;
  }
  
  // Si es menos de 24 horas, mostrar horas
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `hace ${hours}h`;
  }
  
  // Si es más de 24 horas, mostrar fecha y hora
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/**
 * Actualiza un elemento de estado con timestamp de sincronización
 * @param {Element} element - Elemento DOM a actualizar
 * @param {string} serviceName - Nombre del servicio (Firebase/WooCommerce)
 * @param {string} status - Estado actual (conectado/error/desconectado)
 * @param {Date} syncTime - Tiempo de última sincronización
 * @param {string} statusColor - Color CSS para el estado
 */
function updateStatusWithTimestamp(element, serviceName, status, syncTime, statusColor = '#4caf50') {
  if (!element) return;
  
  const timestamp = syncTime ? ` - Última sync: ${formatTimestamp(syncTime)}` : '';
  element.innerText = `${serviceName}: ${status}${timestamp}`;
  element.style.color = statusColor;
  
  // ✅ NUEVO: Actualizar indicadores móviles sin causar recursión
  // Solo actualizamos si el elemento es el indicador principal (no el móvil)
  if (element.id === 'firebase-connection-status' || element.id === 'status-indicator') {
    const mobileStatus = document.getElementById('mobile-status-indicator');
    if (mobileStatus) {
      mobileStatus.textContent = element.textContent;
      mobileStatus.style.color = statusColor;
    }
  }
  if (element.id === 'woo-connection-status') {
    const mobileWooStatus = document.getElementById('mobile-woo-status');
    if (mobileWooStatus) {
      mobileWooStatus.style.display = 'inline-block';
      mobileWooStatus.textContent = `🛍️ ${status}`;
      mobileWooStatus.style.color = statusColor;
    }
  }
}

let isLoggedIn = false; 
// ... (resto de variables globales) ...

/* =========================================================
   UTILIDADES PARA CHATBOT
========================================================= */

// Función segura para mostrar el chatbot cuando el usuario esté logueado
function safeShowChatbot() {
  try {
    if (typeof showChatbot === 'function') {
      showChatbot();
    } else {
      // Fallback manual si la función no está disponible
      const trigger = document.getElementById('chatbot-trigger');
      if (trigger && isLoggedIn) {
        trigger.style.display = 'flex';
      }
    }
    
    // ✅ CORRECCIÓN: Verificar alertas críticas después de mostrar chatbot
    setTimeout(() => {
      if (typeof checkCriticalAlerts === 'function') {
        checkCriticalAlerts();
      }
    }, 500);
    
  } catch (error) {
    console.error('Error mostrando chatbot:', error);
  }
}

// Función para verificar y sincronizar el estado de login
function syncLoginState() {
  const isSessionActive = (sessionStorage.getItem("logged") === "1");
  isLoggedIn = isSessionActive;
  
  console.log('🔐 Estado de login sincronizado:', {
    sessionActive: isSessionActive,
    isLoggedIn: isLoggedIn
  });
  
  if (isLoggedIn) {
    // ✅ CORRECCIÓN: Resetear alertas críticas para sesión activa
    if (typeof initialAlertShown !== 'undefined') {
      initialAlertShown = false;
    }
    safeShowChatbot();
  }
}
/* =========================================================
   CONFIGURACIÓN DINÁMICA FIREBASE - SISTEMA COMPLETO
========================================================= */

// Variables globales para Firebase
let currentFirebaseConfig = null;
let firebaseApp = null;
let db = null;
let firebaseAuth = null; // ✅ NUEVO: Servicio de autenticación
let firebaseStatus = null;
let currentUser = null; // ✅ NUEVO: Usuario actual autenticado

// Configuración de ejemplo para UI
const FIREBASE_CONFIG_EXAMPLE = {
  apiKey: "AIzaSy...",
  authDomain: "mi-proyecto.firebaseapp.com",
  databaseURL: "https://mi-proyecto-default-rtdb.firebaseio.com",
  projectId: "mi-proyecto",
  storageBucket: "mi-proyecto.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789"
};

// Validar configuración Firebase
function validateFirebaseConfig(config) {
  const errors = [];
  
  // Validar estructura básica
  if (!config || typeof config !== 'object') {
    errors.push('La configuración debe ser un objeto JSON válido');
    return { isValid: false, errors: errors };
  }
  
  // Campos requeridos
  const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];
  for (const field of requiredFields) {
    if (!config[field] || config[field].trim() === '') {
      errors.push(`Campo requerido faltante: ${field}`);
    }
  }
  
  // Validar formato de apiKey
  if (config.apiKey && !config.apiKey.startsWith('AIzaSy')) {
    errors.push('apiKey debe comenzar con "AIzaSy"');
  }
  
  // Validar authDomain
  if (config.authDomain && !config.authDomain.includes('firebaseapp.com')) {
    console.warn('authDomain no incluye firebaseapp.com, verificá que sea correcto');
  }
  
  // Validar databaseURL
  if (config.databaseURL && !config.databaseURL.includes('firebaseio.com') && !config.databaseURL.includes('firebasedatabase.app')) {
    errors.push('databaseURL debe ser una URL de Firebase Realtime Database');
  }
  
  // Validar projectId
  if (config.projectId && !/^[a-z0-9-]+$/.test(config.projectId)) {
    errors.push('projectId solo puede contener letras minúsculas, números y guiones');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    message: errors.length === 0 ? 'Configuración Firebase válida' : errors.join(', ')
  };
}

// Cargar configuración Firebase desde localStorage
function loadFirebaseConfig() {
  try {
    const savedConfig = localStorage.getItem('firebase-config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      const validation = validateFirebaseConfig(config);
      
      if (validation.isValid) {
        currentFirebaseConfig = config;
        console.log('Configuración Firebase cargada exitosamente');
        return { success: true, config: config, source: 'localStorage' };
      } else {
        console.warn('Configuración Firebase inválida en localStorage:', validation.errors);
        return { success: false, error: validation.errors.join(', '), source: 'localStorage' };
      }
    }
  } catch (error) {
    console.error('Error cargando configuración Firebase:', error);
    return { success: false, error: 'Error al cargar configuración', source: 'localStorage' };
  }
  
  return { success: false, error: 'No hay configuración guardada', source: 'none' };
}

// Inicializar configuración Firebase
function initializeFirebaseConfig() {
  const result = loadFirebaseConfig();
  
  if (result.success) {
    // Inicializar Firebase con la configuración cargada
    initializeFirebaseWithConfig(result.config);
    // Actualizar campos de configuración en la UI
    updateFirebaseConfigDisplay(result.config);
  } else {
    // Cargar configuración de ejemplo en la UI
    updateFirebaseConfigDisplay(FIREBASE_CONFIG_EXAMPLE);
    console.log('Configuración Firebase:', result.error);
  }
}

// Inicializar Firebase con configuración dinámica
function initializeFirebaseWithConfig(config) {
  try {
    // Si ya hay una app inicializada, usar la existente
    if (firebaseApp) {
      firebaseApp = firebase.app();
    } else {
      firebaseApp = firebase.initializeApp(config);
    }
    
    db = firebase.database();
    firebaseAuth = firebase.auth(); // ✅ NUEVO: Inicializar servicio de autenticación
    currentFirebaseConfig = config;
    
    // ✅ NUEVO: Inicializar listener de estado de autenticación
    initAuthStateListener();
    
    // Inicializar listener de tiempo real después de configurar Firebase
    setTimeout(() => {
      initRealTimeListener();
    }, 500);
    
    console.log('Firebase inicializado correctamente con configuración dinámica');
    return true;
  } catch (error) {
    console.error('Error inicializando Firebase:', error);
    return false;
  }
}

// Actualizar campos de configuración en la UI
function updateFirebaseConfigDisplay(config) {
  const textarea = document.getElementById('firebase-config');
  const statusEl = document.getElementById('firebase-connection-status');
  
  if (textarea) {
    textarea.value = JSON.stringify(config, null, 2);
  }
  
  if (statusEl) {
    if (currentFirebaseConfig && db) {
      // ✅ NUEVO: Incluir timestamp en el estado de conexión
      updateStatusWithTimestamp(statusEl, 'Estado', 'Conectado ✓', new Date(), '#4caf50');
    } else {
      // ✅ NUEVO: Mostrar "No configurado" sin timestamp
      statusEl.innerText = 'Estado: No configurado';
      statusEl.style.color = '#ff9800';
    }
  }
}

// Función para guardar configuración Firebase
function saveFirebaseConfig() {
  const textarea = document.getElementById('firebase-config');
  if (!textarea) {
    alert('Error: Campo de configuración Firebase no encontrado');
    return;
  }
  
  try {
    const configText = textarea.value.trim();
    if (!configText) {
      alert('Por favor ingresa la configuración Firebase en formato JSON');
      return;
    }
    
    const config = JSON.parse(configText);
    const validation = validateFirebaseConfig(config);
    
    if (!validation.isValid) {
      alert('Error de validación:\n' + validation.errors.join('\n'));
      return;
    }
    
    // Guardar en localStorage
    localStorage.setItem('firebase-config', JSON.stringify(config));
    
    // Inicializar Firebase con la nueva configuración
    const success = initializeFirebaseWithConfig(config);
    
    if (success) {
      updateFirebaseConfigDisplay(config);
      alert('✓ Configuración de Firebase guardada e inicializada exitosamente\n\nLa aplicación se reconectará automáticamente.');
    } else {
      alert('✗ Error al inicializar Firebase con la nueva configuración');
    }
    
  } catch (error) {
    console.error('Error procesando configuración Firebase:', error);
    alert('Error: La configuración debe ser un JSON válido\n\n' + error.message);
  }
}

// Función para probar conexión Firebase
async function validateFirebaseConnection() {
  if (!currentFirebaseConfig || !db) {
    alert('Primero debes configurar Firebase');
    return false;
  }
  
  const statusEl = document.getElementById('firebase-connection-status');
  if (statusEl) {
    statusEl.innerText = 'Estado: Validando conexión...';
    statusEl.style.color = '#ff9800';
  }
  
  try {
    // Probar conexión leyendo la raíz
    await db.ref('/').once('value');
    
    if (statusEl) {
      // ✅ NUEVO: Incluir timestamp cuando la conexión es exitosa
      updateStatusWithTimestamp(statusEl, 'Estado', 'Conectado ✓', new Date(), '#4caf50');
    }
    
    alert('✓ Conexión con Firebase establecida exitosamente');
    return true;
  } catch (error) {
    console.error('Error de conexión Firebase:', error);
    
    if (statusEl) {
      statusEl.innerText = 'Estado: Error de conexión ✗';
      statusEl.style.color = '#f44336';
    }
    
    alert('✗ Error de conexión con Firebase:\n' + error.message + '\n\nVerifica:\n• Que la configuración sea correcta\n• Que las reglas de Firebase permitan acceso\n• Que el proyecto esté activo en Firebase Console');
    return false;
  }
}

// Función para mostrar configuración actual Firebase
function loadCurrentFirebaseConfig() {
  const result = loadFirebaseConfig();
  
  if (result.success) {
    updateFirebaseConfigDisplay(result.config);
    alert('✓ Configuración actual de Firebase cargada desde memoria local');
  } else {
    alert('⚠️ No hay configuración Firebase guardada\n\nPor favor, ingresa tu configuración de Firebase.');
    updateFirebaseConfigDisplay(FIREBASE_CONFIG_EXAMPLE);
  }
}

// Función para limpiar configuración Firebase
function clearFirebaseConfig() {
  if (!confirm('¿Estás seguro que quieres eliminar la configuración de Firebase?\n\nEsto desconectará la aplicación de la nube.')) {
    return;
  }
  
  try {
    localStorage.removeItem('firebase-config');
    
    // Reinicializar con configuración por defecto (fallback)
    currentFirebaseConfig = {
      apiKey: "AIzaSyA_dhm1MH2aMtsTBfBA-7daZk5Eelnl4As",
      authDomain: "inventariolaplatacompu.firebaseapp.com",
      databaseURL: "https://inventariolaplatacompu-default-rtdb.firebaseio.com",
      projectId: "inventariolaplatacompu",
      storageBucket: "inventariolaplatacompu.firebasestorage.app",
      messagingSenderId: "120219172688",
      appId: "1:120219172688:web:28b6ece6fc26f04c357655",
    };
    
    initializeFirebaseWithConfig(currentFirebaseConfig);
    updateFirebaseConfigDisplay(FIREBASE_CONFIG_EXAMPLE);
    
    alert('✓ Configuración de Firebase restaurada a valores por defecto');
  } catch (error) {
    console.error('Error restaurando configuración Firebase:', error);
    alert('Error al restaurar configuración: ' + error.message);
  }
}

// =========================================================
// 🔐 AUTENTICACIÓN DE FIREBASE (EMAIL/PASSWORD)
// =========================================================

/**
 * Inicializa el listener de estado de autenticación
 * Detecta cambios en el estado del usuario automáticamente
 */
function initAuthStateListener() {
  if (!firebaseAuth) {
    console.warn('⚠️ Firebase Auth no está inicializado');
    return;
  }
  
  // Escuchar cambios en el estado de autenticación
  firebaseAuth.onAuthStateChanged(function(user) {
    if (user) {
      // Usuario autenticado
      currentUser = user;
      console.log('✅ Usuario autenticado:', user.email);
      updateAuthUI(user);
    } else {
      // Usuario no autenticado
      currentUser = null;
      console.log('🔓 Usuario desconectado');
      updateAuthUI(null);
    }
  });
  
  console.log('🔔 Listener de autenticación inicializado');
}

/**
 * Actualiza la interfaz de usuario según el estado de autenticación
 * @param {Object|null} user - Usuario de Firebase o null
 */
function updateAuthUI(user) {
  const userDisplay = document.getElementById('auth-user-display');
  const userEmail = document.getElementById('auth-user-email');
  const userEmailDetail = document.getElementById('auth-user-email-detail');
  const userUid = document.getElementById('auth-user-uid');
  const lastCheck = document.getElementById('auth-last-check');
  const logoutBtn = document.getElementById('auth-logout-btn');
  const logoutBtnHeader = document.getElementById('auth-logout-btn-header');
  const authDetails = document.getElementById('auth-details');
  const authIcon = document.getElementById('auth-icon');
  const authShowDetailsBtn = document.getElementById('auth-show-details-btn');
  
  // Actualizar indicador principal en configuración
  if (userDisplay) {
    if (user) {
      userDisplay.innerHTML = `<span style="color: #28a745;font-weight:bold;">✓ ${user.email}</span>`;
      userDisplay.parentElement.parentElement.style.background = '#d4edda';
    } else {
      userDisplay.innerHTML = 'No autenticado';
      userDisplay.parentElement.parentElement.style.background = '#f8f9fa';
    }
  }
  
  // Actualizar icono
  if (authIcon) {
    authIcon.textContent = user ? '🔐' : '🔓';
  }
  
  // Actualizar detalles en el modal
  if (userEmail) {
    userEmail.textContent = user ? user.email : 'Ninguno';
  }
  
  // Actualizar detalles extendidos
  if (userEmailDetail) {
    userEmailDetail.textContent = user ? user.email : '-';
  }
  if (userUid) {
    userUid.textContent = user ? user.uid : '-';
  }
  if (lastCheck) {
    lastCheck.textContent = user ? new Date().toLocaleString() : '-';
  }
  
  // Mostrar/ocultar botón de cerrar sesión en header
  if (logoutBtnHeader) {
    logoutBtnHeader.style.display = user ? 'inline-block' : 'none';
  }
  
  if (logoutBtn) {
    logoutBtn.style.display = user ? 'inline-block' : 'none';
  }
  
  // Mostrar detalles extendidos si hay usuario
  if (authDetails) {
    authDetails.style.display = user ? 'block' : 'none';
  }
  if (authShowDetailsBtn) {
    authShowDetailsBtn.style.display = user ? 'inline-block' : 'none';
    authShowDetailsBtn.textContent = authDetails && authDetails.style.display === 'block' ? '🙈 Ocultar detalles' : '📋 Ver detalles';
  }
  
  // Actualizar también el indicador del sidebar si existe
  const sidebarStatus = document.getElementById('firebase-connection-status');
  if (sidebarStatus) {
    if (user) {
      updateStatusWithTimestamp(sidebarStatus, '🔥 Firebase', `Conectado ✓ (${user.email})`, new Date(), '#4caf50');
    } else {
      updateStatusWithTimestamp(sidebarStatus, '🔥 Firebase', 'Conectado ✓', new Date(), '#4caf50');
    }
  }
}

/**
 * Muestra u oculta los detalles de autenticación
 */
function toggleAuthDetails() {
  const authDetails = document.getElementById('auth-details');
  const authShowDetailsBtn = document.getElementById('auth-show-details-btn');
  
  if (authDetails && authShowDetailsBtn) {
    if (authDetails.style.display === 'none') {
      authDetails.style.display = 'block';
      authShowDetailsBtn.textContent = '🙈 Ocultar detalles';
    } else {
      authDetails.style.display = 'none';
      authShowDetailsBtn.textContent = '📋 Ver detalles';
    }
  }
}

/**
 * Abre el modal de autenticación
 */
function abrirModalAuth() {
  const modal = document.getElementById('auth-modal');
  if (!modal) {
    alert('Error: Modal de autenticación no encontrado');
    return;
  }
  
  // Verificar que Firebase Auth esté inicializado
  if (!firebaseAuth) {
    alert('Error: Firebase Auth no está inicializado.\n\nPrimero configura Firebase en la sección de configuración.');
    return;
  }
  
  // Limpiar campos
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-modal-error').style.display = 'none';
  
  // Mostrar email actual si hay sesión activa
  const userEmailEl = document.getElementById('auth-user-email');
  const logoutBtn = document.getElementById('auth-logout-btn');
  const userEmailDetail = document.getElementById('auth-user-email-detail');
  const userUid = document.getElementById('auth-user-uid');
  const lastCheck = document.getElementById('auth-last-check');
  
  if (currentUser) {
    if (userEmailEl) userEmailEl.textContent = currentUser.email;
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (userEmailDetail) userEmailDetail.textContent = currentUser.email;
    if (userUid) userUid.textContent = currentUser.uid;
    if (lastCheck) lastCheck.textContent = new Date().toLocaleString();
  } else {
    if (userEmailEl) userEmailEl.textContent = 'Ninguno';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userEmailDetail) userEmailDetail.textContent = '-';
    if (userUid) userUid.textContent = '-';
    if (lastCheck) lastCheck.textContent = '-';
  }
  
  // Mostrar modal
  modal.style.display = 'flex';
  
  // Enfocar el campo de email
  setTimeout(() => {
    document.getElementById('auth-email').focus();
  }, 100);
  
  console.log('🔐 Modal de autenticación abierto');
}

/**
 * Cierra el modal de autenticación
 */
function cerrarModalAuth() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'none';
    console.log('🔒 Modal de autenticación cerrado');
  }
}

/**
 * Autentica usuario con email y contraseña
 */
function autenticarFirebase() {
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const errorDiv = document.getElementById('auth-modal-error');
  const loginBtn = document.getElementById('auth-login-btn');
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Validar campos
  if (!email) {
    mostrarErrorAuth('Por favor ingresa tu email');
    emailInput.focus();
    return;
  }
  
  if (!password) {
    mostrarErrorAuth('Por favor ingresa tu contraseña');
    passwordInput.focus();
    return;
  }
  
  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    mostrarErrorAuth('Por favor ingresa un email válido');
    return;
  }
  
  // Verificar que Firebase Auth esté inicializado
  if (!firebaseAuth) {
    mostrarErrorAuth('Error: Firebase Auth no está inicializado');
    return;
  }
  
  // Deshabilitar botón durante el proceso
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner"></span>Autenticando...';
  
  // Realizar autenticación
  firebaseAuth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Autenticación exitosa
      const user = userCredential.user;
      console.log('✅ Autenticación exitosa para:', user.email);
      
      // Cerrar modal
      cerrarModalAuth();
      
      // Mostrar notificación
      alert(`✓ Bienvenido, ${user.email}!\n\nSesión iniciada correctamente.`);
      
      // Actualizar UI
      updateAuthUI(user);
    })
    .catch((error) => {
      // Error de autenticación
      console.error('❌ Error de autenticación:', error);
      
      let errorMessage = 'Error al iniciar sesión';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No existe una cuenta con este email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Contraseña incorrecta';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos fallidos. Espera unos minutos.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión. Verifica tu internet.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Esta cuenta ha sido deshabilitada';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Autenticación por email/password no habilitada en Firebase Console';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      
      mostrarErrorAuth(errorMessage);
    })
    .finally(() => {
      // Rehabilitar botón
      loginBtn.disabled = false;
      loginBtn.innerHTML = '🔓 Iniciar Sesión';
    });
}

/**
 * Muestra un error en el modal de autenticación
 * @param {string} message - Mensaje de error
 */
function mostrarErrorAuth(message) {
  const errorDiv = document.getElementById('auth-modal-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

/**
 * Cierra la sesión del usuario actual
 */
function logoutFirebase() {
  if (!firebaseAuth) {
    alert('Error: Firebase Auth no está inicializado');
    return;
  }
  
  if (!confirm('¿Estás seguro que quieres cerrar sesión?')) {
    return;
  }
  
  firebaseAuth.signOut()
    .then(() => {
      // Sesión cerrada exitosamente
      console.log('🔒 Sesión cerrada correctamente');
      
      // Actualizar UI
      updateAuthUI(null);
      
      // Mostrar notificación
      alert('✓ Sesión cerrada correctamente');
    })
    .catch((error) => {
      console.error('❌ Error al cerrar sesión:', error);
      alert('Error al cerrar sesión: ' + error.message);
    });
}

// ========================================================
// 🖨️ GENERADOR E IMPRESOR DE CÓDIGOS QR
// ========================================================

/**
 * Variables globales para el módulo QR
 */
let currentQRProduct = null;

/**
 * Genera y muestra el modal de etiqueta QR para un producto
 * @param {string} sku - SKU del producto
 */
function generateQRLabel(sku) {
  console.log(`🏷️ Generando etiqueta QR para: ${sku}`);
  
  // Obtener datos del producto
  const product = state.productos[sku];
  if (!product) {
    alert('Error: Producto no encontrado');
    return;
  }
  
  // Guardar producto actual para impresión
  currentQRProduct = product;
  
  // Limpiar contenido anterior
  const labelContent = document.getElementById('qr-label-content');
  const productInfo = document.getElementById('qr-product-info');
  const previewContainer = document.getElementById('qr-label-preview');
  
  if (!labelContent || !productInfo || !previewContainer) {
    console.error('❌ Elementos del modal QR no encontrados');
    return;
  }
  
  labelContent.innerHTML = '';
  productInfo.innerHTML = '';
  
  // Crear contenedor de la tarjeta de etiqueta
  const card = document.createElement('div');
  card.className = 'qr-label-card';
  
  // ✅ CORRECCIÓN: Generar contenido compacto para el QR (evita overflow)
  // Limitar nombre a 50 caracteres para evitar QR demasiado grande
  const shortName = (product.name || '').substring(0, 50);
  const qrData = JSON.stringify({
    s: product.sku,      // sku (shortened key)
    n: shortName,        // name (truncated)
    p: product.price,    // price
    st: product.stock    // stock
  });
  
  // Crear elemento para el código QR
  const qrContainer = document.createElement('div');
  qrContainer.className = 'qr-code';
  qrContainer.id = `qr-code-${product.sku}`;
  
  card.appendChild(qrContainer);
  
  // Agregar información del producto
  const infoDiv = document.createElement('div');
  infoDiv.className = 'product-info';
  infoDiv.innerHTML = `
    <strong>${product.name}</strong>
    <div class="sku">SKU: ${product.sku}</div>
    <div class="price">ARS ${parseFloat(product.price || 0).toFixed(2)}</div>
  `;
  card.appendChild(infoDiv);
  
  labelContent.appendChild(card);
  
  // Mostrar información adicional
  productInfo.innerHTML = `
    <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 13px;">
      <strong>📦 Stock:</strong> ${product.stock || 0} unidades<br>
      <strong>🏷️ Categoría:</strong> ${product.category || 'Sin categoría'}<br>
      <strong>🏢 Proveedor:</strong> ${product.supplier || 'Sin proveedor'}
    </div>
  `;
  
  // Marcar que hay contenido
  previewContainer.classList.add('has-content');
  
  // Generar el código QR usando qrcodejs
  setTimeout(() => {
    const qrElement = document.getElementById(`qr-code-${product.sku}`);
    if (qrElement) {
      qrElement.innerHTML = ''; // Limpiar cualquier QR anterior
      
      new QRCode(qrElement, {
        text: qrData,
        width: 128,
        height: 128,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      
      console.log(`✅ Código QR generado para ${sku}`);
    }
  }, 100);
  
  // Mostrar el modal
  const modal = document.getElementById('qr-label-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

/**
 * Cierra el modal de QR
 */
function cerrarQRModal() {
  const modal = document.getElementById('qr-label-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentQRProduct = null;
}

/**
 * Imprime la etiqueta QR actual
 * ✅ CORRECCIÓN: Usar ventana emergente para impresión
 */
function printQRLabel() {
  if (!currentQRProduct) {
    alert('Error: No hay producto seleccionado para imprimir');
    return;
  }
  
  const product = currentQRProduct;
  const shortName = (product.name || '').substring(0, 50);
  const qrData = JSON.stringify({
    s: product.sku,
    n: shortName,
    p: product.price,
    st: product.stock
  });
  
  // Crear ventana de impresión emergente
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  
  if (!printWindow) {
    alert('Error: No se pudo abrir ventana de impresión. Verifica que允许 ventanas emergentes.');
    return;
  }
  
  // Generar contenido HTML para la impresión
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Etiqueta QR - ${product.sku}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
        }
        .label-container {
          text-align: center;
          border: 2px solid #333;
          border-radius: 8px;
          padding: 15px;
          width: 200px;
        }
        .product-name {
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 8px;
        }
        .qr-container {
          margin: 10px 0;
          display: flex;
          justify-content: center;
        }
        .sku {
          font-size: 10px;
          color: #666;
          margin-top: 5px;
        }
        .price {
          font-size: 16px;
          font-weight: bold;
          color: #28a745;
          margin-top: 5px;
        }
        @media print {
          body { padding: 0; }
          .label-container { border: 1px solid #333; }
        }
      </style>
    </head>
    <body>
      <div class="label-container">
        <div class="product-name">${product.name}</div>
        <div class="qr-container" id="qr-code"></div>
        <div class="sku">SKU: ${product.sku}</div>
        <div class="price">ARS ${parseFloat(product.price || 0).toFixed(2)}</div>
      </div>
      <script>
        // Generar QR después de que la ventana cargue
        window.onload = function() {
          new QRCode(document.getElementById("qr-code"), {
            text: '${qrData}',
            width: 100,
            height: 100,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
          });
          
          // Imprimir después de generar el QR
          setTimeout(function() {
            window.print();
          }, 500);
        };
      <\/script>
    </body>
    </html>
  `);
  
  printWindow.document.close();
  console.log(`🖨️ Etiqueta QR abierta para impresión: ${product.sku}`);
}

// Estado inicial vacío - USANDO ESTRUCTURA COMPATIBLE CON WOOCOMMERCE (OBJETO CON SKU COMO CLAVE)
let state = { productos: {}, sales: [], suppliers: [], envios: [], tickets: [], ordenesCompra: [] };
let editingSku = null; // Rastrea qué SKU se está editando actualmente
const PAGE_SIZE = 8;
let currentPage = 1;

// Función de validación global del state
function validarState() {
  try {
    // Asegurar que state existe
    if (!state) {
      console.warn('⚠️ State no inicializado, reinicializando...');
      state = { productos: {}, sales: [], suppliers: [], envios: [], tickets: [], ordenesCompra: [] };
    }
    
    // Validar cada propiedad crítica
    if (!state.productos || typeof state.productos !== 'object' || state.productos === null) {
      console.warn('⚠️ state.productos inválido, reinicializando...');
      state.productos = {};
    }
    
    if (!Array.isArray(state.sales)) {
      console.warn('⚠️ state.sales no es array, reinicializando...');
      state.sales = [];
    }
    
    if (!Array.isArray(state.suppliers)) {
      console.warn('⚠️ state.suppliers no es array, reinicializando...');
      state.suppliers = [];
    }
    
    if (!Array.isArray(state.envios)) {
      console.warn('⚠️ state.envios no es array, reinicializando...');
      state.envios = [];
    }
    
    if (!Array.isArray(state.tickets)) {
      console.warn('⚠️ state.tickets no es array, reinicializando...');
      state.tickets = [];
    }
    
    if (!Array.isArray(state.ordenesCompra)) {
      console.warn('⚠️ state.ordenesCompra no es array, reinicializando...');
      console.log('🔍 Tipo actual de state.ordenesCompra:', typeof state.ordenesCompra);
      console.log('🔍 Valor actual de state.ordenesCompra:', state.ordenesCompra);
      state.ordenesCompra = [];
      console.log('✅ state.ordenesCompra reinicializado como array vacío');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error al validar state:', error);
    // Último recurso: reinicializar completamente
    state = { productos: {}, sales: [], suppliers: [], envios: [], tickets: [], ordenesCompra: [] };
    return false;
  }
}

// Función para limpiar productos con valores NaN
function cleanNaNProducts() {
  let cleanedCount = 0;
  
  // Validar state antes de proceder
  if (!validarState()) {
    console.error('❌ No se puede limpiar productos: state inválido');
    return 0;
  }
  
  // Validar que state.productos existe y es un objeto
  if (!state.productos || typeof state.productos !== 'object') {
    console.warn('⚠️ state.productos no está inicializado correctamente');
    return 0;
  }
  
  Object.keys(state.productos).forEach(sku => {
    const product = state.productos[sku];
    
    // Validar que el producto existe
    if (!product) return;
    
    let wasCleaned = false;
    
    // Limpiar campos numéricos
    ['cost', 'ship', 'commission', 'price', 'stock'].forEach(field => {
      const originalValue = product[field];
      const cleanedValue = parseFloat(originalValue) || 0;
      
      if (isNaN(originalValue) || originalValue === null || originalValue === undefined) {
        product[field] = cleanedValue;
        wasCleaned = true;
      }
    });
    
    if (wasCleaned) {
      cleanedCount++;
      console.log(`🧹 Producto limpiado (${sku}):`, product);
    }
  });
  
  if (cleanedCount > 0) {
    console.log(`✅ Limpiados ${cleanedCount} productos con valores inválidos`);
    saveStateToLocalStorage(); // Guardar cambios inmediatamente
  }
}

// ----------------------------------------------------
// 🔥 CONEXIÓN EN TIEMPO REAL
// ----------------------------------------------------

// Función de emergencia para forzar guardado
function forceSave() {
  console.log('🚨 Forzando guardado de emergencia...');
  saveStateToLocalStorage();
  
  if (db) {
    db.ref('/').set(state).then(() => {
      console.log('✅ Guardado forzado exitoso');
    }).catch((error) => {
      console.error('❌ Error en guardado forzado:', error);
    });
  }
}

// Detectar problemas de sincronización
setInterval(() => {
  const currentSalesCount = state.sales.length;
  const lastSavedState = localStorage.getItem('app_state');
  
  if (lastSavedState) {
    try {
      const savedState = JSON.parse(lastSavedState);
      const savedSalesCount = savedState.sales ? savedState.sales.length : 0;
      
      // Si hay más ventas en memoria que en localStorage, hay un problema
      if (currentSalesCount > savedSalesCount) {
        console.warn('⚠️ Desincronización detectada. Forzando guardado...');
        forceSave();
      }
    } catch (error) {
      console.warn('⚠️ Error verificando sincronización:', error);
    }
  }
}, 10000); // Verificar cada 10 segundos



// NOTA: Asegúrate de tener 'let isLoggedIn = false;' al inicio del archivo app.js
// ...

function initRealTimeListener() {
  // Ocultar al inicio, antes de cualquier carga
  isLoggedIn = false; // Por seguridad, asumimos no logueado al iniciar
  if (typeof hideChatbot === 'function') {
      hideChatbot(); 
  }
  // Verificar que Firebase esté inicializado
  if (!db) {
    console.warn('Firebase no está inicializado, intentando inicializar con configuración por defecto...');
    if (currentFirebaseConfig) {
      initializeFirebaseWithConfig(currentFirebaseConfig);
    }
    return;
  }

  // Escuchar cambios en la ruta raíz '/' de la base de datos
  // Declarar statusEl en el scope exterior para que sea accesible en ambos callbacks
  const statusEl = document.getElementById('status-indicator');
  
  db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val();

    if (data) {
      // ✅ PROTECCIÓN ESPECIAL: Guardar ordenesCompra antes de sobrescribir
      const ordenesCompraAnteriores = Array.isArray(state.ordenesCompra) ? [...state.ordenesCompra] : [];
      
      state = data;
      
      // ✅ PROTECCIÓN ESPECIAL: Restaurar ordenesCompra si Firebase envía datos corruptos
      if (!Array.isArray(state.ordenesCompra)) {
        console.warn('🔒 Firebase envió ordenesCompra corrupto, restaurando datos anteriores');
        console.log('📋 Ordenes anteriores restauradas:', ordenesCompraAnteriores.length);
        state.ordenesCompra = ordenesCompraAnteriores;
      }
      
      // ✅ CORRECCIÓN ERROR FOREACH: Validar state completo después de cargar datos
      validarState();
      
      // Asegurar que existan los arrays si están vacíos - VALIDACIÓN ROBUSTA
      state.productos = state.productos || {};
      state.sales = state.sales || [];
      state.suppliers = state.suppliers || [];
      state.envios = state.envios || [];
      state.tickets = state.tickets || [];
      // ordenesCompra ya está protegido arriba
      state.ordenesCompra = state.ordenesCompra || [];
      
      // Validación adicional para asegurar que productos es un objeto válido
      if (typeof state.productos !== 'object' || state.productos === null) {
        console.warn('⚠️ state.productos inválido, reinicializando como objeto vacío');
        state.productos = {};
      }

      // ✅ CORRECCIÓN: Verificar sesión activa antes de marcar como logueado
      isLoggedIn = (sessionStorage.getItem("logged") === "1"); 

      safeShowChatbot();
      // Sincronizar tickets después de cargar datos
      syncTicketsAfterLoad();

      // ✅ NUEVO: Actualizar status-indicator cuando Firebase está conectado
      if (statusEl) {
        statusEl.innerText = "🔥 Firebase: Conectado";
        statusEl.style.color = "#4caf50";
      }
      
      // ✅ NUEVO: Actualizar firebase-connection-status con timestamp
      const configStatusEl = document.getElementById('firebase-connection-status');
      const syncTime = new Date();
      if (configStatusEl) {
        updateStatusWithTimestamp(configStatusEl, '🔥 Firebase', 'Conectado ✓', syncTime, '#4caf50');
      }

      // Actualizar interfaz (Aquí se llama a checkCriticalAlerts())
      refreshUI();

      // ... (Logs y actualización de statusEl) ...
    } else {
      // Base de datos nueva/vacía (Conexión exitosa, pero sin datos)
      isLoggedIn = (sessionStorage.getItem("logged") === "1");
      state = { productos: {}, sales: [], suppliers: [], envios: [], tickets: [], ordenesCompra: [] };
      
      // ✅ NUEVO: Actualizar status-indicator para base de datos nueva
      if (statusEl) {
        statusEl.innerText = "🔥 Firebase: Conectado (nueva DB)";
        statusEl.style.color = "#4caf50";
      }
      
      // ✅ NUEVO: Actualizar firebase-connection-status con timestamp para nueva DB
      const configStatusEl = document.getElementById('firebase-connection-status');
      const syncTime = new Date();
      if (configStatusEl) {
        updateStatusWithTimestamp(configStatusEl, '🔥 Firebase', 'Conectado (nueva DB) ✓', syncTime, '#4caf50');
      }
      
      refreshUI();
      
      // ... (resto de la lógica) ...
    }
  }, (error) => {
    console.error("❌ Error de conexión Firebase:", error);
    console.log('📱 Cargando datos desde localStorage como respaldo...');
    loadStateFromLocalStorage();
    
    // ✅ CORRECCIÓN: Verificar sesión activa antes de cargar datos locales
    isLoggedIn = (sessionStorage.getItem("logged") === "1");
    
    if (statusEl) {
      statusEl.innerText = "🔴 Firebase: Error de conexión (usando datos locales)";
      statusEl.style.color = "red";
    }
    
    // Actualizar UI con datos locales (Aquí se llama a checkCriticalAlerts())
    refreshUI(); 
    
    // Si la carga de LocalStorage es exitosa, el chatbot debería mostrarse
    safeShowChatbot();
  });

  // El bloque setTimeout debe confiar en el estado del listener, 
  // ya que la lógica del listener es más robusta.
  setTimeout(() => {
    if (Object.keys(state.productos).length === 0 && state.sales.length === 0) {
      console.log('📱 Firebase vacío/lento, chequeando localStorage de respaldo...');
      // loadStateFromLocalStorage() ya llama a refreshUI y setea isLoggedIn en el error handler si es necesario.
      // Si el listener no ha disparado el éxito, esta llamada es redundante pero segura.
      // Aquí confiamos en que el error handler o el success handler hará el trabajo final.
    }
  }, 1000);
  
  // Limpiar productos con valores NaN
  setTimeout(() => {
    console.log('🧹 Iniciando limpieza de productos...');
    cleanNaNProducts();
  }, 2000);
}
// Función para cargar estado desde localStorage
function loadStateFromLocalStorage() {
  try {
    const savedState = localStorage.getItem('app_state');
    const backupTimestamp = localStorage.getItem('backup_timestamp');
    
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      state = parsedState;
      
      // Asegurar que existan los arrays si están vacíos
      state.productos = state.productos || {};
      state.sales = state.sales || [];
      state.suppliers = state.suppliers || [];
      state.envios = state.envios || [];
      state.tickets = state.tickets || [];
      state.ordenesCompra = state.ordenesCompra || [];
      
      console.log('📱 Estado cargado desde localStorage');
      console.log('📊 Datos cargados - Productos:', Object.keys(state.productos).length, 'Ventas:', state.sales.length, 'Tickets:', state.tickets.length);
      
      // ✅ CORRECCIÓN: Verificar sesión activa antes de mostrar chatbot
      isLoggedIn = (sessionStorage.getItem("logged") === "1");
      
      // Actualizar interfaz
      refreshUI();
      
      // Mostrar chatbot si la función está disponible
      safeShowChatbot();
      
      const statusEl = document.getElementById('status-indicator');
      if (statusEl) {
        statusEl.innerText = "📱 Modo Offline - Datos locales";
        statusEl.style.color = "orange";
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Error cargando desde localStorage:', error);
  }
  return false;
}

// Función central para guardar cambios en la Nube
function saveState() {
  const statusEl = document.getElementById('status-indicator');
  if (statusEl) statusEl.innerText = "🔄 Firebase: Guardando...";

  // Verificar que Firebase esté inicializado
  if (!db) {
    console.error('Firebase no está inicializado');
    console.log('📱 Guardando en localStorage como respaldo...');
    saveStateToLocalStorage();
    if (statusEl) {
      statusEl.innerText = "🔴 Firebase no conectado";
      statusEl.style.color = "red";
    }
    return;
  }

  // Guardar en localStorage como respaldo siempre
  saveStateToLocalStorage();

  // Enviar todo el estado a Firebase (sobrescribe la nube)
  db.ref('/').set(state)
    .then(() => {
      console.log("✅ Datos guardados en nube Firebase");
      console.log('📊 Sincronizado - Productos:', Object.keys(state.productos).length, 'Ventas:', state.sales.length, 'Tickets:', state.tickets.length);
      if (statusEl) {
        statusEl.innerText = "🟢 Firebase: Guardado ✓";
        statusEl.style.color = "green";
        
        // ✅ NUEVO: Después de 2 segundos, volver al estado normal de "Conectado"
        setTimeout(() => {
          if (statusEl) {
            statusEl.innerText = "🔥 Firebase: Conectado";
            statusEl.style.color = "#4caf50";
          }
        }, 2000);
      }
    })
    .catch((error) => {
      console.error("❌ Error al guardar en Firebase:", error);
      console.log('📱 Los datos se guardaron localmente como respaldo');
      if (statusEl) {
        statusEl.innerText = "🔴 Firebase: Error al guardar";
        statusEl.style.color = "red";
      }
    });
}

// Función para guardar siempre en localStorage
function saveStateToLocalStorage() {
  try {
    localStorage.setItem('app_state', JSON.stringify(state));
    localStorage.setItem('backup_timestamp', Date.now().toString());
    console.log('📱 Estado guardado localmente exitosamente');
  } catch (error) {
    console.error('❌ Error guardando localmente:', error);
  }
}

// Refrescar todas las vistas (se llama al recibir datos de la nube)
function refreshUI() {
  // Validar estado antes de proceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en refreshUI');
    return;
  }
  
  populateSupplierSelect();
  renderProducts();
  renderSuppliers();
  renderDatalist();
  renderSalesLog();
  renderDashboard();
  populateCategoryFilter();
  renderEnvios();
  renderPedidos();
  renderTickets(); // CARGAR TICKETS DESDE FIREBASE
  renderOrdenesCompra(); // RENDERIZAR ÓRDENES DE COMPRA
  // NOTA: renderKardex() se llama solo cuando el usuario navega a la sección kardex
  // para evitar problemas de rendimiento y loops infinitos
  mostrarNotificacionPendientes();
  checkCriticalAlerts();
  getReorderSuggestions(); 
  
}

// ----------------------------------------------------
// LÓGICA DE NAVEGACIÓN
// ----------------------------------------------------
function navigate(page, element) {
  console.log('🧭 Navegando a:', page);
  
  // Ocultar todas las vistas
  const views = document.querySelectorAll('.page');
  views.forEach(v => v.style.display = 'none');

  // Mostrar vista seleccionada
  const targetView = document.getElementById(page);
  targetView.style.display = 'block';

  // Actualizar menú activo
  document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }

  // Especial: recargar productos al abrir vista productos
  if (page === 'productos') {
    renderProducts();
  }
  
  // Especial: renderizar kardex al abrir vista kardex
  if (page === 'kardex') {
    renderKardex();
  }
  
  console.log('✅ Vista', page, 'activada');
}

// =========================================================
// 🎛️ MENÚ HAMBURGUESA RESPONSIVE
// =========================================================

/**
 * Alterna el menú móvil (abre/cierra)
 */
function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('menu-overlay');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const body = document.body;
  
  if (!sidebar || !overlay) {
    console.warn('⚠️ Elementos del menú móvil no encontrados');
    return;
  }
  
  const isOpen = sidebar.classList.contains('active');
  
  if (isOpen) {
    // Cerrar menú
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    hamburgerBtn.classList.remove('active');
    body.style.overflow = '';
    body.style.position = '';
  } else {
    // Abrir menú
    sidebar.classList.add('active');
    overlay.classList.add('active');
    hamburgerBtn.classList.add('active');
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.style.height = '100%';
  }
  
  console.log(isOpen ? '🔒 Menú móvil cerrado' : '📱 Menú móvil abierto');
}

/**
 * Cierra el menú móvil
 */
function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('menu-overlay');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const body = document.body;
  
  if (sidebar && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    hamburgerBtn.classList.remove('active');
    body.style.overflow = '';
    body.style.position = '';
    body.style.width = '';
    body.style.height = '';
    console.log('🔒 Menú móvil cerrado');
  }
}

/**
 * Navegación desde el menú móvil (cierra el menú después de navegar)
 */
function navigateMobile(page, element) {
  // Navegar primero
  navigate(page, element);
  // Cerrar menú móvil después de navegar
  closeMobileMenu();
}

// =========================================================
// 📱 ACTUALIZAR INDICADORES DE ESTADO MÓVIL
// =========================================================

/**
 * Actualiza el indicador de estado de Firebase en móvil
 */
function updateMobileStatus(text, color) {
  const mobileStatus = document.getElementById('mobile-status-indicator');
  if (mobileStatus) {
    mobileStatus.textContent = text;
    mobileStatus.style.color = color || 'inherit';
  }
}

/**
 * Actualiza el indicador de WooCommerce en móvil
 */
function updateMobileWooStatus(text, color) {
  const mobileWooStatus = document.getElementById('mobile-woo-status');
  if (mobileWooStatus) {
    mobileWooStatus.style.display = text ? 'inline-block' : 'none';
    mobileWooStatus.textContent = text || '🛍️ Woo';
    mobileWooStatus.style.color = color || 'inherit';
  }
}

// Función para sincronizar estado de conexión con indicadores móviles
function syncConnectionStatus() {
  const firebaseStatus = document.getElementById('firebase-connection-status');
  const wooStatus = document.getElementById('woo-connection-status');
  
  if (firebaseStatus) {
    updateMobileStatus(firebaseStatus.textContent, firebaseStatus.style.color);
  }
  if (wooStatus) {
    updateMobileWooStatus(wooStatus.textContent, wooStatus.style.color);
  }
}

// =========================================================
// 📷 ESCÁNER QR/CÓDIGO DE BARRAS
// =========================================================

let html5QrcodeScanner = null;
let isScannerRunning = false;
let useBackCamera = true;
let scannerContext = 'agregar'; // 'agregar' o 'ventas' - rastrea el contexto del escáner

/**
 * Abre el modal del escáner para AGREGAR PRODUCTO (contexto por defecto)
 */
function abrirScanner() {
  scannerContext = 'agregar'; // Establecer contexto para agregar producto
  abrirScannerConModo('agregar');
}

/**
 * Abre el modal del escáner para REGISTRAR VENTA
 * @param {string} modo - 'agregar' o 'ventas'
 */
function abrirScannerConModo(modo) {
  const modal = document.getElementById('scanner-modal');
  const statusEl = document.getElementById('scanner-status');
  const reader = document.getElementById('reader');
  
  if (!modal) {
    alert('Error: Modal del escáner no encontrado');
    return;
  }
  
  // Verificar si la librería está disponible
  if (typeof Html5Qrcode === 'undefined') {
    alert('Error: Librería de escáner no cargada.\nPor favor, recarga la página.');
    return;
  }
  
  // Establecer contexto
  scannerContext = modo;
  
  // Personalizar mensaje según el contexto
  let titleEl = document.querySelector('#scanner-modal .modal-title');
  let subtitleEl = document.querySelector('#scanner-modal .modal-subtitle');
  if (titleEl && subtitleEl) {
    if (modo === 'ventas') {
      titleEl.textContent = '📷 Escanear Producto';
      subtitleEl.textContent = 'Escanea el QR del producto para autocompletar la venta';
    } else {
      titleEl.textContent = '📷 Escanear Código';
      subtitleEl.textContent = 'Apunta la cámara al código QR o código de barras del producto';
    }
  }
  
  // Mostrar modal
  modal.style.display = 'flex';
  
  // Resetear estado
  useBackCamera = true;
  isScannerRunning = false;
  
  // Mostrar estado inicial
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.className = 'scanning';
    statusEl.innerHTML = '<span class="scanner-loading"></span>Iniciando cámara...';
  }
  
  // Limpiar contenido anterior del reader
  if (reader) {
    reader.innerHTML = '';
  }
  
  // Iniciar escáner después de un breve retraso
  setTimeout(() => {
    iniciarScanner();
  }, 500);
  
  console.log('📷 Modal del escáner abierto en modo:', scannerContext);
}

/**
 * Abre el modal del escáner específicamente para REGISTRAR VENTA
 * Alias conveniente para abrirScannerConModo('ventas')
 */
function abrirScannerVentas() {
  abrirScannerConModo('ventas');
}

/**
 * Inicia el escáner de códigos
 */
function iniciarScanner() {
  const statusEl = document.getElementById('scanner-status');
  const reader = document.getElementById('reader');
  
  if (!reader) return;
  
  // Configurar opciones de la cámara
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    rememberLastUsedCamera: true,
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
  };
  
  // Preferir cámara trasera en móvil, delantero en desktop
  const constraints = useBackCamera 
    ? { facingMode: { exact: "environment" } } 
    : { facingMode: "user" };
  
  // Crear escáner
  html5QrcodeScanner = new Html5Qrcode("reader");
  
  // Iniciar cámara
  html5QrcodeScanner.start(
    constraints,
    config,
    onScanSuccess,
    onScanFailure
  ).then(() => {
    isScannerRunning = true;
    if (statusEl) {
      statusEl.className = 'scanning';
      statusEl.innerHTML = '🎯 Apunta al código QR o código de barras';
    }
    console.log('✅ Escáner iniciado correctamente');
  }).catch((error) => {
    console.error('❌ Error al iniciar escáner:', error);
    isScannerRunning = false;
    
    if (statusEl) {
      statusEl.className = 'error';
      statusEl.innerHTML = '❌ Error: ' + getErrorMessage(error);
    }
  });
}

/**
 * Callback cuando se escanea exitosamente un código
 */
function onScanSuccess(decodedText, decodedResult) {
  console.log('✅ Código escaneado:', decodedText);
  
  // Reproducir sonido de éxito (opcional)
  playBeepSound();
  
  // Detener escáner
  detenerScanner();
  
  // Cerrar modal después de un breve retraso
  setTimeout(() => {
    cerrarScanner();
    // Procesar el código escaneado
    procesarCodigoEscaneado(decodedText);
  }, 500);
}

/**
 * Callback cuando falla el escaneo
 */
function onScanFailure(error) {
  // Este callback se llama frecuentemente, solo logueamos errores importantes
  // Los errores de "no code found" son normales durante el escaneo
}

/**
 * Detiene el escáner y libera la cámara
 */
function detenerScanner() {
  if (html5QrcodeScanner && isScannerRunning) {
    html5QrcodeScanner.stop().then(() => {
      isScannerRunning = false;
      console.log('✅ Escáner detenido');
    }).catch((error) => {
      console.error('❌ Error al detener escáner:', error);
      isScannerRunning = false;
    });
  }
}

/**
 * Cierra el modal del escáner
 */
function cerrarScanner() {
  const modal = document.getElementById('scanner-modal');
  const statusEl = document.getElementById('scanner-status');
  
  // Detener escáner si estárunning
  if (isScannerRunning) {
    detenerScanner();
  }
  
  // Ocultar modal
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Resetear estado
  isScannerRunning = false;
  
  console.log('🔒 Modal del escáner cerrado');
}

/**
 * Cambia entre cámara frontal y trasera
 */
function cambiarCamara() {
  const statusEl = document.getElementById('scanner-status');
  
  if (!isScannerRunning) {
    // Si el escáner no estárunning, simplemente invertir la preferencia
    useBackCamera = !useBackCamera;
    abrirScanner();
    return;
  }
  
  // Mostrar estado de cambio
  if (statusEl) {
    statusEl.className = 'scanning';
    statusEl.innerHTML = '<span class="scanner-loading"></span>Cambiando cámara...';
  }
  
  // Detener escáner actual
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      // Invertir preferencia de cámara
      useBackCamera = !useBackCamera;
      // Reiniciar escáner con la nueva cámara
      iniciarScanner();
    }).catch((error) => {
      console.error('❌ Error al cambiar cámara:', error);
      useBackCamera = !useBackCamera;
      iniciarScanner();
    });
  }
}

/**
 * Procesa el código escaneado y llena el formulario según el contexto
 * @param {string} codigo - Código escaneado (QR o código de barras)
 */
function procesarCodigoEscaneado(codigo) {
  console.log(`🔄 Procesando código en contexto "${scannerContext}":`, codigo);
  
  // 🎯 PROCESAR SEGÚN EL CONTEXTO
  if (scannerContext === 'ventas') {
    procesarEscaneoParaVentas(codigo);
    return;
  }
  
  // 📦 CONTEXTO: AGREGAR PRODUCTO (código original)
  procesarEscaneoParaAgregar(codigo);
}

/**
 * Procesa el código escaneado para el formulario de REGISTRAR VENTA
 * @param {string} codigo - Código escaneado
 */
function procesarEscaneoParaVentas(codigo) {
  let productoEncontrado = null;
  let productoData = null;
  
  // Intentar parsear como JSON
  try {
    productoData = JSON.parse(codigo);
    console.log('📋 JSON detectado:', productoData);
    
    // Buscar por SKU en el JSON
    if (productoData.s) {
      productoEncontrado = state.productos[productoData.s];
    }
    
  } catch (e) {
    // Es un código plano, buscar directamente por SKU
    console.log('📄 Código plano detectado, buscando por SKU:', codigo);
    productoEncontrado = state.productos[codigo];
  }
  
  // Si no se encontró por SKU, buscar por nombre
  if (!productoEncontrado && productoData && productoData.n) {
    Object.values(state.productos).forEach(p => {
      if (p.name && p.name.toLowerCase().includes(productoData.n.toLowerCase())) {
        productoEncontrado = p;
      }
    });
  }
  
  // Llenar formulario de ventas
  const saleProductInput = document.getElementById('sale-product');
  const salePriceInput = document.getElementById('sale-price');
  
  if (productoEncontrado) {
    // Producto encontrado en el inventario
    saleProductInput.value = productoEncontrado.name;
    salePriceInput.value = productoEncontrado.price || 0;
    
    // Actualizar precio si viene en el JSON
    if (productoData && productoData.p) {
      salePriceInput.value = productoData.p;
    }
    
    alert(`✅ Producto cargado:\n📦 ${productoEncontrado.name}\n💰 ARS ${parseFloat(productoEncontrado.price || 0).toFixed(2)}\n📊 Stock disponible: ${productoEncontrado.stock || 0}`);
    
    // Enfocar cantidad
    document.getElementById('sale-qty').focus();
    
  } else if (productoData) {
    // Es JSON pero no existe en inventario, usar datos directos
    saleProductInput.value = productoData.n || productoData.name || codigo;
    salePriceInput.value = productoData.p || productoData.price || '';
    
    alert(`✅ Datos cargados:\n📦 ${saleProductInput.value}\n💰 ARS ${salePriceInput.value}`);
    
  } else {
    // Solo código SKU, buscar en inventario
    Object.values(state.productos).forEach(p => {
      if (p.sku && p.sku.toLowerCase().includes(codigo.toLowerCase())) {
        productoEncontrado = p;
      }
    });
    
    if (productoEncontrado) {
      saleProductInput.value = productoEncontrado.name;
      salePriceInput.value = productoEncontrado.price || 0;
      alert(`✅ Producto encontrado:\n📦 ${productoEncontrado.name}\n💰 ARS ${parseFloat(productoEncontrado.price || 0).toFixed(2)}`);
    } else {
      // No se encontró,填写 solo el código
      saleProductInput.value = codigo;
      alert(`⚠️ Producto no encontrado en inventario\n\nCódigo escaneado: ${codigo}\n\nIngresa los datos manualmente.`);
    }
  }
  
  // Trigger fillSalePrice si existe
  if (typeof fillSalePrice === 'function') {
    fillSalePrice();
  }
}

/**
 * Procesa el código escaneado para AGREGAR PRODUCTO
 * @param {string} codigo - Código escaneado
 */
function procesarEscaneoParaAgregar(codigo) {
    try {
    console.log('📋 JSON detectado:', data);
    
    // Llenar campos según la estructura del JSON
    if (data.sku) {
      document.getElementById('p-sku').value = data.sku;
    }
    if (data.nombre || data.name) {
      document.getElementById('p-name').value = data.nombre || data.name;
    }
    if (data.categoria || data.category) {
      document.getElementById('p-category').value = data.categoria || data.category;
    }
    if (data.stock !== undefined) {
      document.getElementById('p-stock').value = data.stock;
    }
    if (data.precio || data.price) {
      document.getElementById('p-price').value = data.precio || data.price;
    }
    if (data.costo || data.cost) {
      document.getElementById('p-cost').value = data.costo || data.cost;
    }
    if (data.marca || data.brand) {
      document.getElementById('p-brand').value = data.marca || data.brand;
    }
    if (data.proveedor || data.supplier) {
      // Intentar seleccionar el proveedor
      const supplierSelect = document.getElementById('p-supplier');
      if (supplierSelect) {
        const options = supplierSelect.options;
        for (let i = 0; i < options.length; i++) {
          if (options[i].text.toLowerCase().includes((data.proveedor || data.supplier).toLowerCase())) {
            supplierSelect.selectedIndex = i;
            break;
          }
        }
      }
    }
    
    // Mostrar notificación de éxito
    let message = '✅ Código escaneado correctamente';
    if (data.nombre || data.name) {
      message += `\n📦 Producto: ${data.nombre || data.name}`;
    }
    alert(message);
    
  } catch (e) {
    // No es JSON, es un código plano
    console.log('📄 Código plano detectado');
    
    // Llenar solo el campo SKU
    document.getElementById('p-sku').value = codigo;
    
    // Verificar si el código ya existe en el inventario
    if (state.productos && state.productos[codigo]) {
      const productoExistente = state.productos[codigo];
      const confirmar = confirm(`⚠️ Ya existe un producto con este código: "${productoExistente.name}"\n\n¿Deseas ver los detalles del producto existente?`);
      
      if (confirmar) {
        // Llenar formulario con datos del producto existente
        document.getElementById('p-name').value = productoExistente.name || '';
        document.getElementById('p-category').value = productoExistente.category || '';
        document.getElementById('p-stock').value = productoExistente.stock || 0;
        document.getElementById('p-price').value = productoExistente.price || 0;
        document.getElementById('p-cost').value = productoExistente.cost || 0;
        document.getElementById('p-brand').value = productoExistente.brand || '';
        document.getElementById('p-ship').value = productoExistente.ship || 0;
        document.getElementById('p-commission').value = productoExistente.commission || 0;
      }
    } else {
      alert(`✅ Código SKU escaneado: ${codigo}\n\nCompleta los demás datos del producto.`);
    }
  }
  
  // Actualizar preview de ganancia
  if (typeof updateProfitPreview === 'function') {
    updateProfitPreview();
  }
}

/**
 * Reproduce un sonido de beep al escanear exitosamente
 */
function playBeepSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // El navegador no soporta audio, ignorar
  }
}

/**
 * Obtiene un mensaje de error amigable
 */
function getErrorMessage(error) {
  if (error === 'PermissionDeniedError' || error.name === 'PermissionDeniedError') {
    return 'Permiso de cámara denegado. Permite el acceso a la cámara para escanear códigos.';
  }
  if (error === 'NotAllowedError') {
    return 'No tienes permiso para usar la cámara.';
  }
  if (error === 'NotFoundError' || error.name === 'NotFoundError') {
    return 'No se encontró cámara en el dispositivo.';
  }
  if (error === 'NotReadableError' || error.name === 'NotReadableError') {
    return 'La cámara está siendo usada por otra aplicación.';
  }
  if (error === 'OverconstrainedError') {
    return 'La cámara no soporta las características requeridas.';
  }
  return 'Error al acceder a la cámara. Verifica los permisos.';
}

// =========================================================
// FUNCIONES PARA MANEJO DE VARIANTES DINÁMICAS
// =========================================================

/**
 * Agrega una nueva fila de variante al formulario
 */
function addVariante() {
  const container = document.getElementById('variantes-container');
  const nuevaFila = document.createElement('div');
  nuevaFila.className = 'variante-row';
  nuevaFila.style.cssText = 'display: flex; gap: 10px; margin-bottom: 8px; align-items: center;';
  
  nuevaFila.innerHTML = `
    <select class="variante-tipo" style="flex: 1; padding: 6px;">
      <option value="">Seleccionar tipo</option>
      <option value="Color">Color</option>
      <option value="Talla">Talla</option>
      <option value="Material">Material</option>
      <option value="Tamaño">Tamaño</option>
      <option value="Estilo">Estilo</option>
      <option value="Modelo">Modelo</option>
      <option value="Otro">Otro</option>
    </select>
    <input class="variante-valor" placeholder="Ej: Rojo, XL, Algodón" style="flex: 2; padding: 6px;" />
    <button type="button" class="remove-variante" onclick="removeVariante(this)" style="background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">✕</button>
  `;
  
  container.appendChild(nuevaFila);
}

/**
 * Remueve una fila de variante del formulario
 * @param {HTMLElement} button - Botón que fue clickeado
 */
function removeVariante(button) {
  const fila = button.closest('.variante-row');
  if (fila) {
    fila.remove();
  }
}

/**
 * Obtiene las variantes del formulario y las convierte en array
 * @returns {Array} Array de objetos con tipo y valor de cada variante
 */
function getVariantesFromForm() {
  const variantes = [];
  const filas = document.querySelectorAll('.variante-row');
  
  filas.forEach(fila => {
    const tipo = fila.querySelector('.variante-tipo').value.trim();
    const valor = fila.querySelector('.variante-valor').value.trim();
    
    if (tipo && valor) {
      variantes.push({
        tipo: tipo,
        valor: valor
      });
    }
  });
  
  return variantes;
}

/**
 * Carga las variantes en el formulario para edición
 * @param {Array} variantes - Array de variantes del producto
 */
function loadVariantesInForm(variantes) {
  const container = document.getElementById('variantes-container');
  
  // Limpiar variantes existentes (excepto la primera que se mantiene como template)
  const filas = container.querySelectorAll('.variante-row');
  filas.forEach((fila, index) => {
    if (index > 0) { // Mantener solo la primera fila
      fila.remove();
    }
  });
  
  // Si no hay variantes, limpiar la primera fila
  if (!variantes || variantes.length === 0) {
    const primeraFila = container.querySelector('.variante-row');
    if (primeraFila) {
      primeraFila.querySelector('.variante-tipo').value = '';
      primeraFila.querySelector('.variante-valor').value = '';
    }
    return;
  }
  
  // Cargar la primera variante en la primera fila
  if (variantes.length > 0) {
    const primeraFila = container.querySelector('.variante-row');
    if (primeraFila) {
      primeraFila.querySelector('.variante-tipo').value = variantes[0].tipo;
      primeraFila.querySelector('.variante-valor').value = variantes[0].valor;
    }
  }
  
  // Agregar filas adicionales para las demás variantes
  for (let i = 1; i < variantes.length; i++) {
    addVariante();
    const ultimaFila = container.querySelectorAll('.variante-row')[i];
    if (ultimaFila) {
      ultimaFila.querySelector('.variante-tipo').value = variantes[i].tipo;
      ultimaFila.querySelector('.variante-valor').value = variantes[i].valor;
    }
  }
}

/**
 * Formatea las variantes para mostrar en la interfaz
 * @param {Array} variantes - Array de variantes
 * @returns {string} String formateado con las variantes
 */
function formatVariantes(variantes) {
  if (!variantes || variantes.length === 0) return '';
  
  return variantes.map(v => `${v.tipo}: ${v.valor}`).join(', ');
}

// ----------------------------------------------------
// FUNCIONES PARA MANEJO DE IMÁGENES DINÁMICAS
// ----------------------------------------------------

/**
 * Maneja la carga de múltiples archivos de imagen
 * @param {Event} event - Evento de cambio del input file
 */
function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const maxFiles = 10; // Máximo 10 imágenes por producto
  const maxSize = 5 * 1024 * 1024; // 5MB por imagen
  
  if (files.length > maxFiles) {
    alert(`Máximo ${maxFiles} imágenes permitidas por producto`);
    event.target.value = '';
    return;
  }
  
  // Validar tamaño y tipo de archivo
  const validFiles = [];
  const errors = [];
  
  files.forEach((file, index) => {
    if (!file.type.startsWith('image/')) {
      errors.push(`Archivo ${index + 1}: No es una imagen válida`);
      return;
    }
    
    if (file.size > maxSize) {
      errors.push(`Archivo ${index + 1}: Muy grande (máx 5MB)`);
      return;
    }
    
    validFiles.push(file);
  });
  
  if (errors.length > 0) {
    alert('Errores en la carga de archivos:\n' + errors.join('\n'));
    event.target.value = '';
    return;
  }
  
  if (validFiles.length === 0) {
    alert('No se seleccionaron archivos válidos');
    event.target.value = '';
    return;
  }
  
  // Procesar archivos válidos
  processImageFiles(validFiles);
}

/**
 * Convierte archivos a base64 y los muestra como preview
 * @param {File[]} files - Array de archivos válidos
 */
function processImageFiles(files) {
  const previewContainer = document.getElementById('imagenes-preview');
  const infoContainer = document.getElementById('imagenes-info');
  
  // Verificar límite total de imágenes
  const existingImages = previewContainer.querySelectorAll('.imagen-item').length;
  const maxFiles = 10;
  
  if (existingImages + files.length > maxFiles) {
    alert(`Máximo ${maxFiles} imágenes permitidas por producto. Tienes ${existingImages} y estás intentando agregar ${files.length}.`);
    document.getElementById('p-imagenes').value = '';
    return;
  }
  
  let processedCount = 0;
  const totalFiles = files.length;
  const imagenesData = [];
  
  files.forEach((file, index) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const imagenData = {
        id: 'img_' + Date.now() + '_' + index,
        name: file.name,
        size: file.size,
        type: file.type,
        data: e.target.result,
        fecha: new Date().toISOString()
      };
      
      imagenesData.push(imagenData);
      
      // Crear preview de la imagen
      createImagePreview(imagenData, index);
      
      processedCount++;
      
      if (processedCount === totalFiles) {
        // Todas las imágenes procesadas - obtener imágenes existentes y agregar las nuevas
        const existingImagesInput = document.getElementById('p-imagenes-data');
        let allImages = [];
        
        if (existingImagesInput && existingImagesInput.value) {
          try {
            allImages = JSON.parse(existingImagesInput.value);
          } catch (e) {
            allImages = [];
          }
        }
        
        // Combinar imágenes existentes con las nuevas
        allImages = allImages.concat(imagenesData);
        
        // Guardar todas las imágenes
        saveImagesToForm(allImages);
        updateImageInfo(allImages.length, totalFiles);
      }
    };
    
    reader.onerror = function() {
      alert(`Error procesando imagen: ${file.name}`);
      processedCount++;
      
      if (processedCount === totalFiles) {
        // En caso de error, también combinar con imágenes existentes
        const existingImagesInput = document.getElementById('p-imagenes-data');
        let allImages = [];
        
        if (existingImagesInput && existingImagesInput.value) {
          try {
            allImages = JSON.parse(existingImagesInput.value);
          } catch (e) {
            allImages = [];
          }
        }
        
        allImages = allImages.concat(imagenesData);
        saveImagesToForm(allImages);
        updateImageInfo(allImages.length, totalFiles);
      }
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Crea el preview visual de una imagen
 * @param {Object} imagenData - Datos de la imagen
 * @param {number} index - Índice de la imagen
 */
function createImagePreview(imagenData, index) {
  const previewContainer = document.getElementById('imagenes-preview');
  
  const previewDiv = document.createElement('div');
  previewDiv.className = 'imagen-item';
  previewDiv.style.cssText = `
    position: relative;
    width: 120px;
    height: 120px;
    border: 2px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s;
  `;
  
  previewDiv.innerHTML = `
    <img src="${imagenData.data}" alt="${imagenData.name}" style="width: 100%; height: 100%; object-fit: cover;" />
    <button type="button" class="remove-image" onclick="removeImage('${imagenData.id}', this)" style="
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(220, 53, 69, 0.9);
      color: white;
      border: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">✕</button>
    <div style="
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 4px;
      font-size: 10px;
      text-align: center;
    ">${imagenData.name.substring(0, 15)}${imagenData.name.length > 15 ? '...' : ''}</div>
  `;
  
  // Agregar efecto hover
  previewDiv.addEventListener('mouseenter', function() {
    this.style.borderColor = '#026669';
    this.style.transform = 'scale(1.05)';
  });
  
  previewDiv.addEventListener('mouseleave', function() {
    this.style.borderColor = '#ddd';
    this.style.transform = 'scale(1)';
  });
  
  previewContainer.appendChild(previewDiv);
}

/**
 * Remueve una imagen específica del preview
 * @param {string} imageId - ID de la imagen a remover
 * @param {HTMLElement} button - Botón que fue clickeado
 */
function removeImage(imageId, button) {
  const previewDiv = button.closest('.imagen-item');
  previewDiv.remove();
  
  // Actualizar el input hidden con las imágenes restantes
  updateImagesInForm();
  
  // Actualizar información
  const remainingImages = document.querySelectorAll('.imagen-item').length;
  updateImageInfo(remainingImages, remainingImages);
}

/**
 * Guarda las imágenes procesadas en el input hidden
 * @param {Array} imagenesData - Array de datos de imágenes
 */
function saveImagesToForm(imagenesData) {
  const inputHidden = document.getElementById('p-imagenes-data');
  if (!inputHidden) {
    // Crear el input hidden si no existe
    const input = document.createElement('input');
    input.type = 'hidden';
    input.id = 'p-imagenes-data';
    input.value = JSON.stringify(imagenesData);
    document.getElementById('imagenes-container').appendChild(input);
  } else {
    inputHidden.value = JSON.stringify(imagenesData);
  }
}

/**
 * Actualiza las imágenes en el formulario (remueve una)
 */
function updateImagesInForm() {
  const previewContainer = document.getElementById('imagenes-preview');
  const inputHidden = document.getElementById('p-imagenes-data');
  
  if (!inputHidden) return;
  
  const imagenesData = [];
  const imageItems = previewContainer.querySelectorAll('.imagen-item img');
  
  // Recrear datos de las imágenes restantes
  imageItems.forEach(img => {
    const imagenData = {
      id: 'img_' + Date.now() + '_' + Math.random(),
      name: img.alt,
      data: img.src,
      fecha: new Date().toISOString()
    };
    imagenesData.push(imagenData);
  });
  
  inputHidden.value = JSON.stringify(imagenesData);
}

/**
 * Actualiza la información mostrada sobre las imágenes
 * @param {number} count - Número de imágenes
 * @param {number} total - Total procesado
 */
function updateImageInfo(count, total) {
  const infoContainer = document.getElementById('imagenes-info');
  if (count === 0) {
    infoContainer.innerHTML = '';
    return;
  }
  
  const totalSize = document.querySelectorAll('.imagen-item img').length * 2.5; // Estimación
  infoContainer.innerHTML = `
    <span style="color: #28a745; font-weight: bold;">✅ ${count} imagen${count !== 1 ? 'es' : ''} cargada${count !== 1 ? 's' : ''}</span>
    ${total !== count ? ` (${total} seleccionadas)` : ''}
  `;
}

/**
 * Carga las imágenes en el formulario para edición
 * @param {Array} imagenes - Array de imágenes del producto
 */
function loadImagesInForm(imagenes) {
  const previewContainer = document.getElementById('imagenes-preview');
  previewContainer.innerHTML = '';
  
  if (!imagenes || imagenes.length === 0) {
    updateImageInfo(0, 0);
    return;
  }
  
  imagenes.forEach((imagen, index) => {
    const imagenData = {
      id: imagen.id || 'img_' + Date.now() + '_' + index,
      name: imagen.name || 'Imagen ' + (index + 1),
      data: imagen.data || imagen.src,
      fecha: imagen.fecha || new Date().toISOString()
    };
    
    createImagePreview(imagenData, index);
  });
  
  // Guardar en input hidden
  saveImagesToForm(imagenes);
  updateImageInfo(imagenes.length, imagenes.length);
}

/**
 * Limpia todas las imágenes del formulario
 */
function clearImagesForm() {
  const previewContainer = document.getElementById('imagenes-preview');
  const inputFile = document.getElementById('p-imagenes');
  const infoContainer = document.getElementById('imagenes-info');
  const inputHidden = document.getElementById('p-imagenes-data');
  
  previewContainer.innerHTML = '';
  inputFile.value = '';
  infoContainer.innerHTML = '';
  if (inputHidden) {
    inputHidden.value = '';
  }
}

/**
 * Limpia todas las imágenes con confirmación del usuario
 */
function clearAllImages() {
  const previewContainer = document.getElementById('imagenes-preview');
  
  if (previewContainer.querySelectorAll('.imagen-item').length === 0) {
    return; // No hay imágenes para limpiar
  }
  
  if (confirm('¿Estás seguro de que quieres eliminar todas las imágenes?')) {
    clearImagesForm();
  }
}

/**
 * Formatea las imágenes para mostrar en la interfaz
 * @param {Array} imagenes - Array de imágenes
 * @returns {string} String formateado con información de imágenes
 */
function formatImages(imagenes) {
  if (!imagenes || imagenes.length === 0) return '';
  
  return `${imagenes.length} imagen${imagenes.length !== 1 ? 'es' : ''}`;
}

// ----------------------------------------------------
// FUNCIONES PARA DRAG & DROP DE IMÁGENES
// ----------------------------------------------------

/**
 * Maneja el evento cuando se arrastra un archivo sobre el área de carga
 * @param {DragEvent} event - Evento de drag over
 */
function handleDragOver(event) {
  event.preventDefault();
  const uploadArea = document.getElementById('upload-area');
  uploadArea.style.borderColor = '#026669';
  uploadArea.style.backgroundColor = '#f8f9fa';
}

/**
 * Maneja el evento cuando se suelta un archivo en el área de carga
 * @param {DragEvent} event - Evento de drop
 */
function handleDrop(event) {
  event.preventDefault();
  const uploadArea = document.getElementById('upload-area');
  uploadArea.style.borderColor = '#ccc';
  uploadArea.style.backgroundColor = 'transparent';
  
  const files = Array.from(event.dataTransfer.files);
  if (files.length > 0) {
    // Simular que se seleccionaron archivos
    const fileInput = document.getElementById('p-imagenes');
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
    handleImageUpload({ target: fileInput });
  }
}

/**
 * Maneja el evento cuando se sale del área de carga sin soltar
 * @param {DragEvent} event - Evento de drag leave
 */
function handleDragLeave(event) {
  event.preventDefault();
  const uploadArea = document.getElementById('upload-area');
  uploadArea.style.borderColor = '#ccc';
  uploadArea.style.backgroundColor = 'transparent';
}

// ----------------------------------------------------
// PRODUCTOS - ESTRUCTURA COMPATIBLE CON WOOCOMMERCE
// ----------------------------------------------------

// Guardar producto (actualizado para estructura WooCommerce)
function saveProduct(event) {
  if (event) {
    event.preventDefault(); // Prevenir envío del formulario
  }
  
  const sku = document.getElementById('p-sku').value.trim();
  const name = document.getElementById('p-name').value.trim();
  const variantes = getVariantesFromForm();
  
  // Obtener imágenes del formulario
  const imagenesInput = document.getElementById('p-imagenes-data');
  const imagenes = imagenesInput ? JSON.parse(imagenesInput.value || '[]') : [];
  const supplier = document.getElementById('p-supplier').value.trim();
  const brand = document.getElementById('p-brand').value.trim();
  const category = document.getElementById('p-category').value.trim();
  const cost = parseFloat(document.getElementById('p-cost').value) || 0;
  const ship = parseFloat(document.getElementById('p-ship').value) || 0;
  const commission = parseFloat(document.getElementById('p-commission').value) || 0;
  const price = parseFloat(document.getElementById('p-price').value) || 0;
  const stock = parseInt(document.getElementById('p-stock').value) || 0;
  const publish = {
    ml: document.getElementById('pub-ml').checked,
    fb: document.getElementById('pub-fb').checked,
    ig: document.getElementById('pub-ig').checked,
    ig: document.getElementById('pub-wc').checked
  };

  if (!sku || !name) {
    alert('SKU y Nombre son obligatorios');
    return;
  }

  console.log('💾 Guardando producto con SKU:', sku);
  console.log('💾 Modo edición actual:', editingSku);
  
  const existing = state.productos[sku];
  console.log('💾 Producto existente encontrado:', !!existing);

  const product = { 
    sku, 
    name, 
    variantes: variantes, 
    imagenes: imagenes,
    supplier, 
    brand, 
    category, 
    cost, 
    ship, 
    commission, 
    price, 
    stock, 
    publish 
  };

  if (existing && editingSku === sku) { 
    console.log('🔄 Actualizando producto existente (modo edición)...');
    Object.assign(existing, product); 
  } else {
    console.log('🆕 Creando nuevo producto...');
    state.productos[sku] = product;
  }

  // Actualizar la UI localmente ANTES de enviar a Firebase
  renderProducts(); // Actualizar inmediatamente la vista de productos
  
  saveState(); // Envia a Firebase
  
  // Navegar de vuelta a la vista de productos
  navigate('productos');
  
  // Limpiar modo edición después de guardar
  editingSku = null;
  console.log('✅ Producto guardado, modo edición desactivado');
  
  alert('Producto guardado en la nube ☁️');
  
  // ✅ OFRECER IMPRESIÓN DE ETIQUETA QR
  setTimeout(() => {
    if (confirm(`✅ Producto "${name}" guardado exitosamente.\n\n¿Deseas imprimir la etiqueta QR para este producto?`)) {
      generateQRLabel(sku);
    }
  }, 300);
  
  // Sincronizar con WooCommerce si está configurado
  if (currentWooConfig) {
    syncProductWithWoo(product).then(result => {
      if (result.success) {
        console.log(`✅ ${result.message} (${product.sku})`);
        alert(`✅ Producto ${sku}\n${result.message}`);
      } else {
        console.warn(`⚠️ ${result.message} (${product.sku})`);
        alert(`⚠️ Error sincronizando ${sku}:\n${result.message}`);
      }
    });
  }
  
  // 🔄 Actualizar kardex automáticamente
  actualizarKardexAutomatico();
}

function updateProfitPreview() {
  const cost = parseFloat(document.getElementById('p-cost').value) || 0;
  const ship = parseFloat(document.getElementById('p-ship').value) || 0;
  const commission = parseFloat(document.getElementById('p-commission').value) || 0;
  const price = parseFloat(document.getElementById('p-price').value) || 0;
  const commissionAmount = price * (commission / 100);
  const profit = price - (cost + ship + commissionAmount);
  const profitPct = price ? (profit / price * 100) : 0;
  document.getElementById('profit-preview').innerText = `ARS ${profit.toFixed(2)} (${profitPct.toFixed(1)}%)`;
}

function resetForm() {
  console.log('🧹 Limpiando formulario...');
  document.getElementById('product-form').reset();
  document.getElementById('p-stock').value = '0';
  document.getElementById('p-price').value = '';
  document.getElementById('p-cost').value = '';
  document.getElementById('profit-preview').innerText = '';
  editingSku = null; // Limpiar modo edición
  
  // Limpiar variantes
  const container = document.getElementById('variantes-container');
  const filas = container.querySelectorAll('.variante-row');
  
  // Mantener solo la primera fila y limpiarla
  if (filas.length > 0) {
    const primeraFila = filas[0];
    primeraFila.querySelector('.variante-tipo').value = '';
    primeraFila.querySelector('.variante-valor').value = '';
  }
  
  // Remover filas adicionales
  for (let i = 1; i < filas.length; i++) {
    filas[i].remove();
  }
  
  // Limpiar imágenes
  clearImagesForm();
  
  console.log('✅ Formulario limpiado, modo edición desactivado');
}

function newProduct() {
  console.log('🆕 Iniciando creación de nuevo producto...');
  editingSku = null; // Asegurar modo creación
  resetForm(); // Limpiar formulario completamente
  navigate('agregar');
}

// Renderizar productos (CORREGIDO)
function renderProducts() {
  // CORRECCIÓN: Cambiar 'products-container' por 'products-list'
  const container = document.getElementById('products-list'); // ← ESTE ERA EL PROBLEMA PRINCIPAL
  if (!container) {
    console.error('Contenedor de productos no encontrado');
    return;
  }
  
  // Validar state antes de proceder
  if (!validarState()) {
    console.error('❌ No se puede renderizar productos: state inválido');
    return;
  }

  const filter = document.getElementById('category-filter')?.value || '';
  const q = document.getElementById('search-input')?.value.toLowerCase() || '';

  // Validar que state.productos existe
  if (!state.productos || typeof state.productos !== 'object') {
    console.warn('⚠️ No se pueden renderizar productos: state.productos no está inicializado');
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#666">No hay productos para mostrar</div>';
    return;
  }

  let list = Object.values(state.productos);
  if (filter) list = list.filter(p => p && p.category === filter);
  if (q) list = list.filter(p => p && (p.name && p.name.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q)));

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = list.slice(start, start + PAGE_SIZE);

  container.innerHTML = '';
  slice.forEach(p => {
    const el = document.createElement('div'); 
    el.className = 'product';
    
    // Verificar si hay órdenes activas para este producto
    const ordenesActivas = (p.ordenesCompra && Array.isArray(p.ordenesCompra)) ? p.ordenesCompra.filter(oc => 
      oc && oc.estado && (oc.estado === 'Pendiente' || oc.estado === 'En Tránsito')
    ) : [];
    
    // Determinar color del stock
    const stock = p.stock || 0;
    let stockColor = '#28a745'; // Verde
    let stockBg = '#d4edda';
    if (stock <= 3) {
      stockColor = '#dc3545'; // Rojo
      stockBg = '#f8d7da';
    } else if (stock <= 10) {
      stockColor = '#ffc107'; // Amarillo
      stockBg = '#fff3cd';
    }
    
    // Información de órdenes activas
    let ordenesInfo = '';
    if (ordenesActivas.length > 0) {
      const totalCantidad = ordenesActivas.reduce((sum, oc) => sum + (oc.cantidad || 0), 0);
      ordenesInfo = `
        <div style="margin-top:4px;padding:4px 8px;background:#e3f2fd;border-radius:6px;font-size:11px;color:#1565c0">
          📋 ${ordenesActivas.length} orden(es) activa(s) - ${totalCantidad} unidades en camino
        </div>
      `;
    }
    
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <strong>${p.name}</strong>
          <div class="small muted">SKU: ${p.sku}</div>
          ${p.variantes && p.variantes.length > 0 ? `<div class="small muted">Variantes: ${formatVariantes(p.variantes)}</div>` : ''}
          ${p.imagenes && p.imagenes.length > 0 ? `<div class="small muted">📷 ${formatImages(p.imagenes)}</div>` : ''}
        </div>
        <div><span class="tag">${p.category || 'Sin categoría'}</span></div>
      </div>
      <div style="margin-top:8px" class="small">Marca: ${p.brand || '-'} · Proveedor: ${p.supplier || '-'}</div>
      ${ordenesInfo}
      <div style="element.style {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-top: 10px;
    flex-wrap: wrap;
    flex-direction: row;
    align-content: center;">
        <div>
          <div class="small muted">Precio: ARS ${p.price?.toFixed(2) || '0.00'}</div>
          <div class="small muted">Costo: ARS ${p.cost?.toFixed(2) || '0.00'}</div>
          <div style="margin-top:4px">
            <span style="padding:4px 8px;border-radius:12px;background:${stockBg};color:${stockColor};font-size:12px;font-weight:600">
              Stock: ${stock}
            </span>
          </div>
        </div>
        <div class="card-productos">
          <button onclick="generateQRLabel('${p.sku}')" title="Imprimir etiqueta QR">🏷️ QR</button>
          <button onclick="editProduct('${p.sku}')">Editar</button>
          <button onclick="deleteProduct('${p.sku}')">Eliminar</button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });

  // Actualizar número de página
  const pageNumEl = document.getElementById('page-num');
  if (pageNumEl) {
    pageNumEl.textContent = currentPage;
  }

  // Paginación
  const pagination = document.getElementById('pagination');
  if (pagination) {
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className = i === currentPage ? 'active' : '';
      btn.onclick = () => { currentPage = i; renderProducts(); };
      pagination.appendChild(btn);
    }
  }
}

// Función para navegar a la página anterior (FALTANTE)
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderProducts();
  }
}

// Función para navegar a la página siguiente (FALTANTE)
function nextPage() {
  const totalPages = Math.max(1, Math.ceil(Object.keys(state.productos).length / PAGE_SIZE));
  if (currentPage < totalPages) {
    currentPage++;
    renderProducts();
  }
}

function editProduct(sku) {
  console.log('🔍 Intentando editar producto con SKU:', sku);
  let p = state.productos[sku];
  let realKey = sku;
  
  // Si no encuentra por SKU directamente, buscar por propiedad sku
  if (!p) {
    const entry = Object.entries(state.productos).find(([key, prod]) => prod.sku === sku);
    if (entry) {
      realKey = entry[0];
      p = entry[1];
      console.log(`🔍 Producto encontrado con clave: ${realKey}`);
    }
  }
  
  console.log('🔍 Producto encontrado:', p);
  
  if (!p) {
    console.warn('⚠️ Producto no encontrado en state.productos');
    alert(`El producto ${sku} no existe en Firebase.\n\nUsa el botón "Eliminar" para limpiarlo.`);
    return;
  }
  
  // Establecer que estamos editando este SKU (usar clave real)
  editingSku = realKey;
  console.log('✏️ Modo edición activado para clave:', editingSku);
  
  console.log('📝 Navegando a agregar y poblando formulario...');
  navigate('agregar');
  
  // Poblar todos los campos
  document.getElementById('p-sku').value = p.sku;
  document.getElementById('p-name').value = p.name;
  // Cargar variantes en el formulario
  loadVariantesInForm(p.variantes || []);
  
  // Cargar imágenes en el formulario
  loadImagesInForm(p.imagenes || []);
  document.getElementById('p-supplier').value = p.supplier || '';
  document.getElementById('p-brand').value = p.brand || '';
  document.getElementById('p-category').value = p.category || '';
  document.getElementById('p-stock').value = p.stock || 0;
  document.getElementById('p-cost').value = p.cost || 0;
  document.getElementById('p-ship').value = p.ship || 0;
  document.getElementById('p-commission').value = p.commission || 0;
  document.getElementById('p-price').value = p.price || 0;

  if (p.publish) {
    document.getElementById('pub-ml').checked = p.publish.ml || false;
    document.getElementById('pub-fb').checked = p.publish.fb || false;
    document.getElementById('pub-ig').checked = p.publish.ig || false;
    document.getElementById('pub-wc').checked = p.publish.wc || false;
  }

  console.log('✅ Formulario poblado, SKU actual:', document.getElementById('p-sku').value);
  updateProfitPreview();
}

function deleteProduct(sku) {
  let p = state.productos[sku];
  let keyToDelete = sku;
  
  // Si no encuentra por SKU directamente, buscar por propiedad sku
  if (!p) {
    const entry = Object.entries(state.productos).find(([key, prod]) => prod.sku === sku);
    if (entry) {
      keyToDelete = entry[0];
      p = entry[1];
      console.log(`🔍 Producto encontrado con clave diferente: ${keyToDelete}`);
    }
  }
  
  if (!p) {
    // Producto fantasma: no existe en Firebase
    console.warn(`⚠️ Producto ${sku} no encontrado. Forzando limpieza...`);
    
    // Forzar eliminación de Firebase por si existe con otra estructura
    if (db) {
      db.ref(`/productos`).once('value').then(snapshot => {
        const productos = snapshot.val() || {};
        Object.keys(productos).forEach(key => {
          if (productos[key].sku === sku) {
            db.ref(`/productos/${key}`).remove();
            console.log(`✅ Eliminado de Firebase: ${key}`);
          }
        });
      });
    }
    
    alert(`Producto ${sku} forzado a eliminar.\nRecarga la página en unos segundos.`);
    setTimeout(() => location.reload(), 1500);
    return;
  }
  
  if (!confirm(`¿Eliminar producto "${p.name}"?`)) return;
  
  delete state.productos[keyToDelete];
  saveState();
  
  // Si no hay productos en la página actual, volver a la página anterior
  const totalPages = Math.max(1, Math.ceil(Object.keys(state.productos).length / PAGE_SIZE));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  
  renderProducts();
  
  // 🔄 Actualizar kardex automáticamente
  actualizarKardexAutomatico();
}

/* =========================================================
   CONFIGURACIÓN DINÁMICA WOOCOMMERCE - SISTEMA COMPLETO
   Compatible con la estructura Firebase dinámica ya implementada
========================================================= */

// Variables globales para WooCommerce
let currentWooConfig = null;
let wooStatus = null;

// Configuración por defecto (fallback)
const DEFAULT_WOO_CONFIG = {
  url: "https://tienda-ejemplo.com",
  key: "ck_example",
  secret: "cs_example"
};

// Configuración de ejemplo para UI
const WOO_CONFIG_EXAMPLE = {
  url: "https://mi-tienda.com",
  key: "ck_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  secret: "cs_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
};

// Validar configuración WooCommerce
function validateWooConfig(config) {
  const errors = [];
  
  // Validar URL
  if (!config.url || config.url.trim() === '') {
    errors.push('URL de la tienda es requerida');
  } else {
    try {
      new URL(config.url);
    } catch {
      errors.push('URL debe ser una dirección web válida');
    }
  }
  
  // Validar Consumer Key
  if (!config.key || config.key.trim() === '') {
    errors.push('Consumer Key es requerida');
  } else if (!config.key.startsWith('ck_')) {
    errors.push('Consumer Key debe comenzar con "ck_"');
  } else if (config.key.length < 20) {
    errors.push('Consumer Key parece estar incompleta');
  }
  
  // Validar Consumer Secret
  if (!config.secret || config.secret.trim() === '') {
    errors.push('Consumer Secret es requerida');
  } else if (!config.secret.startsWith('cs_')) {
    errors.push('Consumer Secret debe comenzar con "cs_"');
  } else if (config.secret.length < 20) {
    errors.push('Consumer Secret parece estar incompleta');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    message: errors.length === 0 ? 'Configuración válida' : errors.join(', ')
  };
}

// Cargar configuración WooCommerce desde localStorage
function loadWooConfig() {
  try {
    const savedConfig = localStorage.getItem('woo-config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      const validation = validateWooConfig(config);
      
      if (validation.isValid) {
        currentWooConfig = config;
        console.log('Configuración WooCommerce cargada exitosamente');
        return { success: true, config: config, source: 'localStorage' };
      } else {
        console.warn('Configuración WooCommerce inválida en localStorage:', validation.errors);
        return { success: false, error: validation.errors.join(', '), source: 'localStorage' };
      }
    }
  } catch (error) {
    console.error('Error cargando configuración WooCommerce:', error);
    return { success: false, error: 'Error al cargar configuración', source: 'localStorage' };
  }
  
  return { success: false, error: 'No hay configuración guardada', source: 'none' };
}

// Inicializar configuración WooCommerce
function initializeWooConfig() {
  const result = loadWooConfig();
  
  if (result.success) {
    // Actualizar campos de configuración en la UI
    updateWooConfigDisplay(result.config);
  } else {
    // Cargar configuración de ejemplo en la UI
    updateWooConfigDisplay(WOO_CONFIG_EXAMPLE);
    console.log('Configuración WooCommerce:', result.error);
  }
}

// Actualizar campos de configuración en la UI
function updateWooConfigDisplay(config) {
  const urlInput = document.getElementById('woo-url');
  const keyInput = document.getElementById('woo-key');
  const secretInput = document.getElementById('woo-secret');
  const statusEl = document.getElementById('woo-connection-status');
  
  if (urlInput) urlInput.value = config.url || '';
  if (keyInput) keyInput.value = config.key || '';
  if (secretInput) secretInput.value = config.secret || '';
  
  if (statusEl) {
    if (currentWooConfig) {
      // ✅ NUEVO: Incluir timestamp en el estado de conexión
      updateStatusWithTimestamp(statusEl, 'Estado', 'Conectado ✓', new Date(), '#4caf50');
    } else {
      // ✅ NUEVO: Mostrar "No configurado" sin timestamp
      statusEl.innerText = 'Estado: No configurado';
      statusEl.style.color = '#ff9800';
    }
  }
}

// Función mejorada para guardar configuración WooCommerce
function saveWooConfig() {
  const urlInput = document.getElementById('woo-url');
  const keyInput = document.getElementById('woo-key');
  const secretInput = document.getElementById('woo-secret');
  
  if (!urlInput || !keyInput || !secretInput) {
    alert('Error: Campos de configuración no encontrados');
    return;
  }
  
  const config = {
    url: urlInput.value.trim(),
    key: keyInput.value.trim(),
    secret: secretInput.value.trim()
  };
  
  const validation = validateWooConfig(config);
  
  if (!validation.isValid) {
    alert('Error de validación:\n' + validation.errors.join('\n'));
    
    // Resaltar campos inválidos
    if (urlInput.value.trim() === '') urlInput.style.borderColor = '#f44336';
    if (keyInput.value.trim() === '' || !keyInput.value.startsWith('ck_')) keyInput.style.borderColor = '#f44336';
    if (secretInput.value.trim() === '' || !secretInput.value.startsWith('cs_')) secretInput.style.borderColor = '#f44336';
    
    return;
  }
  
  // Limpiar bordes si eran inválidos
  urlInput.style.borderColor = '';
  keyInput.style.borderColor = '';
  secretInput.style.borderColor = '';
  
  try {
    localStorage.setItem('woo-config', JSON.stringify(config));
    currentWooConfig = config;
    
    updateWooConfigDisplay(config);
    alert('✓ Configuración de WooCommerce guardada exitosamente\n\nAhora puedes probar la conexión.');
    
    // Intentar validar conexión automáticamente
    validateWooConnection();
    
  } catch (error) {
    console.error('Error guardando configuración WooCommerce:', error);
    alert('Error al guardar configuración: ' + error.message);
  }
}

// Función para mostrar configuración actual
function loadCurrentWooConfig() {
  const result = loadWooConfig();
  
  if (result.success) {
    updateWooConfigDisplay(result.config);
    alert('✓ Configuración actual cargada desde memoria local');
  } else {
    alert('⚠️ No hay configuración guardada\n\nPor favor, ingresa tus credenciales de WooCommerce.');
    updateWooConfigDisplay(WOO_CONFIG_EXAMPLE);
  }
}

// Función para limpiar configuración WooCommerce
function clearWooConfig() {
  if (!confirm('¿Estás seguro que quieres eliminar la configuración de WooCommerce?')) {
    return;
  }
  
  try {
    localStorage.removeItem('woo-config');
    currentWooConfig = null;
    
    // Limpiar campos
    updateWooConfigDisplay(WOO_CONFIG_EXAMPLE);
    
    alert('✓ Configuración de WooCommerce eliminada');
  } catch (error) {
    console.error('Error eliminando configuración WooCommerce:', error);
    alert('Error al eliminar configuración: ' + error.message);
  }
}

// Validar conexión con WooCommerce API
async function validateWooConnection() {
  if (!currentWooConfig) {
    alert('Primero debes configurar las credenciales de WooCommerce');
    return false;
  }
  
  const statusEl = document.getElementById('woo-connection-status');
  if (statusEl) {
    statusEl.innerText = 'Estado: Validando conexión...';
    statusEl.style.color = '#ff9800';
  }
  
  try {
    const response = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products?per_page=1`, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      if (statusEl) {
        // ✅ NUEVO: Incluir timestamp cuando la conexión es exitosa
        updateStatusWithTimestamp(statusEl, 'Estado', 'Conectado ✓', new Date(), '#4caf50');
      }
      alert('✓ Conexión con WooCommerce establecida exitosamente');
      return true;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error de conexión WooCommerce:', error);
    
    if (statusEl) {
      statusEl.innerText = 'Estado: Error de conexión ✗';
      statusEl.style.color = '#f44336';
    }
    
    alert('✗ Error de conexión con WooCommerce:\n' + error.message + '\n\nVerifica:\n• URL de la tienda\n• Consumer Key y Consumer Secret\n• Que WooCommerce API esté habilitada');
    return false;
  }
}

// Función para sincronizar todos los productos con WooCommerce
async function syncAllProductsWithWoo() {
  if (!currentWooConfig) {
    alert('Primero configura las credenciales de WooCommerce');
    return;
  }
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de sincronizar
  if (!validarState()) {
    console.error('❌ No se pudo validar state en syncAllProductsWithWoo');
    return alert("Error interno: state no válido");
  }
  
  const products = Object.values(state.productos);
  if (products.length === 0) {
    alert('No hay productos para sincronizar');
    return;
  }
  
  if (!confirm(`¿Sincronizar ${products.length} productos con WooCommerce?`)) {
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  // Mostrar progreso
  const progressDiv = document.createElement('div');
  progressDiv.innerHTML = `
    <div style="position: fixed; top: 20px; right: 20px; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); z-index: 1000;">
      <h4>Sincronizando con WooCommerce...</h4>
      <div>Procesados: <span id="sync-progress">0</span> / ${products.length}</div>
      <div>Exitosos: <span id="sync-success">0</span></div>
      <div>Errores: <span id="sync-errors">0</span></div>
    </div>
  `;
  document.body.appendChild(progressDiv);
  
  for (const product of products) {
    try {
      const result = await syncProductWithWoo(product);
      if (result.success) {
        successCount++;
        if (result.action === 'updated') {
          console.log(`✅ ${product.sku}: ${result.message}`);
        } else if (result.action === 'created') {
          console.log(`🆕 ${product.sku}: ${result.message}`);
        } else {
          console.log(`✅ ${product.sku}: ${result.message}`);
        }
      } else {
        errorCount++;
        console.warn(`❌ ${product.sku}: ${result.message}`);
      }
    } catch (error) {
      console.error('Error sincronizando producto:', error);
      errorCount++;
    }
    
    // Actualizar progreso
    document.getElementById('sync-progress').textContent = successCount + errorCount;
    document.getElementById('sync-success').textContent = successCount;
    document.getElementById('sync-errors').textContent = errorCount;
    
    // Pequeña pausa para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Limpiar progreso
  document.body.removeChild(progressDiv);
  
  alert(`✓ Sincronización completada\n\nProductos exitosos: ${successCount}\nErrores: ${errorCount}\nTotal: ${products.length}`);
}

// Función para sincronizar producto con WooCommerce (MEJORADA)
async function syncProductWithWoo(product) {
  console.log(`🚀 === INICIANDO SINCRONIZACIÓN ===`);
  console.log(`📦 Producto a sincronizar:`, {
    sku: product.sku,
    name: product.name,
    price: product.price,
    stock: product.stock,
    hasImages: product.imagenes ? product.imagenes.length : 0
  });
  
  if (!currentWooConfig) {
    console.log('WooCommerce no configurado, saltando sincronización');
    return { success: false, message: 'WooCommerce no configurado' };
  }
  
  console.log(`🔑 WooCommerce configurado: ${currentWooConfig.url}`);
  
  try {
    // PASO 1: Verificar si el producto ya existe
    console.log(`🔍 Verificando si ${product.sku} existe en WooCommerce...`);
    
    const searchResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products?sku=${encodeURIComponent(product.sku)}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (!searchResponse.ok) {
      console.error(`Error buscando producto ${product.sku}:`, searchResponse.status);
      return { success: false, message: `Error de búsqueda: ${searchResponse.status}` };
    }
    
    const existingProducts = await searchResponse.json();
    console.log(`📋 Respuesta búsqueda para ${product.sku}:`, existingProducts);
    
    const productExists = existingProducts.length > 0;
    console.log(`📊 ¿Producto ${product.sku} existe?:`, productExists ? 'SÍ' : 'NO');
    
    if (productExists) {
      console.log(`🔍 Producto encontrado con ID: ${existingProducts[0].id}, nombre: "${existingProducts[0].name}"`);
    }
    
    if (productExists) {
      // PASO 2: ACTUALIZAR producto existente
      const existingProduct = existingProducts[0];
      console.log(`🔄 === ENTRANDO EN RAMA DE ACTUALIZACIÓN ===`);
      console.log(`📝 Producto ${product.sku} existe (ID: ${existingProduct.id}), actualizando...`);
      console.log(`🔄 Stock actual en WooCommerce: ${existingProduct.stock_quantity}, Stock local: ${product.stock}`);
      console.log(`🔄 Precio actual en WooCommerce: ${existingProduct.regular_price}, Precio local: ${product.price}`);
      
      // Procesar imágenes para WooCommerce (solo URLs válidas)
      const wooImages = [];
      if (product.imagenes && product.imagenes.length > 0) {
        for (let i = 0; i < product.imagenes.length; i++) {
          const img = product.imagenes[i];
          
          // Solo enviar imágenes que son URLs válidas (importadas desde WooCommerce)
          if (img.data && img.data.startsWith('http')) {
            wooImages.push({
              src: img.data, // URL de imagen
              name: img.name,
              alt: `${product.name} - Imagen ${i + 1}`
            });
          } else if (img.data && img.data.startsWith('data:image/')) {
            // Para imágenes Base64 (subidas localmente), mostrar advertencia
            console.warn(`⚠️ Imagen "${img.name}" es Base64 y no se puede enviar a WooCommerce. URL requerida.`);
          }
        }
      }

      const updateData = {
        name: product.name,
        regular_price: product.price.toString(),
        stock_quantity: product.stock,
        manage_stock: true,
        description: `Producto: ${product.name}\nSKU: ${product.sku}`,
        short_description: `${product.brand || ''} - ${product.category || ''}`,
        images: wooImages // Incluir imágenes en la actualización
      };
      
      console.log(`📤 Enviando PUT a: ${currentWooConfig.url}/wp-json/wc/v3/products/${existingProduct.id}`);
      console.log(`📤 Datos de actualización:`, updateData);
      
      const updateResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products/${existingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (updateResponse.ok) {
        console.log(`✅ Stock de ${product.sku} actualizado a ${product.stock} en WooCommerce`);
        
        // Información sobre imágenes enviadas
        let imageInfo = '';
        if (wooImages.length > 0) {
          imageInfo = ` + ${wooImages.length} imagen${wooImages.length !== 1 ? 'es' : ''}`;
        }
        
        return { 
          success: true, 
          message: `Stock actualizado: ${product.stock} unidades${imageInfo}`,
          action: 'updated'
        };
      } else {
        const errorText = await updateResponse.text();
        console.error(`Error actualizando ${product.sku}:`, errorText);
        
        // Analizar tipo de error
        if (errorText.includes('product_invalid_sku')) {
          return { 
            success: false, 
            message: `SKU duplicado: ${product.sku} ya existe`,
            action: 'duplicate_sku'
          };
        } else {
          return { 
            success: false, 
            message: `Error de actualización: ${errorText}`,
            action: 'update_error'
          };
        }
      }
    } else {
      // PASO 3: CREAR nuevo producto
      console.log(`🔄 === ENTRANDO EN RAMA DE CREACIÓN ===`);
      console.log(`🆕 Producto ${product.sku} no existe, creando...`);
      
      // Procesar imágenes para WooCommerce (solo URLs válidas)
      const wooImages = [];
      if (product.imagenes && product.imagenes.length > 0) {
        for (let i = 0; i < product.imagenes.length; i++) {
          const img = product.imagenes[i];
          
          // Solo enviar imágenes que son URLs válidas (importadas desde WooCommerce)
          if (img.data && img.data.startsWith('http')) {
            wooImages.push({
              src: img.data, // URL de imagen
              name: img.name,
              alt: `${product.name} - Imagen ${i + 1}`
            });
          } else if (img.data && img.data.startsWith('data:image/')) {
            // Para imágenes Base64 (subidas localmente), mostrar advertencia
            console.warn(`⚠️ Imagen "${img.name}" es Base64 y no se puede enviar a WooCommerce. URL requerida.`);
          }
        }
      }

      const productData = {
        name: product.name,
        regular_price: product.price.toString(),
        stock_quantity: product.stock,
        manage_stock: true,
        sku: product.sku,
        description: `Producto: ${product.name}\nSKU: ${product.sku}`,
        short_description: `${product.brand || ''} - ${product.category || ''}`,
        images: wooImages // Incluir imágenes en la exportación
      };
      
      console.log(`📤 Enviando POST a: ${currentWooConfig.url}/wp-json/wc/v3/products`);
      console.log(`📤 Datos de creación:`, productData);
      
      const createResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      });
      
      if (createResponse.ok) {
        console.log(`✅ Producto ${product.sku} creado en WooCommerce`);
        
        // Información sobre imágenes enviadas
        let imageInfo = '';
        if (wooImages.length > 0) {
          imageInfo = ` + ${wooImages.length} imagen${wooImages.length !== 1 ? 'es' : ''}`;
        }
        
        return { 
          success: true, 
          message: `Producto creado exitosamente${imageInfo}`,
          action: 'created'
        };
      } else {
        const errorText = await createResponse.text();
        console.error(`Error creando ${product.sku}:`, errorText);
        
        // ✅ HOTFIX: Intentar actualizar si hay error de SKU duplicado
        if (errorText.includes('woocommerce_rest_product_not_created') || 
            errorText.includes('already present in the lookup table')) {
          console.log(`🔄 SKU ${product.sku} ya existe, intentando actualizar...`);
          return await updateProductBySkuImproved(product);
        }
        
        // Analizar tipo de error
        if (errorText.includes('product_invalid_sku')) {
          return { 
            success: false, 
            message: `SKU duplicado: ${product.sku} ya existe`,
            action: 'duplicate_sku'
          };
        } else {
          return { 
            success: false, 
            message: `Error de creación: ${errorText}`,
            action: 'create_error'
          };
        }
      }
    }
  } catch (error) {
    console.error(`Error de red sincronizando ${product.sku}:`, error);
    return { 
      success: false, 
      message: `Error de red: ${error.message}`,
      action: 'network_error'
    };
  }
}

// Función para actualizar stock en WooCommerce usando SKU
async function updateWooStockSync(sku, newStock) {
  if (!currentWooConfig) {
    console.log('WooCommerce no configurado, saltando actualización de stock');
    return { success: false, message: 'WooCommerce no configurado' };
  }
  
  try {
    // Buscar producto en WooCommerce por SKU
    const searchResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}`, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (!searchResponse.ok) {
      console.error(`Error buscando producto ${sku} en WooCommerce:`, searchResponse.status);
      return { 
        success: false, 
        message: `Error de búsqueda: ${searchResponse.status}`,
        action: 'search_error'
      };
    }
    
    const products = await searchResponse.json();
    
    if (products.length === 0) {
      console.log(`Producto ${sku} no encontrado en WooCommerce, creando nuevo producto`);
      // Si el producto no existe, crear uno nuevo
      return await syncProductWithWoo({
        sku: sku,
        name: state.productos[sku]?.name || sku,
        price: state.productos[sku]?.price || 0,
        stock: newStock
      });
    }
    
    // Actualizar stock del producto encontrado
    const product = products[0];
    const updateResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products/${product.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stock_quantity: newStock,
        manage_stock: true
      })
    });
    
    if (updateResponse.ok) {
      console.log(`✅ Stock de ${sku} actualizado a ${newStock} en WooCommerce`);
      return { 
        success: true, 
        message: `Stock actualizado: ${newStock} unidades`,
        action: 'updated'
      };
    } else {
      const errorText = await updateResponse.text();
      console.error(`Error actualizando stock de ${sku}:`, errorText);
      
      // Analizar tipo de error
      if (errorText.includes('product_invalid_sku')) {
        return { 
          success: false, 
          message: `SKU duplicado: ${sku} ya existe`,
          action: 'duplicate_sku'
        };
      } else {
        return { 
          success: false, 
          message: `Error de actualización: ${errorText}`,
          action: 'update_error'
        };
      }
    }
  } catch (error) {
    console.error(`Error de red actualizando stock de ${sku}:`, error);
    return { 
      success: false, 
      message: `Error de red: ${error.message}`,
      action: 'network_error'
    };
  }
}

// ----------------------------------------------------
// PROVEEDORES
// ----------------------------------------------------

function saveSupplier(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('s-name').value.trim();
  if (!name) return;
  const web = document.getElementById('s-web').value.trim();
  const wp = document.getElementById('s-wp').value.trim();
  const email = document.getElementById('s-email').value.trim();
  const desc = document.getElementById('s-desc').value.trim();

  const existing = state.suppliers.find(s => s.name === name);
  const sup = { name, web, whatsapp: wp, email, desc };

  if (existing) Object.assign(existing, sup);
  else state.suppliers.push(sup);

  saveState();
  resetSupplierForm();
  renderSuppliers();
}

function resetSupplierForm() {
  document.getElementById('supplier-form').reset();
  renderSuppliers();
}

function editSupplier(name) {
  const s = state.suppliers.find(x => x.name === name);
  if (!s) return;
  navigate('proveedores');
  document.getElementById('s-name').value = s.name;
  document.getElementById('s-web').value = s.web || "";
  document.getElementById('s-wp').value = s.whatsapp || "";
  document.getElementById('s-email').value = s.email || "";
  document.getElementById('s-desc').value = s.desc || "";
}

function renderSuppliers() {
  const t = document.querySelector('#suppliers-table tbody');
  if (!t) return;
  t.innerHTML = '';
  
  console.log('👥 Renderizando proveedores:', state.suppliers.length, 'proveedores encontrados');
  
  state.suppliers.forEach(s => {
    const tr = document.createElement('tr');
    
    // Obtener lead time promedio del proveedor
    const leadTime = getLeadTimeProveedor(s.name);
    const leadTimeText = leadTime ? `${leadTime} días` : 'No disponible';
    const leadTimeColor = leadTime ? (leadTime <= 7 ? '#28a745' : leadTime <= 14 ? '#ffc107' : '#dc3545') : '#6c757d';
    
    // Validar que ordenesCompra es un array antes de filtrar
    const ordenesActivas = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).filter(o => 
      o.proveedor === s.name && (o.estado === 'Pendiente' || o.estado === 'En Tránsito')
    );
    const totalPendiente = ordenesActivas.reduce((sum, o) => sum + o.total, 0);
    
    // Generar iconos de WhatsApp y correo clickeables
    const whatsappIcon = s.whatsapp ? 
      `<button onclick="abrirWhatsApp('${s.whatsapp}', '${s.name}')" 
              style="background:#25D366; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px; margin-right:5px;">
        📱 WhatsApp
       </button>` : '<span style="color:#999; font-size:12px;">No disponible</span>';
    
    const emailIcon = s.email ? 
      `<button onclick="abrirCorreo('${s.email}', '${s.name}')" 
              style="background:#4285F4; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">
        📧 Email
       </button>` : '<span style="color:#999; font-size:12px;">No disponible</span>';
    
    // Información adicional del proveedor
    const proveedorInfo = `
      <div style="font-size:11px; margin-top:4px;">
        <div style="color:${leadTimeColor}; font-weight:600;">⏱️ Lead Time: ${leadTimeText}</div>
        ${ordenesActivas.length > 0 ? `<div style="color:#dc3545; font-weight:600;">💰 ARS ${totalPendiente.toFixed(2)} pendiente(s)</div>` : ''}
      </div>
    `;
    
    tr.innerHTML = `
      <td style="padding:8px">
        <strong>${s.name}</strong>
        ${proveedorInfo}
      </td>
      <td style="padding:8px">${s.web || '-'}</td>
      <td style="padding:8px">${s.whatsapp || '-'}</td>
      <td style="padding:8px">${s.email || '-'}</td>
      <td style="padding:8px;display:flex;gap:6px; flex-wrap:wrap;">
        ${whatsappIcon}
        ${emailIcon}
        ${ordenesActivas.length > 0 ? `<button onclick="navegarAOrdenesProveedor('${s.name}')" style="background:#17a2b8; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">📋 Ver Órdenes</button>` : ''}
        <button onclick="editSupplier('${s.name}')" style="background:#FFA500; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">✏️ Editar</button>
        <button onclick="deleteSupplier('${s.name}')" style="background:#ff4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">🗑️ Eliminar</button>
      </td>`;
    t.appendChild(tr);
  });
}

function deleteSupplier(name) {
  if (!confirm(`¿Eliminar proveedor "${name}"?`)) return;
  state.suppliers = state.suppliers.filter(s => s.name !== name);
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en deleteSupplier');
    return;
  }
  
  Object.values(state.productos).forEach(p => { if (p.supplier === name) p.supplier = ""; });
  saveState();
}

// Función para abrir WhatsApp
function abrirWhatsApp(numero, nombre) {
  if (!numero) {
    alert('No hay número de WhatsApp registrado para este proveedor');
    return;
  }
  
  // Limpiar el número (quitar espacios, guiones, etc.)
  let numeroLimpio = numero.replace(/[^\d]/g, '');
  
  // Agregar código de país si no lo tiene (ejemplo: 54 para Argentina)
  if (!numeroLimpio.startsWith('54') && !numeroLimpio.startsWith('1') && !numeroLimpio.startsWith('52')) {
    numeroLimpio = '54' + numeroLimpio; // Asumiendo Argentina
  }
  
  const mensaje = `Hola ${nombre || 'proveedor'}, me contacto desde el sistema de inventario.`;
  const urlWhatsApp = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
  
  window.open(urlWhatsApp, '_blank');
  console.log('📱 Abriendo WhatsApp con proveedor:', nombre, 'Número:', numeroLimpio);
}

// Función para abrir correo electrónico
function abrirCorreo(email, nombre) {
  if (!email) {
    alert('No hay correo electrónico registrado para este proveedor');
    return;
  }
  
  const asunto = `Consulta desde Sistema de Inventario`;
  const cuerpo = `Estimado/a ${nombre || 'proveedor'},\n\nMe dirijo a usted desde nuestro sistema de inventario para realizar una consulta.\n\nQuedo atento a su respuesta.\n\nSaludos cordiales.`;
  
  const urlCorreo = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  
  window.open(urlCorreo);
  console.log('📧 Abriendo correo con proveedor:', nombre, 'Email:', email);
}

// ----------------------------------------------------
// VENTAS
// ----------------------------------------------------
function registerSale(e) {
  if (e) e.preventDefault();
  const qName = document.getElementById("sale-product").value.trim();
  if (!qName) return alert("Seleccione producto");

  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de buscar producto
  if (!validarState()) {
    console.error('❌ No se pudo validar state en registerSale');
    return alert("Error interno: state no válido");
  }

  const prod = Object.values(state.productos).find(p => p.sku === qName || p.name === qName);
  if (!prod) return alert("Producto no encontrado en inventario");

  const price = parseFloat(document.getElementById("sale-price").value) || 0;
  const qty = parseInt(document.getElementById("sale-qty").value) || 1;
  if (prod.stock < qty) return alert("Stock insuficiente");

  const method = document.getElementById("sale-method").value;
  
  // Los datos del producto se limpiarán más abajo antes del cálculo
  
  console.log('🛒 Iniciando registro de venta...');
  console.log('📦 Producto encontrado:', prod);

  // Validar y limpiar datos del producto
  const cleanedProduct = {
    ...prod,
    cost: parseFloat(prod.cost) || 0,
    ship: parseFloat(prod.ship) || 0,
    commission: parseFloat(prod.commission) || 0,
    price: parseFloat(prod.price) || 0,
    stock: parseInt(prod.stock) || 0
  };
  
  console.log('🧹 Producto limpiado:', cleanedProduct);
  
  // Usar datos limpios del producto para el cálculo
  const cost = cleanedProduct.cost;
  const ship = cleanedProduct.ship;
  const commission = cleanedProduct.commission;
  
  console.log('💰 Calculando profit con datos limpios:');
  console.log('  📊 Precio venta:', price);
  console.log('  💸 Cost producto:', cost);
  console.log('  🚚 Shipping:', ship);
  console.log('  🏢 Commission:', commission + '%');
  
  const commissionAmt = price * (commission / 100);
  const profitPerUnit = price - (cost + ship + commissionAmt);
  const profit = profitPerUnit * qty;
  
  // Asegurar que el profit sea un número válido (no NaN)
  const validProfit = isNaN(profit) ? 0 : profit;
  
  console.log('📈 Profit calculado:', validProfit);
  
  if (isNaN(profit)) {
    console.warn('⚠️ Profit es NaN, usando 0 como valor por defecto');
  }

  const sale = {
    date: new Date().toISOString(),
    sku: prod.sku,
    name: prod.name,
    qty,
    price,
    method,
    profit: validProfit,
    cliente: document.getElementById("cliente-nombre").value.trim() || "Consumidor Final"
  };

  console.log('🛒 Venta creada:', sale);

  state.sales.push(sale);
  console.log('✅ Venta agregada al estado:', state.sales.length, 'ventas totales');

  // Actualizar stock en inventario (usar el producto original que está en el state)
  const stockAnterior = state.productos[prod.sku].stock;
  state.productos[prod.sku].stock -= qty;
  console.log(`📉 Stock descontado: ${stockAnterior} → ${state.productos[prod.sku].stock} (-${qty})`);

  // CRÍTICO: Guardar inmediatamente en Firebase y localStorage
  try {
    console.log('💾 Guardando venta en Firebase...');
    saveState(); // ENVÍA A FIREBASE
    console.log('✅ Venta guardada exitosamente en la nube');
  } catch (error) {
    console.error('❌ Error guardando venta en Firebase:', error);
    // Guardar localmente como respaldo
    localStorage.setItem('app_state', JSON.stringify(state));
    localStorage.setItem('backup_timestamp', Date.now().toString());
    console.warn('⚠️ Venta guardada localmente como respaldo');
  }

  // Actualizar estado de pedido si es necesario
  const currentProduct = state.productos[prod.sku];
  if (currentProduct.stock <= 3 && !currentProduct.omitidoPedidos) {
    currentProduct.pedidoEstado = "Pedir stock";
    console.log('⚠️ Stock bajo, marcar para pedido:', prod.sku);
  }

  // Gestionar envío si aplica
  const conEnvio = document.getElementById('con-envio') && document.getElementById('con-envio').checked;
  if (conEnvio) {
    const envio = {
      id: 'envio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      cliente: document.getElementById('envio-nombre').value.trim(),
      telefono: document.getElementById('envio-tel').value.trim(),
      direccion: document.getElementById('envio-dir').value.trim(),
      ciudad: document.getElementById('envio-ciudad').value.trim(),
      comentarios: document.getElementById('envio-coment').value.trim(),
      producto: prod.name,
      fecha_venta: new Date().toISOString(),
      estado: 'Pendiente',
      fecha_creacion: new Date().toISOString()
    };
    state.envios.push(envio);
    
    // Asociar envío con la venta
    sale.shipping_ref = envio.id;
    sale.shipping_date = new Date().toISOString();
    
    console.log('🚚 Envío registrado y asociado:', envio);
    console.log('📦 Total envíos en estado:', state.envios.length);
    
    // Sincronizar tickets para incluir información de envío
    setTimeout(() => {
      syncTicketsAfterLoad();
    }, 1000);
  }

  // Guardar en Firebase con logs detallados
  console.log('💾 Guardando en Firebase...');
  try {
    if (!db) {
      console.warn('⚠️ Firebase no inicializado, guardando localmente');
      // Forzar guardado local
      localStorage.setItem('app_state', JSON.stringify(state));
      localStorage.setItem('backup_timestamp', Date.now().toString());
    } else {
      saveState();
      // Sincronizar cambio de stock con WooCommerce
      updateWooStockSync(prod.sku, prod.stock).then(result => {
        if (result.success) {
          console.log(`✅ ${result.message} (${prod.sku})`);
        } else {
          console.warn(`⚠️ Error actualizando stock de ${prod.sku}: ${result.message}`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error guardando:', error);
    // Guardar localmente como respaldo
    localStorage.setItem('app_state', JSON.stringify(state));
    localStorage.setItem('backup_timestamp', Date.now().toString());
  }

  // Actualizar interfaz inmediatamente
  clearSaleForm();
  renderSalesLog();
  renderDashboard();
  renderPedidos();
  renderProducts();
  
  // 🔄 Actualizar kardex automáticamente
  actualizarKardexAutomatico();
  
  console.log('🎉 Venta registrada exitosamente');
  console.log('📊 Estado actual - Ventas:', state.sales.length, 'Productos:', Object.keys(state.productos).length, 'Tickets:', state.tickets.length);
  
  // SEGUNDO: generar ticket de forma asíncrona y guardar en Firebase
  setTimeout(() => {
    try {
      console.log('🎫 Generando ticket automático para venta con envío...');
      console.log('  📦 Sale shipping_ref:', sale.shipping_ref || 'Ninguno');
      
      // Obtener información de envío si existe
      let shippingInfo = null;
      if (sale.shipping_ref) {
        const envio = state.envios.find(e => e.id === sale.shipping_ref);
        if (envio) {
          shippingInfo = {
            cliente: envio.cliente,
            telefono: envio.telefono,
            direccion: envio.direccion,
            ciudad: envio.ciudad,
            comentarios: envio.comentarios,
            estado: envio.estado
          };
          console.log('  📤 Información de envío encontrada:', shippingInfo);
        } else {
          console.log('  ❌ Envío no encontrado para shipping_ref:', sale.shipping_ref);
        }
      }

      const ticketData = {
        fecha: sale.date,
        cliente: sale.cliente,
        producto: sale.name,
        sku: sale.sku,
        cantidad: sale.qty,
        precio: sale.price,
        total: sale.price * sale.qty,
        shipping: shippingInfo,
        ticketId: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      };

      console.log('🎫 Ticket creado con datos:', {
        ticketId: ticketData.ticketId,
        tieneShipping: !!ticketData.shipping,
        shippingData: ticketData.shipping
      });

      // Agregar ticket al estado global
      state.tickets.push(ticketData);
      console.log('🎫 Ticket agregado al estado:', ticketData.ticketId);

      // Guardar ticket en localStorage como respaldo adicional
      let savedTickets = JSON.parse(localStorage.getItem('savedTickets') || '[]');
      savedTickets.push(ticketData);
      localStorage.setItem('savedTickets', JSON.stringify(savedTickets));
      
      // CRÍTICO: Guardar ticket en Firebase inmediatamente
      try {
        console.log('💾 Guardando ticket en Firebase...');
        saveState(); // Guarda TODO el estado incluyendo tickets en Firebase
        console.log('✅ Ticket guardado exitosamente en la nube Firebase');
      } catch (firebaseError) {
        console.error('❌ Error guardando ticket en Firebase:', firebaseError);
        console.warn('⚠️ Ticket guardado localmente como respaldo');
      }
      
      console.log('🎫 Ticket automático generado y sincronizado:', sale.sku);
    } catch (error) {
      console.warn('⚠️ Error generando ticket:', error);
    }
  }, 100);
  
  // Confirmar venta y ticket
  alert(`✅ Venta registrada exitosamente!\n\n🧾 El ticket se guardará automáticamente en Firebase\n☁️ Sincronizado con la nube automáticamente`);
}

function fillSalePrice() {
  const q = document.getElementById('sale-product').value.trim();
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de buscar producto
  if (!validarState()) {
    console.error('❌ No se pudo validar state en fillSalePrice');
    return;
  }
  
  const prod = Object.values(state.productos).find(p => p.sku === q || p.name === q);
  if (prod) { document.getElementById('sale-price').value = prod.price; }
}

function clearSaleForm() { document.querySelector('form[onsubmit="registerSale(event)"]').reset(); }

function renderDatalist() {
  const d = document.getElementById('products-datalist');
  if (!d) return;
  d.innerHTML = '';
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en renderDatalist');
    return;
  }
  
  Object.values(state.productos).forEach(p => {
    const o = document.createElement('option'); 
    o.value = p.sku; 
    o.innerText = p.name + ' — ' + p.sku; 
    d.appendChild(o);
    const o2 = document.createElement('option'); 
    o2.value = p.name; 
    d.appendChild(o2);
  });
}

// ----------------------------------------------------
// DASHBOARD
// ----------------------------------------------------
let salesChart;

function renderDashboard() {
  document.getElementById('summary-sales').innerText = state.sales.length;
  const totalProfit = state.sales.reduce((s, x) => s + (x.profit || 0), 0);
  document.getElementById('summary-profit').innerText = 'ARS ' + totalProfit.toFixed(2);
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de calcular stock
  if (!validarState()) {
    console.error('❌ No se pudo validar state en renderDashboard');
    document.getElementById('summary-stock').innerText = '0';
    return;
  }
  
  const totalStock = Object.values(state.productos).reduce((s, p) => s + (p.stock || 0), 0);
  document.getElementById('summary-stock').innerText = totalStock;

  // top products
  const top = {}; 
  state.sales.forEach(s => { top[s.name] = (top[s.name] || 0) + s.qty; });
  const topArr = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const ul = document.getElementById('top-products'); 
  ul.innerHTML = '';
  topArr.forEach(t => { 
    const li = document.createElement('li'); 
    li.innerText = `${t[0]} — ${t[1]} unidades`; 
    ul.appendChild(li); 
  });

  // chart
  const byDate = {};
  const now = new Date();
  for (let i = 13; i >= 0; i--) { 
    const d = new Date(now); 
    d.setDate(now.getDate() - i); 
    const key = d.toISOString().slice(0, 10); 
    byDate[key] = 0; 
  }
  state.sales.forEach(s => { 
    const dateKey = s.date.slice(0, 10); 
    if (byDate[dateKey] !== undefined) byDate[dateKey] += s.qty; 
  });
  const labels = Object.keys(byDate); 
  const values = Object.values(byDate);

  const ctx = document.getElementById('salesChart');
  if (ctx) {
    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, { 
      type: 'bar', 
      data: { 
        labels, 
        datasets: [{ 
          label: 'Ventas (unidades)', 
          data: values 
        }] 
      }, 
      options: { 
        responsive: true, 
        plugins: { 
          legend: { display: false } 
        } 
      } 
    });
  }

  // ✅ NUEVO: Análisis de rendimiento de proveedores
  renderProveedoresPerformanceChart();
}

// ✅ NUEVA FUNCIÓN: Análisis de rendimiento de proveedores
function renderProveedoresPerformanceChart() {
  // Validar que existan órdenes de compra
  const ordenes = state.ordenesCompra || [];
  const ordenesEntregadas = ordenes.filter(o => o.estado === 'Entregado' && o.diasEntrega);
  
  if (ordenesEntregadas.length === 0) {
    // Si no hay datos, mostrar valores por defecto
    document.getElementById('tiempo-promedio-entrega').innerText = '-';
    document.getElementById('mejor-proveedor').innerText = '-';
    document.getElementById('peor-proveedor').innerText = '-';
    
    // Destruir gráfico si existe y es válido
    if (window.proveedoresChart && typeof window.proveedoresChart.destroy === 'function') {
      window.proveedoresChart.destroy();
    }
    return;
  }

  // Calcular métricas por proveedor
  const rendimientoPorProveedor = {};
  
  ordenesEntregadas.forEach(orden => {
    const proveedor = orden.proveedor;
    if (!rendimientoPorProveedor[proveedor]) {
      rendimientoPorProveedor[proveedor] = {
        totalDias: 0,
        cantidadOrdenes: 0,
        tiempos: []
      };
    }
    rendimientoPorProveedor[proveedor].totalDias += orden.diasEntrega;
    rendimientoPorProveedor[proveedor].cantidadOrdenes += 1;
    rendimientoPorProveedor[proveedor].tiempos.push(orden.diasEntrega);
  });

  // Calcular promedios
  Object.keys(rendimientoPorProveedor).forEach(proveedor => {
    const data = rendimientoPorProveedor[proveedor];
    data.promedio = Math.round(data.totalDias / data.cantidadOrdenes);
  });

  // Encontrar mejor y peor proveedor
  const proveedoresOrdenados = Object.entries(rendimientoPorProveedor)
    .sort((a, b) => a[1].promedio - b[1].promedio);
  
  const mejorProveedor = proveedoresOrdenados[0];
  const peorProveedor = proveedoresOrdenados[proveedoresOrdenados.length - 1];

  // Actualizar métricas en la interfaz
  const tiempoPromedioGeneral = Math.round(
    ordenesEntregadas.reduce((sum, o) => sum + o.diasEntrega, 0) / ordenesEntregadas.length
  );
  
  document.getElementById('tiempo-promedio-entrega').innerText = tiempoPromedioGeneral;
  document.getElementById('mejor-proveedor').innerText = mejorProveedor ? `${mejorProveedor[0]} (${mejorProveedor[1].promedio}d)` : '-';
  document.getElementById('peor-proveedor').innerText = peorProveedor ? `${peorProveedor[0]} (${peorProveedor[1].promedio}d)` : '-';

  // Crear datos para el gráfico
  const labels = Object.keys(rendimientoPorProveedor);
  const promedios = labels.map(proveedor => rendimientoPorProveedor[proveedor].promedio);
  const cantidades = labels.map(proveedor => rendimientoPorProveedor[proveedor].cantidadOrdenes);

  // Configurar colores (verde para bueno, rojo para malo)
  const colors = promedios.map(promedio => {
    if (promedio <= 7) return '#28a745'; // Verde: <= 7 días (excelente)
    if (promedio <= 14) return '#ffc107'; // Amarillo: 8-14 días (bueno)
    return '#dc3545'; // Rojo: > 14 días (mejorar)
  });

  // Crear o actualizar el gráfico con EXACTAMENTE el mismo estilo que salesChart
  const ctx = document.getElementById('proveedoresChart');
  if (ctx) {
    if (window.proveedoresChart && typeof window.proveedoresChart.destroy === 'function') {
      window.proveedoresChart.destroy();
    }
    
    window.proveedoresChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tiempo promedio de entrega (días)',
          data: promedios,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

function renderSalesLog() {
  const t = document.querySelector('#sales-log tbody');
  if (!t) return;
  t.innerHTML = '';
  state.sales.slice(-10).reverse().forEach((s, index) => {
    const tr = document.createElement('tr');
    const origin = s.source === 'woocommerce' ? '🛒 WooCommerce' : '📱 Manual';
    const originColor = s.source === 'woocommerce' ? '#28a745' : '#6c757d';
    
    // Buscar si existe un envío asociado a esta venta
    const saleIndex = state.sales.length - 1 - index; // Índice real en el array original
    const hasShipping = hasShippingForSale(saleIndex);
    const shippingIcon = hasShipping ? '🚚' : '';
    const shippingStatus = hasShipping ? getShippingStatus(saleIndex) : '';
    
    tr.innerHTML = `
      <td style="padding:8px">${new Date(s.date).toLocaleDateString()}</td>
      <td style="padding:8px">${s.name}</td>
      <td style="padding:8px">${s.qty}</td>
      <td style="padding:8px">ARS ${(s.price * s.qty).toFixed(2)}</td>
      <td style="padding:8px">
        ${hasShipping ? 
          `<span style="background:#17a2b8;color:white;padding:2px 6px;border-radius:4px;font-size:12px">${shippingIcon} ${shippingStatus}</span>` :
          `<button onclick="addShippingFromSale(${saleIndex})" style="background:#6c757d;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:12px;cursor:pointer">+ Envío</button>`
        }
      </td>
      <td style="padding:8px"><span style="background:${originColor};color:white;padding:2px 6px;border-radius:4px;font-size:12px">${origin}</span></td>`;
    t.appendChild(tr);
  });
}

// Función para verificar si una venta tiene envío asociado
function hasShippingForSale(saleIndex) {
  const sale = state.sales[saleIndex];
  if (!sale || !sale.shipping_ref) return false;
  
  // Buscar el envío por referencia
  return state.envios.some(envio => envio.id === sale.shipping_ref);
}

// Función para obtener el estado del envío asociado
function getShippingStatus(saleIndex) {
  const sale = state.sales[saleIndex];
  if (!sale || !sale.shipping_ref) return '';
  
  const envio = state.envios.find(e => e.id === sale.shipping_ref);
  return envio ? (envio.estado === 'Pendiente' ? 'Pendiente' : 'Enviado') : '';
}

// Función para agregar envío desde una venta existente
function addShippingFromSale(saleIndex) {
  const sale = state.sales[saleIndex];
  if (!sale) return;
  
  // Crear formulario modal para datos del envío
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center">
      <div style="background:white;padding:30px;border-radius:15px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto">
        <h3>🚚 Agregar Envío para Venta</h3>
        <div style="margin:15px 0;padding:10px;background:#f8f9fa;border-radius:8px">
          <strong>Venta:</strong> ${sale.name} x${sale.qty} - ARS ${(sale.price * sale.qty).toFixed(2)}<br>
          <strong>Cliente:</strong> ${sale.cliente}
        </div>
        <form id="shipping-form">
          <div style="margin-bottom:15px">
            <label style="display:block;margin-bottom:5px;font-weight:bold">Nombre del Cliente</label>
            <input id="shipping-cliente" value="${sale.cliente}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px">
          </div>
          <div style="margin-bottom:15px">
            <label style="display:block;margin-bottom:5px;font-weight:bold">Teléfono</label>
            <input id="shipping-telefono" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px">
          </div>
          <div style="margin-bottom:15px">
            <label style="display:block;margin-bottom:5px;font-weight:bold">Dirección</label>
            <input id="shipping-direccion" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px">
          </div>
          <div style="margin-bottom:15px">
            <label style="display:block;margin-bottom:5px;font-weight:bold">Ciudad</label>
            <input id="shipping-ciudad" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px">
          </div>
          <div style="margin-bottom:15px">
            <label style="display:block;margin-bottom:5px;font-weight:bold">Comentarios</label>
            <textarea id="shipping-comentarios" rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;resize:vertical"></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
            <button type="button" onclick="this.closest('.modal').remove()" style="padding:10px 20px;border:1px solid #ddd;border-radius:6px;cursor:pointer">Cancelar</button>
            <button type="submit" style="padding:10px 20px;background:#17a2b8;color:white;border:none;border-radius:6px;cursor:pointer">🚚 Registrar Envío</button>
          </div>
        </form>
      </div>
    </div>
  `;
  modal.className = 'modal';
  document.body.appendChild(modal);

  // Cerrar modal al hacer clic fuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Cerrar modal con tecla ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  // Manejar envío del formulario
  document.getElementById('shipping-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const cliente = document.getElementById('shipping-cliente').value.trim();
    const telefono = document.getElementById('shipping-telefono').value.trim();
    const direccion = document.getElementById('shipping-direccion').value.trim();
    const ciudad = document.getElementById('shipping-ciudad').value.trim();
    const comentarios = document.getElementById('shipping-comentarios').value.trim();
    
    if (!cliente || !telefono || !direccion) {
      alert('Por favor complete los campos requeridos');
      return;
    }
    
    // Crear objeto de envío
    const envio = {
      id: 'envio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      cliente: cliente,
      telefono: telefono,
      direccion: direccion,
      ciudad: ciudad,
      comentarios: comentarios,
      producto: sale.name,
      fecha_venta: sale.date,
      estado: 'Pendiente',
      fecha_creacion: new Date().toISOString()
    };
    
    // Agregar envío al estado
    state.envios.push(envio);
    
    // Asociar envío con la venta
    state.sales[saleIndex].shipping_ref = envio.id;
    state.sales[saleIndex].shipping_date = new Date().toISOString();
    
    // Guardar en Firebase
    try {
      saveState();
      console.log('✅ Envío agregado y asociado a la venta');
      
      // Sincronizar tickets para incluir información de envío
      setTimeout(() => {
        syncTicketsAfterLoad();
      }, 1000);
    } catch (error) {
      console.error('❌ Error guardando envío:', error);
    }
    
    // Actualizar interfaz
    refreshUI();
    
    // Cerrar modal
    modal.remove();
    
    alert('✅ Envío registrado exitosamente');
  });
}

function eliminarVentas() {
  if (!confirm('¿Eliminar todo el historial de ventas?')) return;
  state.sales = [];
  saveState();
  renderSalesLog();
  renderDashboard();
}

function limpiarDashboard() {
  if (!confirm('¿Limpiar todo el dashboard?')) return;
  state.sales = [];
  state.envios = [];
  saveState();
  renderSalesLog();
  renderDashboard();
  renderEnvios();
}

// ----------------------------------------------------
// PEDIDOS
// ----------------------------------------------------
function renderPedidos() {
  const tbody = document.querySelector('#tabla-pedidos tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const q = (document.getElementById('buscar-pedido')?.value || '').trim().toLowerCase();

  // Validar state antes de proceder
  if (!validarState()) {
    console.error('❌ No se pueden renderizar pedidos: state inválido');
    return;
  }

  // Validar que state.productos existe y es un objeto
  if (!state.productos || typeof state.productos !== 'object') {
    console.warn('⚠️ No se pueden renderizar pedidos: state.productos no está inicializado');
    return;
  }

  const lowStockProducts = Object.values(state.productos).filter(p => {
    // Validar que el producto existe y tiene las propiedades necesarias
    if (!p || typeof p !== 'object') return false;
    const stock = p.stock || 0;
    return (stock <= 3 || p.pedidoEstado);
  });
  
  const filtered = lowStockProducts.filter(p => {
    if (!q) return true;
    return (p.name && p.name.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  filtered.forEach(p => {
    if (!p.pedidoEstado) p.pedidoEstado = "Pedir stock";
    let icon = "";
    if (p.pedidoEstado === "Pedir stock") icon = "🔴";
    else if (p.pedidoEstado === "Pedido realizado") icon = "🟡";
    else if (p.pedidoEstado === "Completado") icon = "🟢";

    // ✅ NUEVO: Verificar si el producto ya tiene órdenes activas
    const tieneOrdenesActivas = p.ordenesCompra && p.ordenesCompra.some(oc => 
      oc.estado === 'Pendiente' || oc.estado === 'En Tránsito'
    );

    const tr = document.createElement("tr");
    
    // ✅ NUEVO: Determinar el contenido de la columna de acción
    let accionHTML = '';
    if (tieneOrdenesActivas) {
      // Producto ya agregado a una orden activa
      accionHTML = `
        <span style="color:#28a745;font-weight:600;padding:4px 8px;background:#d4edda;border-radius:4px;font-size:12px;">
          ✅ Agregado a la orden
        </span>`;
    } else {
      // Producto disponible para agregar a orden
      accionHTML = `
        <button onclick="agregarProductoAPedido('${p.sku}')" 
                style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">
          📦 Agregar a orden
        </button>`;
    }

    tr.innerHTML = `
      <td style="padding:8px">${p.sku}</td>
      <td style="padding:8px">${p.name}</td>
      <td style="padding:8px">${p.stock}</td>
      <td style="padding:8px">${p.supplier || '-'}</td>
      <td style="padding:8px;font-weight:600">${icon} ${p.pedidoEstado}</td>
      <td style="padding:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${accionHTML}
        <button onclick="togglePedido('${p.sku}')" 
                style="background:#6c757d;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;">
          Cambiar
        </button>
        <button style="background:#ffdede;color:#000;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;font-size:11px" 
                onclick="eliminarPedido('${p.sku}')">X</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function togglePedido(sku) {
  const p = state.productos[sku]; 
  if (!p) return;
  const estados = ["Pedir stock", "Pedido realizado", "Completado"];
  const idx = Math.max(0, estados.indexOf(p.pedidoEstado));
  p.pedidoEstado = estados[(idx + 1) % estados.length];
  saveState();
}

function eliminarPedido(sku) {
  const p = state.productos[sku]; 
  if (!p) return;
  if (!confirm(`¿Eliminar pedido de "${p.name}"?`)) return;
  delete p.pedidoEstado;
  p.omitidoPedidos = true;
  saveState();
}

function buscarPedido(q) { renderPedidos(); }

// ✅ NUEVA FUNCIÓN: Agregar producto a pedido desde la tabla de pedidos
function agregarProductoAPedido(sku) {
  console.log(`📦 Agregando producto ${sku} a pedido`);
  
  const producto = state.productos[sku];
  if (!producto) {
    alert('❌ Producto no encontrado');
    return;
  }

  // ✅ Verificar si ya tiene órdenes activas
  if (producto.ordenesCompra && producto.ordenesCompra.some(oc => 
    oc.estado === 'Pendiente' || oc.estado === 'En Tránsito'
  )) {
    alert('⚠️ Este producto ya tiene una orden activa');
    return;
  }

  // Solicitar información al usuario
  const cantidadStr = prompt(`📦 AGREGAR PRODUCTO A ORDEN DE COMPRA

📋 Producto: ${producto.name} (${producto.sku})
📊 Stock actual: ${producto.stock}
🏢 Proveedor: ${producto.supplier || 'No especificado'}

Ingresa la cantidad a solicitar:`, Math.max(1, (producto.stock || 0) * 2));
  
  if (cantidadStr === null) return; // Usuario canceló
  
  const cantidad = parseInt(cantidadStr);
  if (!cantidad || cantidad <= 0) {
    alert('❌ Cantidad inválida');
    return;
  }

  const precioStr = prompt(`💰 PRECIO UNITARIO

Producto: ${producto.name}
Cantidad: ${cantidad}

Ingresa el precio unitario (ARS):`, producto.precio || 0);
  
  if (precioStr === null) return; // Usuario canceló
  
  const precioUnitario = parseFloat(precioStr);
  if (!precioUnitario || precioUnitario <= 0) {
    alert('❌ Precio inválido');
    return;
  }

  // Crear la orden
  const nuevaOrden = {
    id: Date.now(),
    fechaCreacion: new Date().toISOString(),
    fechaEntregaEstimada: '',
    proveedor: producto.supplier || 'Proveedor no especificado',
    estado: 'Pendiente',
    productos: [{
      sku: producto.sku,
      nombre: producto.name,
      cantidad: cantidad,
      precioUnitario: precioUnitario,
      subtotal: cantidad * precioUnitario
    }],
    total: cantidad * precioUnitario,
    observaciones: ''
  };

  // ✅ Validar state antes de proceder
  if (!validarState()) {
    console.error('❌ No se puede crear orden: state inválido');
    return;
  }

  // Asegurar que ordenesCompra es un array
  if (!Array.isArray(state.ordenesCompra)) {
    state.ordenesCompra = [];
  }

  // Agregar orden
  state.ordenesCompra.push(nuevaOrden);

  // Actualizar producto con referencia a la orden
  if (!producto.ordenesCompra) {
    producto.ordenesCompra = [];
  }
  producto.ordenesCompra.push({
    ordenId: nuevaOrden.id,
    fechaCreacion: nuevaOrden.fechaCreacion,
    cantidad: cantidad,
    estado: nuevaOrden.estado
  });

  // Actualizar estado del pedido
  producto.pedidoEstado = 'Pedido realizado';

  // Guardar cambios
  saveState();

  // Refrescar tabla
  renderPedidos();

  // Mostrar confirmación
  alert(`✅ Producto agregado a orden de compra

📋 Orden ID: ${nuevaOrden.id}
📦 Producto: ${producto.name}
📊 Cantidad: ${cantidad}
💰 Total: ARS ${nuevaOrden.total.toFixed(2)}`);

  console.log(`✅ Producto ${sku} agregado a orden ${nuevaOrden.id}`);
}

// ----------------------------------------------------
// ENVÍOS
// ----------------------------------------------------
function toggleEnvioForm(show) { 
  const form = document.getElementById('envio-form');
  if (form) form.style.display = show ? 'block' : 'none'; 
}

function renderEnvios() {
  const tbody = document.querySelector('#tabla-envios tbody');
  if (!tbody) return;
  
  console.log('🚚 Renderizando envíos desde Firebase:', (state.envios || []).length, 'envíos encontrados');
  
  tbody.innerHTML = '';
  const q = (document.getElementById('buscar-envio')?.value || '').trim().toLowerCase();
  const list = state.envios.filter(e => !q || (e.cliente && e.cliente.toLowerCase().includes(q)));

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted)">Sin envíos registrados</td></tr>`;
    return;
  }

  list.forEach((e, idx) => {
    const icon = e.estado === 'Pendiente' ? '🔴' : '🟢';
    const isFromSale = e.fecha_venta || e.fecha_creacion;
    const originText = e.fecha_venta ? '💰 Desde venta' : '✋ Manual';
    const originColor = e.fecha_venta ? '#28a745' : '#6c757d';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.cliente || '-'}</td>
      <td>${e.producto || '-'}</td>
      <td>${e.direccion || '-'}</td>
      <td>${e.telefono || '-'}</td>
      <td>
        <div style="font-weight:600">${icon} ${e.estado}</div>
        <div><span style="background:${originColor};color:white;padding:2px 6px;border-radius:4px;font-size:11px">${originText}</span></div>
      </td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="toggleEstadoEnvio(${idx})">Cambiar</button>
        <button style="background:#ffdede;color:#000;padding:6px 8px;border-radius:6px" onclick="eliminarEnvio(${idx})">X</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function toggleEstadoEnvio(idx) {
  const envio = state.envios[idx]; 
  if (!envio) return;
  envio.estado = envio.estado === 'Pendiente' ? 'Realizado' : 'Pendiente';
  saveState();
}

function eliminarEnvio(idx) {
  const envio = state.envios[idx]; 
  if (!envio) return;
  if (!confirm(`¿Eliminar envío de "${envio.cliente}"?`)) return;

  // Eliminar referencia del envío en la venta correspondiente
  if (envio.id) {
    const saleIndex = state.sales.findIndex(sale => sale.shipping_ref === envio.id);
    if (saleIndex !== -1) {
      delete state.sales[saleIndex].shipping_ref;
      delete state.sales[saleIndex].shipping_date;
      console.log('🗑️ Referencia de envío eliminada de la venta');
    }
  }

  // Eliminar el envío
  state.envios.splice(idx, 1);
  
  // Guardar cambios
  saveState();
  
  // Actualizar interfaz
  refreshUI();
}

function limpiarEnvios() {
  if (!confirm('¿Seguro que quieres eliminar todos los envíos?')) return;
  state.envios = [];
  saveState();
}

function buscarEnvio() { renderEnvios(); }

function mostrarNotificacionPendientes() {
  if (!("Notification" in window)) return;
  const pendientes = state.envios?.filter(e => e.estado === "Pendiente") || [];
  if (pendientes.length === 0) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(perm => { if (perm === "granted") mostrarNotificacionPendientes(); });
    return;
  }
  if (Notification.permission === "granted") {
    new Notification("🚚 Envíos pendientes", { body: `${pendientes.length} envíos sin entregar.` });
  }
}

// ----------------------------------------------------
// UTILS
// ----------------------------------------------------
function globalSearch(q) { 
  currentPage = 1; 
  renderProducts(); 
}

function populateCategoryFilter() { 
  const sel = document.getElementById('category-filter'); 
  if (!sel) return;
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de obtener categorías
  if (!validarState()) {
    console.error('❌ No se pudo validar state en populateCategoryFilter');
    return;
  }
  
  const cats = Array.from(new Set(Object.values(state.productos).map(p => p.category))).filter(Boolean); 
  sel.innerHTML = '<option value="">Todas las categorias</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join(''); 
}

function populateSupplierSelect() {
  const sel = document.getElementById('p-supplier');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar proveedor</option>';
  state.suppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
}

function exportData() { 
  const data = JSON.stringify(state, null, 2); 
  const blob = new Blob([data], { type: 'application/json' }); 
  const a = document.createElement('a'); 
  a.href = URL.createObjectURL(blob); 
  a.download = 'inventario_backup.json'; 
  a.click();
}

// ----------------------------------------------------
// RECIBO X
// ----------------------------------------------------
function generarReciboX() {
  const prodCode = document.getElementById("sale-product").value;
  if (!prodCode) return alert("Selecciona un producto");

  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de buscar producto
  if (!validarState()) {
    console.error('❌ No se pudo validar state en generarReciboX');
    return alert("Error interno: state no válido");
  }

  const prod = Object.values(state.productos).find(p => p.sku === prodCode || p.name === prodCode);

  if (!prod) return alert("Selecciona un producto válido.");

  const qty = parseInt(document.getElementById("sale-qty").value) || 1;
  const price = parseFloat(document.getElementById("sale-price").value) || prod.price;
  const total = price * qty;

  const fecha = new Date().toISOString();
  const cliente = document.getElementById("cliente-nombre").value.trim() || "Consumidor Final";

  // Buscar venta correspondiente para obtener información de envío
  const saleIndex = state.sales.findIndex(sale => 
    sale.cliente === cliente && 
    sale.name === prod.name && 
    sale.sku === prod.sku
  );
  
  let shippingSection = '';
  if (saleIndex !== -1) {
    const sale = state.sales[saleIndex];
    if (sale.shipping_ref) {
      const envio = state.envios.find(e => e.id === sale.shipping_ref);
      if (envio) {
        shippingSection = `
🛍️ ENVÍO:
Destinatario: ${envio.cliente}
Teléfono: ${envio.telefono}
Dirección: ${envio.direccion}
Ciudad: ${envio.ciudad}
Estado: ${envio.estado}
${envio.comentarios ? `Comentarios: ${envio.comentarios}` : ''}
`;
      }
    }
  }

  const ticket = `
-----------------------------------------
                RECIBO X
-----------------------------------------
Fecha: ${new Date(fecha).toLocaleString()}
Cliente: ${cliente}

Producto: ${prod.name}
SKU: ${prod.sku}
Cantidad: ${qty}
Precio unit.: $${price.toFixed(2)}
Total: $${total.toFixed(2)}
${shippingSection}
Gracias por su compra.
`;

  // Obtener información de envío si existe
  let shippingInfo = null;
  if (saleIndex !== -1) {
    const sale = state.sales[saleIndex];
    if (sale.shipping_ref) {
      const envio = state.envios.find(e => e.id === sale.shipping_ref);
      if (envio) {
        shippingInfo = {
          cliente: envio.cliente,
          telefono: envio.telefono,
          direccion: envio.direccion,
          ciudad: envio.ciudad,
          comentarios: envio.comentarios,
          estado: envio.estado
        };
      }
    }
  }

  // Guardar ticket en la lista de tickets guardados
  const ticketData = {
    fecha: fecha,
    cliente: cliente,
    producto: prod.name,
    sku: prod.sku,
    cantidad: qty,
    precio: price,
    total: total,
    shipping: shippingInfo
  };

  // Cargar tickets existentes
  let savedTickets = JSON.parse(localStorage.getItem('savedTickets') || '[]');
  
  // Agregar nuevo ticket
  savedTickets.push(ticketData);
  
  // Guardar en localStorage
  localStorage.setItem('savedTickets', JSON.stringify(savedTickets));

  console.log('🎫 Ticket guardado:', ticketData);
  console.log('📋 Lista completa de tickets:', savedTickets);
  
  // Mostrar ticket en popup en lugar de alert
  const ticketContent = document.getElementById('ticket-x-content');
  const popup = document.getElementById('ticket-x-popup');
  
  if (ticketContent && popup) {
    ticketContent.innerHTML = `
      <h3>Ticket Generado</h3>
      <pre style="white-space: pre-wrap; font-family: monospace; background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">${ticket}</pre>
      <div style="text-align: center; color: green; font-weight: bold;">✅ Ticket guardado exitosamente</div>
    `;
    popup.style.display = 'block';
  } else {
    alert("Recibo generado y guardado:\n\n" + ticket + "\n\n✅ El ticket se guardó en la sección 'Tickets Guardados'");
  }
}

// ----------------------------------------------------
// INICIO
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initializeFirebaseConfig(); // 🔥 Inicializar configuración Firebase dinámica
  initializeWooConfig(); // 🛍️ Inicializar configuración WooCommerce
  loadInventoryName(); // 📝 Cargar nombre del inventario guardado

  // ✅ CORRECCIÓN: Verificar estado de login al cargar
  syncLoginState();

  // Bindear evento checkbox envio
  const cb = document.getElementById('con-envio');
  if (cb) cb.addEventListener('change', (e) => toggleEnvioForm(e.target.checked));
  
  // 🧹 Limpiar filtros de fecha del kardex al cargar la página
  const kardexFechaInicio = document.getElementById('kardex-fecha-inicio');
  const kardexFechaFin = document.getElementById('kardex-fecha-fin');
  if (kardexFechaInicio) kardexFechaInicio.value = '';
  if (kardexFechaFin) kardexFechaFin.value = '';
});

/* --- Ejecutar al cargar la página --- */
window.addEventListener("DOMContentLoaded", () => {
  initLoginScreens();
  syncLoginState(); // ✅ CORRECCIÓN: Verificar estado de login
});

/* ======================================================
   LOGIN + REGISTRO (versión final corregida)
   - Solo muestra REGISTRO si NO hay usuario guardado
   - Si existe usuario → muestra LOGIN
   - Si ya inició sesión → no muestra ninguna pantalla
====================================================== */

/* --- Claves base --- */
const KEY_USER = "invUser";
const KEY_PASS = "invPass";

/* --- Detectar si existe usuario creado --- */
function userExists() {
  return localStorage.getItem(KEY_USER) !== null &&
    localStorage.getItem(KEY_PASS) !== null;
}

/* --- Mostrar pantallas correctamente al iniciar --- */
function initLoginScreens() {
  const login = document.getElementById("login-screen");
  const register = document.getElementById("register-screen");

  // Si ya logueó antes (sesión abierta)
  if (sessionStorage.getItem("logged") === "1") {
    isLoggedIn = true; // ✅ CORRECCIÓN: Establecer estado de logueado
    
    // ✅ CORRECCIÓN: Resetear alertas críticas para sesión activa
    if (typeof initialAlertShown !== 'undefined') {
      initialAlertShown = false;
    }
    
    login.style.display = "none";
    register.style.display = "none";
    safeShowChatbot(); // ✅ MOSTRAR CHATBOT
  
    return;
  }

  // Si NO existe usuario → mostrar registro
  if (!userExists()) {
    isLoggedIn = false; // ✅ CORRECCIÓN: Asegurar estado correcto
    register.style.display = "flex";
    login.style.display = "none";
     safeHideChatbot(); // ✅ OCULTAR CHATBOT
  }
  // Si existe usuario → mostrar login
  else {
    isLoggedIn = false; // ✅ CORRECCIÓN: Asegurar estado correcto
    register.style.display = "none";
    login.style.display = "flex";
    safeHideChatbot(); // ✅ OCULTAR CHATBO

    // Prellenar usuario guardado (comodidad)
    document.getElementById("login-user").value = localStorage.getItem(KEY_USER);
  }
}

/* --- Registrar usuario nuevo --- */
function register() {
  const user = document.getElementById("reg-user").value.trim();
  const pass = document.getElementById("reg-pass").value.trim();

  if (!user || !pass) {
    alert("Completa todos los campos");
    return;
  }

  localStorage.setItem(KEY_USER, user);
  localStorage.setItem(KEY_PASS, pass);

  sessionStorage.setItem("logged", "1");
  document.getElementById("register-screen").style.display = "none";
  document.getElementById("login-screen").style.display = "none";
}

/* --- Mostrar pantalla de registro --- */
function showRegister() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("register-screen").style.display = "flex";
}

/* --- Iniciar sesión --- */
function login() {
  const user = document.getElementById("login-user").value.trim();
  const pass = document.getElementById("login-pass").value.trim();

  const savedUser = localStorage.getItem(KEY_USER);
  const savedPass = localStorage.getItem(KEY_PASS);

  if (user === savedUser && pass === savedPass) {
    sessionStorage.setItem("logged", "1");
    isLoggedIn = true; // ✅ CORRECCIÓN: Establecer estado inmediatamente
    document.getElementById("login-screen").style.display = "none";
    
    // ✅ CORRECCIÓN: Resetear alertas críticas para nueva sesión
    if (typeof initialAlertShown !== 'undefined') {
      initialAlertShown = false;
    }
    
    safeShowChatbot(); // ✅ Mostrar chatbot inmediatamente después del login
  } else {
    alert("Usuario o contraseña incorrectos");
    isLoggedIn = false; // ✅ CORRECCIÓN: Asegurar estado correcto en error
  }
}

/* --- Cerrar sesión --- */
function logout() {
  sessionStorage.removeItem("logged");
  isLoggedIn = false; // ✅ CAMBIO: Establecer estado de no logueado
  initLoginScreens();
  
  // ✅ CAMBIO: Ocultar chatbot al cerrar sesión
  try {
    if (typeof hideChatbot === 'function') {
      hideChatbot();
    } else {
      // Fallback manual
      const trigger = document.getElementById('chatbot-trigger');
      const widget = document.getElementById('chatbot-widget');
      if (trigger) trigger.style.display = 'none';
      if (widget) widget.style.display = 'none';
    }
  } catch (error) {
    console.error('Error ocultando chatbot en logout:', error);
  }
}

/* --- Cancelar registro --- */
function cancelRegister() {
  const login = document.getElementById("login-screen");
  const register = document.getElementById("register-screen");
  
  if (userExists()) {
    // Si ya hay usuario, volver al login
    register.style.display = "none";
    login.style.display = "flex";
  } else {
    // Si no hay usuario, mostrar login vacío
    register.style.display = "none";
    login.style.display = "flex";
    document.getElementById("login-user").value = "";
    document.getElementById("login-pass").value = "";
  }
}

/* =========================================================
   RECUPERACIÓN DE CONTRASEÑA
========================================================= */

/* --- Mostrar pantalla de recuperación --- */
function showRecovery() {
  const login = document.getElementById("login-screen");
  const recovery = document.getElementById("recovery-screen");
  
  login.style.display = "none";
  recovery.style.display = "flex";
}

/* --- Cancelar recuperación --- */
function cancelRecovery() {
  const login = document.getElementById("login-screen");
  const recovery = document.getElementById("recovery-screen");
  
  recovery.style.display = "none";
  login.style.display = "flex";
}

/* --- Resetear contraseña --- */
function resetPassword() {
  const pin = document.getElementById("recovery-pin").value.trim();
  const newPass = document.getElementById("new-pass").value.trim();
  
  const savedPin = localStorage.getItem("recoveryPin");
  
  if (!savedPin || pin !== savedPin) {
    alert("PIN de recuperación incorrecto");
    return;
  }
  
  if (newPass.length < 4) {
    alert("La contraseña debe tener al menos 4 caracteres");
    return;
  }
  
  localStorage.setItem(KEY_PASS, newPass);
  alert("Contraseña actualizada exitosamente");
  
  // Volver al login
  cancelRecovery();
}

/* =========================================================
   CONFIGURACIÓN DE INVENTARIO Y PIN
========================================================= */

function loadInventoryName() {
  const savedName = localStorage.getItem("inventoryName");
  if (savedName) {
    document.getElementById("inv-name").value = savedName;
    updateInventoryDisplay(savedName);
  }
}

function updateInventoryDisplay(name) {
  // Actualizar el título principal de la página
  const titleElement = document.querySelector('h1');
  if (titleElement) {
    titleElement.textContent = name || 'Inventario Dinámico';
  }
  
  // Actualizar el título de la ventana del navegador
  document.title = `${name} - Control de Inventario`;
  
  // Actualizar cualquier otro elemento que muestre el nombre
  const headerElements = document.querySelectorAll('[data-inventory-name]');
  headerElements.forEach(el => {
    el.textContent = name || 'Inventario';
  });
}

function saveInventoryName() {
  const nameInput = document.getElementById("inv-name");
  const name = nameInput.value.trim();
  
  if (!name) {
    alert("❌ Por favor ingresa un nombre para el inventario");
    nameInput.focus();
    return;
  }
  
  if (name.length < 2) {
    alert("❌ El nombre debe tener al menos 2 caracteres");
    nameInput.focus();
    return;
  }
  
  // Guardar en localStorage
  localStorage.setItem("inventoryName", name);
  
  // Actualizar interfaz
  updateInventoryDisplay(name);
  
  // Mostrar feedback visual
  const originalText = nameInput.value;
  nameInput.style.backgroundColor = '#d4edda';
  nameInput.style.borderColor = '#28a745';
  
  setTimeout(() => {
    nameInput.style.backgroundColor = '';
    nameInput.style.borderColor = '';
  }, 2000);
  
  alert(`✅ Nombre del inventario actualizado:\n"${name}"`);
  
  console.log(`📝 Nombre del inventario guardado: "${name}"`);
}

function saveNewPIN() {
  const newPin = prompt("Ingresa el nuevo PIN de recuperación:");
  if (newPin && newPin.length >= 4) {
    localStorage.setItem("recoveryPin", newPin);
    alert("PIN de recuperación actualizado");
  } else {
    alert("PIN debe tener al menos 4 dígitos");
  }
}

/* =========================================================
   TICKETS GUARDADOS - FUNCIONES ADICIONALES FALTANTES
========================================================= */

// Variables para tickets
let savedTickets = [];

// Función para renderizar tickets
function renderTickets() {
  const tableBody = document.querySelector('#tickets-table tbody');
  if (!tableBody) return;

  const searchTerm = document.getElementById('ticket-search')?.value.toLowerCase() || '';
  
  // Usar tickets del estado global (incluye los guardados en Firebase)
  const ticketsToShow = state.tickets || [];
  
  console.log('🎫 Renderizando tickets desde Firebase:', ticketsToShow.length, 'tickets encontrados');

  // Filtrar tickets
  const filteredTickets = ticketsToShow.filter(ticket => {
    if (!searchTerm) return true;
    return (
      (ticket.cliente && ticket.cliente.toLowerCase().includes(searchTerm)) ||
      (ticket.sku && ticket.sku.toLowerCase().includes(searchTerm)) ||
      (ticket.producto && ticket.producto.toLowerCase().includes(searchTerm))
    );
  });

  tableBody.innerHTML = '';

  if (filteredTickets.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">No hay tickets guardados en Firebase</td></tr>';
    return;
  }

  filteredTickets.forEach((ticket, index) => {
    // Encontrar el índice real en state.tickets
    const realIndex = state.tickets.findIndex(t => t.ticketId === ticket.ticketId);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:8px; text-align:center;">
        <input type="checkbox" class="ticket-checkbox" data-index="${realIndex}">
      </td>
      <td style="padding:8px">${new Date(ticket.fecha).toLocaleDateString()}</td>
      <td style="padding:8px">${ticket.cliente}</td>
      <td style="padding:8px">${ticket.producto}</td>
      <td style="padding:8px;display:flex;gap:6px">
        <button onclick="viewTicket('${realIndex}')">Ver</button>
        <button onclick="deleteTicket('${realIndex}')" style="background:#ff4444;color:white;">Eliminar</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Función para ver ticket
function viewTicket(index) {
  const ticket = state.tickets[index];
  if (!ticket) return;

  const ticketContent = document.getElementById('ticket-x-content');
  const popup = document.getElementById('ticket-x-popup');
  
  if (ticketContent && popup) {
    // Obtener información de envío usando la función helper
    const shippingInfo = getTicketShippingInfo(ticket);
    
    let shippingSection = '';
    if (shippingInfo.tieneEnvio) {
      shippingSection = `
      <div style="border-top:1px solid #666; padding-top:3px; margin-top:3px;">
        <div style="font-size:9px; font-weight:bold; color:#d63384; margin-bottom:2px;">🛍️ ENVÍO</div>
        <div><strong>Dest:</strong> ${shippingInfo.cliente}</div>
        <div><strong>Tel:</strong> ${shippingInfo.telefono}</div>
        <div><strong>Dir:</strong> ${shippingInfo.direccion}</div>
        <div><strong>Ciudad:</strong> ${shippingInfo.ciudad}</div>
        <div><strong>Estado:</strong> <span style="color:${shippingInfo.estado === 'Pendiente' ? '#dc3545' : '#198754'}">${shippingInfo.estado}</span></div>
        ${shippingInfo.comentarios ? `<div><strong>Notas:</strong> ${shippingInfo.comentarios}</div>` : ''}
      </div>
      `;
    }
    
    ticketContent.innerHTML = `
      <div style="text-align:center; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:5px;">
        <div style="font-size:11px; font-weight:bold;">🎫 TICKET</div>
        <div style="font-size:8px;">${new Date(ticket.fecha).toLocaleDateString()}</div>
      </div>
      
      <div style="margin-bottom:3px;">
        <div><strong>Cliente:</strong> ${ticket.cliente}</div>
        <div><strong>Producto:</strong> ${ticket.producto}</div>
        <div><strong>SKU:</strong> ${ticket.sku}</div>
      </div>
      
      <div style="border-top:1px solid #000; padding-top:3px;">
        <div style="display:flex; justify-content:space-between;">
          <span>Cant:</span>
          <span>${ticket.cantidad}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Precio:</span>
          <span>$${parseFloat(ticket.precio).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-weight:bold; border-top:1px solid #333; padding-top:2px;">
          <span>Total:</span>
          <span>$${(parseFloat(ticket.precio) * parseInt(ticket.cantidad)).toFixed(2)}</span>
        </div>
      </div>
      ${shippingSection}
    `;
    popup.style.display = 'flex';
  }
}

// Función para eliminar ticket
function deleteTicket(index) {
  if (!confirm('¿Eliminar este ticket?')) return;
  
  // Eliminar del estado global
  state.tickets.splice(index, 1);
  
  // Guardar en localStorage como respaldo
  localStorage.setItem('savedTickets', JSON.stringify(state.tickets));
  
  // Guardar en Firebase
  try {
    saveState();
    console.log('✅ Ticket eliminado y sincronizado con Firebase');
  } catch (error) {
    console.warn('⚠️ Ticket eliminado localmente, error sincronizando con Firebase:', error);
  }
  
  renderTickets();
  alert('Ticket eliminado de Firebase');
}

// Función para borrar todos los tickets
function borrarTodosLosTickets() {
  if (!confirm('¿Estás seguro que quieres eliminar TODOS los tickets de Firebase?')) return;
  
  // Limpiar del estado global
  state.tickets = [];
  
  // Limpiar localStorage como respaldo
  localStorage.removeItem('savedTickets');
  
  // Guardar en Firebase
  try {
    saveState();
    console.log('✅ Todos los tickets eliminados y sincronizados con Firebase');
    alert('✅ Todos los tickets eliminados de Firebase');
  } catch (error) {
    console.warn('⚠️ Tickets eliminados localmente, error sincronizando con Firebase:', error);
    alert('⚠️ Tickets eliminados localmente, error sincronizando con Firebase');
  }
  
  renderTickets();
}

// Función para seleccionar/deseleccionar todos los tickets
function toggleAllTickets(checkbox) {
  const allCheckboxes = document.querySelectorAll('.ticket-checkbox');
  allCheckboxes.forEach(cb => {
    cb.checked = checkbox.checked;
  });
}

// Función para imprimir tickets seleccionados
function imprimirTicketsSeleccionados() {
  const checkboxes = document.querySelectorAll('.ticket-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Selecciona al menos un ticket para imprimir');
    return;
  }
  
  console.log(`🖨 Imprimiendo ${checkboxes.length} tickets seleccionados...`);
  
  // Crear contenido HTML para imprimir múltiples tickets
  let printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Tickets Seleccionados</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 10mm;
          background: white;
        }
        .tickets-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8mm;
          justify-content: center;
        }
        .ticket { 
          width: 5cm;
          height: 10cm;
          border: 2px solid #333; 
          padding: 6px; 
          margin-bottom: 0; 
          page-break-inside: avoid;
          border-radius: 4px;
          background: white;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-size: 10px;
          line-height: 1.1;
        }
        .ticket-header {
          text-align: center;
          border-bottom: 1px solid #333;
          padding-bottom: 3px;
          margin-bottom: 4px;
        }
        .ticket-title {
          font-size: 12px;
          font-weight: bold;
          margin: 0;
        }
        .ticket-subtitle {
          font-size: 8px;
          margin: 2px 0 0 0;
          color: #666;
        }
        .ticket-details {
          display: block;
          margin-bottom: 4px;
        }
        .ticket-detail {
          font-size: 9px;
          margin-bottom: 1px;
        }
        .ticket-detail strong {
          color: #333;
        }
        .product-info {
          border-top: 1px solid #000;
          padding-top: 3px;
          margin-top: 2px;
        }
        .product-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1px;
          font-size: 9px;
        }
        .price {
          font-weight: bold;
          color: #2b7;
        }
        .footer {
          text-align: center;
          margin-top: 4px;
          padding-top: 2px;
          border-top: 1px solid #ddd;
          font-size: 7px;
          color: #666;
        }
        .page-break {
          page-break-before: always;
        }
        @media print {
          body { 
            margin: 0; 
            padding: 5mm;
          }
          .tickets-grid {
            gap: 5mm;
          }
          .ticket { 
            border: 1px solid #333; 
            margin-bottom: 0; 
            width: 5cm;
            height: 10cm;
          }
          .no-print { display: none; }
          @page {
            margin: 1cm;
          }
        }
      </style>
    </head>
    <body>
  `;
  
  printContent += '<div class="tickets-grid">';
  
  // Agregar cada ticket seleccionado al contenido de impresión
  checkboxes.forEach((checkbox, index) => {
    const ticketIndex = parseInt(checkbox.getAttribute('data-index'));
    const ticket = state.tickets[ticketIndex];
    
    if (ticket) {
      // Obtener información de envío
      const shippingInfo = getTicketShippingInfo(ticket);
      
      let shippingSection = '';
      if (shippingInfo.tieneEnvio) {
        shippingSection = `
          <div class="ticket-detail" style="border-top:1px dashed #666; padding-top:3px; margin-top:3px;">
            <div style="font-size:9px; font-weight:bold; color:#d63384; margin-bottom:2px;">🛍️ ENVÍO</div>
            <div><strong>Dest:</strong> ${shippingInfo.cliente}</div>
            <div><strong>Tel:</strong> ${shippingInfo.telefono}</div>
            <div><strong>Dir:</strong> ${shippingInfo.direccion}</div>
            <div><strong>Ciudad:</strong> ${shippingInfo.ciudad}</div>
            <div><strong>Estado:</strong> <span style="color:${shippingInfo.estado === 'Pendiente' ? '#dc3545' : '#198754'}">${shippingInfo.estado}</span></div>
            ${shippingInfo.comentarios ? `<div><strong>Notas:</strong> ${shippingInfo.comentarios}</div>` : ''}
          </div>
        `;
      }
      
      printContent += `
        <div class="ticket">
          <div class="ticket-header">
            <div class="ticket-title">🎫 TICKET</div>
            <div class="ticket-subtitle">${new Date(ticket.fecha).toLocaleDateString()}</div>
          </div>
          
          <div class="ticket-details">
            <div class="ticket-detail"><strong>Cliente:</strong> ${ticket.cliente}</div>
            <div class="ticket-detail"><strong>Producto:</strong> ${ticket.producto}</div>
            <div class="ticket-detail"><strong>SKU:</strong> ${ticket.sku}</div>
          </div>
          
          <div class="product-info">
            <div class="product-row">
              <span><strong>Cant:</strong></span>
              <span>${ticket.cantidad}</span>
            </div>
            <div class="product-row">
              <span><strong>Precio:</strong></span>
              <span>$${parseFloat(ticket.precio).toFixed(2)}</span>
            </div>
            <div class="product-row">
              <span><strong>Total:</strong></span>
              <span>$${(parseFloat(ticket.precio) * parseInt(ticket.cantidad)).toFixed(2)}</span>
            </div>
          </div>
          ${shippingSection}
        </div>
      `;
    }
  });
  
  printContent += '</div>';
  
  printContent += `
    </body>
    </html>
  `;
  
  // Crear ventana de impresión
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Esperar a que el contenido se cargue y luego imprimir
    printWindow.onload = function() {
      printWindow.print();
      printWindow.close();
    };
    
    console.log(`✅ Ventana de impresión abierta con ${checkboxes.length} tickets`);
  } else {
    alert('Error: No se pudo abrir la ventana de impresión. Verifica que no hayas bloqueado ventanas emergentes.');
  }
}

// Funciones del popup de ticket X
function printTicketX() {
  // Crear contenido de impresión solo para el ticket
  const ticketContent = document.getElementById('ticket-x-content');
  const ticketBox = document.getElementById('ticket-x-box');
  
  if (ticketContent && ticketBox) {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket</title>
          <style>
            body { 
              margin: 0; 
              padding: 10px; 
              background: white; 
              font-family: Arial, sans-serif;
              font-size: 10px;
              line-height: 1.2;
            }
            .ticket { 
              width: 5cm;
              height: 10cm;
              border: 2px solid #333; 
              padding: 8px;
              background: white;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .ticket-header {
              text-align: center;
              border-bottom: 1px solid #000;
              padding-bottom: 3px;
              margin-bottom: 5px;
            }
            .ticket-title {
              font-size: 11px;
              font-weight: bold;
              margin: 0;
            }
            .ticket-subtitle {
              font-size: 8px;
              margin: 2px 0 0 0;
            }
            .ticket-details {
              margin-bottom: 3px;
            }
            .detail-row {
              margin-bottom: 1px;
            }
            .price-section {
              border-top: 1px solid #000;
              padding-top: 3px;
            }
            .price-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 1px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              border-top: 1px solid #333;
              padding-top: 2px;
            }
            @media print {
              body { 
                margin: 0; 
                padding: 5px; 
              }
              .ticket { 
                border: 1px solid #333; 
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            ${ticketContent.innerHTML}
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      
      printWindow.onload = function() {
        printWindow.print();
        printWindow.close();
      };
      
      console.log('🖨 Imprimiendo ticket individual...');
    }
  }
}

function closeTicketX() {
  const popup = document.getElementById('ticket-x-popup');
  if (popup) {
    popup.style.display = 'none';
  }
}

// FUNCIONES DE SINCRONIZACIÓN BIDIRECCIONAL CON WOOCOMMERCE

// FUNCIÓN: Obtener productos desde WooCommerce hacia la app
async function fetchProductsFromWooCommerce() {
  if (!currentWooConfig) {
    alert('Primero configura las credenciales de WooCommerce');
    return;
  }

  if (!confirm('¿Obtener productos desde WooCommerce?\nEsto puede sobrescribir productos existentes con los mismos SKU.')) {
    return;
  }

  try {
    console.log('Iniciando obtención de productos desde WooCommerce...');
    
    const response = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products?per_page=100`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error HTTP ${response.status}: ${errorText}`);
    }

    const wooProducts = await response.json();
    console.log(`Obtenidos ${wooProducts.length} productos desde WooCommerce`);

    if (wooProducts.length === 0) {
      alert('No se encontraron productos en WooCommerce');
      return;
    }

    let updateCount = 0;
    let createCount = 0;

    for (const wooProduct of wooProducts) {
      // Si no tiene SKU, generar uno basado en el ID de WooCommerce
      const productSku = wooProduct.sku || `woo-${wooProduct.id}`;
      if (!wooProduct.sku) {
        console.log(`Producto ${wooProduct.id} sin SKU, usando: ${productSku}`);
      }

      const categoryName = (wooProduct.categories && wooProduct.categories.length > 0) 
        ? wooProduct.categories[0].name 
        : 'Importado WooCommerce';
      
      // Procesar imágenes desde WooCommerce
      const imagenes = [];
      if (wooProduct.images && wooProduct.images.length > 0) {
        for (let i = 0; i < wooProduct.images.length; i++) {
          const img = wooProduct.images[i];
          imagenes.push({
            id: 'woo_img_' + Date.now() + '_' + i,
            name: img.name || `imagen_${i + 1}.jpg`,
            size: 0,
            type: 'image/jpeg',
            data: img.src, // URL de la imagen desde WooCommerce
            fecha: new Date().toISOString()
          });
        }
      }
      
      const productData = {
        sku: productSku,
        name: wooProduct.name,
        price: parseFloat(wooProduct.regular_price) || parseFloat(wooProduct.price) || 0,
        cost: parseFloat(wooProduct.regular_price) * 0.7 || 0,
        ship: 0,
        commission: 0,
        stock: wooProduct.stock_quantity || 0,
        category: categoryName,
        brand: '',
        supplier: 'WooCommerce',
        color: '',
        publish: { ml: false, fb: false, ig: false },
        imagenes: imagenes // Incluir imágenes importadas desde WooCommerce
      };

      // Buscar si existe por SKU (puede estar con otra clave)
      const existingEntry = Object.entries(state.productos).find(([key, prod]) => prod.sku === productSku);
      
      if (existingEntry) {
        // Actualizar producto existente
        state.productos[existingEntry[0]] = { ...state.productos[existingEntry[0]], ...productData };
        updateCount++;
      } else {
        // Crear nuevo producto usando SKU como clave
        state.productos[productSku] = productData;
        createCount++;
      }
    }

    // Guardar usando saveState() que maneja Firebase correctamente
    saveState();
    
    console.log(`✓ Sincronización completada:\n- Actualizados: ${updateCount}\n- Creados: ${createCount}\nTotal: ${wooProducts.length}`);
    
    alert(`✓ Sincronización desde WooCommerce completada\n\nActualizados: ${updateCount}\nCreados: ${createCount}\nTotal: ${wooProducts.length}`);
    
    // Actualizar visualización
    renderProducts();
    
    // 🔄 Actualizar kardex automáticamente
    actualizarKardexAutomatico();
    
  } catch (error) {
    console.error('Error obteniendo productos desde WooCommerce:', error);
    alert(`✗ Error obteniendo productos desde WooCommerce:\n${error.message}\n\nVerifica:\n• Permisos de lectura en WooCommerce API\n• Consumer Key con permisos GET\n• URL correcta`);
  }
}

// FUNCIÓN: Actualizar stock específico desde WooCommerce
async function updateStockFromWooCommerce(sku) {
  if (!currentWooConfig) return false;

  try {
    // Buscar producto por SKU
    const response = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Error buscando producto ${sku} en WooCommerce:`, response.status);
      return false;
    }

    const products = await response.json();
    if (products.length === 0) {
      console.log(`Producto ${sku} no encontrado en WooCommerce`);
      return false;
    }

    const wooProduct = products[0];
    const newStock = wooProduct.stock_quantity || 0;
    
    // Actualizar en la app
    if (state.productos[sku]) {
      state.productos[sku].stock = newStock;
      state.productos[sku].lastModified = Date.now();
      
      // Guardar en Firebase
      db.ref('/').set({
        ...state,
        productos: state.productos
      });
      
      console.log(`✓ Stock de ${sku} actualizado desde WooCommerce: ${newStock}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error actualizando stock desde WooCommerce para ${sku}:`, error);
    return false;
  }
}



// ----------------------------------------------------
// SINCRONIZACIÓN DE TICKETS CON INFORMACIÓN DE ENVÍO
// ----------------------------------------------------

// Función para sincronizar tickets después de cargar desde Firebase
function syncTicketsAfterLoad() {
  console.log('🔄 Sincronizando tickets...');
  
  // Cargar tickets de localStorage
  let savedTickets = JSON.parse(localStorage.getItem('savedTickets') || '[]');
  
  // Para cada ticket en savedTickets, verificar si tiene información de envío
  // y completar si falta
  savedTickets.forEach((savedTicket, index) => {
    if (!savedTicket.shipping) {
      const shippingInfo = getTicketShippingInfo(savedTicket);
      if (shippingInfo.tieneEnvio) {
        savedTickets[index].shipping = {
          cliente: shippingInfo.cliente,
          telefono: shippingInfo.telefono,
          direccion: shippingInfo.direccion,
          ciudad: shippingInfo.ciudad,
          comentarios: shippingInfo.comentarios,
          estado: shippingInfo.estado
        };
        console.log('✅ Información de envío completada para ticket:', savedTicket.ticketId || `index_${index}`);
      }
    }
  });
  
  // Actualizar localStorage con información completa
  localStorage.setItem('savedTickets', JSON.stringify(savedTickets));
  
  // También verificar tickets en state.tickets (desde Firebase)
  if (state.tickets && Array.isArray(state.tickets)) {
    let updatedCount = 0;
    state.tickets.forEach((ticket, index) => {
      if (!ticket.shipping) {
        const shippingInfo = getTicketShippingInfo(ticket);
        if (shippingInfo.tieneEnvio) {
          state.tickets[index].shipping = {
            cliente: shippingInfo.cliente,
            telefono: shippingInfo.telefono,
            direccion: shippingInfo.direccion,
            ciudad: shippingInfo.ciudad,
            comentarios: shippingInfo.comentarios,
            estado: shippingInfo.estado
          };
          updatedCount++;
          console.log('✅ Información de envío completada para ticket Firebase:', ticket.ticketId || `index_${index}`);
        }
      }
    });
    
    if (updatedCount > 0) {
      console.log(`📤 Guardando ${updatedCount} tickets actualizados en Firebase...`);
      saveState(); // Guardar cambios en Firebase
    }
  }
  
  console.log('✅ Sincronización de tickets completada');
}

// ----------------------------------------------------
// SINCRONIZACIÓN DE VENTAS DESDE WOOCOMMERCE
// ----------------------------------------------------

// Función para obtener información de envío asociada a un ticket
function getTicketShippingInfo(ticket) {
  console.log('🔍 Buscando envío para ticket:', {
    cliente: ticket.cliente,
    producto: ticket.producto,
    sku: ticket.sku,
    fecha: ticket.fecha,
    yaTieneShipping: !!ticket.shipping
  });
  
  // Si el ticket ya tiene información de envío (tickets generados automáticamente)
  if (ticket.shipping) {
    console.log('✅ Ticket tiene shipping info directa:', ticket.shipping);
    return {
      tieneEnvio: true,
      cliente: ticket.shipping.cliente,
      telefono: ticket.shipping.telefono,
      direccion: ticket.shipping.direccion,
      ciudad: ticket.shipping.ciudad,
      comentarios: ticket.shipping.comentarios,
      estado: ticket.shipping.estado,
      fechaCreacion: new Date().toISOString()
    };
  }
  
  // Buscar la venta correspondiente por coincidencias múltiples (más flexible)
  let matchingSales = state.sales.filter(sale => 
    sale.cliente === ticket.cliente && 
    sale.name === ticket.producto && 
    sale.sku === ticket.sku
  );
  
  console.log('🔍 Ventas que coinciden:', matchingSales.length);
  matchingSales.forEach((sale, i) => {
    console.log(`  ${i + 1}. Fecha: ${sale.date}, Shipping_ref: ${sale.shipping_ref || 'Ninguno'}`);
  });
  
  // Si hay coincidencias, usar la más reciente
  if (matchingSales.length > 0) {
    matchingSales.sort((a, b) => new Date(b.date) - new Date(a.date)); // Ordenar por fecha descendente
    const sale = matchingSales[0];
    
    console.log('🎯 Venta seleccionada:', {
      fecha: sale.date,
      shipping_ref: sale.shipping_ref
    });
    
    if (sale.shipping_ref) {
      const envio = state.envios.find(e => e.id === sale.shipping_ref);
      if (envio) {
        console.log('✅ Envío encontrado:', envio);
        return {
          tieneEnvio: true,
          cliente: envio.cliente,
          telefono: envio.telefono,
          direccion: envio.direccion,
          ciudad: envio.ciudad,
          comentarios: envio.comentarios,
          estado: envio.estado,
          fechaCreacion: envio.fecha_creacion
        };
      } else {
        console.log('❌ Envío no encontrado para shipping_ref:', sale.shipping_ref);
      }
    }
  }
  
  console.log('❌ No se encontró envío para este ticket');
  return { tieneEnvio: false };
}

/*
  FUNCIONALIDAD IMPLEMENTADA: GESTIÓN DE ENVÍOS INTEGRADA
  
  🔄 FLUJO COMPLETO:
  1. Registrar venta con envío → Se crea automáticamente envío + se asocia
  2. Agregar envío después → Modal para datos + se asocia a la venta
  3. Historial muestra estado de envío con iconos y botones
  4. Envíos aparecen en sección "Envíos" con trazabilidad
  
  📊 MEJORAS VISUALES:
  - Columna "Envío" en historial de ventas
  - Iconos 🚚 para envíos asociados
  - Botón "+ Envío" para ventas sin envío
  - Badges de origen (Desde venta vs Manual)
  - Estado visual (Pendiente/Enviado)
  
  🔗 RELACIONES:
  - Venta.shipping_ref → referencia al envío
  - Envío.fecha_venta → origen de la venta
  - Sincronización automática con Firebase
*/

// FUNCIÓN: Obtener y sincronizar ventas desde WooCommerce
async function syncSalesFromWooCommerce() {
  try {
    // Verificar configuración de WooCommerce
    const wooConfig = loadWooConfig();
    if (!wooConfig.success) {
      alert('Primero configura las credenciales de WooCommerce');
      return;
    }

    if (!confirm('¿Sincronizar ventas desde WooCommerce?\n\nEsto agregará las ventas de tu tienda online al historial de la aplicación.')) {
      return;
    }

    console.log('🔄 Iniciando sincronización de ventas desde WooCommerce...');

    // Crear overlay de carga
    const overlay = document.createElement('div');
    overlay.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center">
        <div style="background:white;padding:30px;border-radius:15px;text-align:center;max-width:400px">
          <h4>🔄 Sincronizando ventas desde WooCommerce...</h4>
          <p style="color:#666;margin:10px 0">Obteniendo órdenes de tu tienda online...</p>
          <div style="width:100%;height:6px;background:#eee;border-radius:3px;overflow:hidden">
            <div style="width:30%;height:100%;background:#026669;animation:pulse 1.5s infinite"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Obtener órdenes desde WooCommerce
    const orders = await fetchOrdersFromWooCommerce();
    
    if (!orders || orders.length === 0) {
      overlay.remove();
      alert('📭 No se encontraron ventas en WooCommerce\n\nLas ventas aparecerán aquí una vez que se procesen en tu tienda online.');
      return;
    }

    console.log(`📊 Obtenidas ${orders.length} órdenes desde WooCommerce`);

    let newSalesCount = 0;
    let skippedCount = 0;
    const existingSaleKeys = new Set(); // Para evitar duplicados

    // Crear claves únicas para ventas existentes
    state.sales.forEach(sale => {
      const key = `${sale.date}-${sale.sku}-${sale.qty}-${sale.price}`;
      existingSaleKeys.add(key);
    });

    // Procesar cada orden
    for (const order of orders) {
      try {
        // Obtener fecha de la orden
        const orderDate = order.date_created || order.date_modified || new Date().toISOString();
        
        // Verificar si la orden ya existe en el historial
        const orderKey = `${orderDate}-${order.id}-${order.total}`;
        if (existingSaleKeys.has(orderKey)) {
          skippedCount++;
          continue;
        }

        // Procesar items de la orden
        if (order.line_items && order.line_items.length > 0) {
          for (const item of order.line_items) {
            // Buscar producto en el inventario local con múltiples criterios
            let product = findProductInInventory(item, order);
            
            if (!product) {
              // Intentar crear producto automáticamente si no existe
              console.log(`🔄 Intentando crear producto automático: ${item.name} (${item.sku})`);
              product = await createProductFromWooCommerceItem(item, order);
            }

            if (!product) {
              console.warn(`⚠️ Producto no encontrado y no se pudo crear: ${item.name} (${item.sku})`);
              console.warn(`   Productos disponibles en inventario:`, Object.values(state.productos || {}).map(p => `${p.name} (${p.sku})`));
              skippedCount++;
              continue;
            }

            // Calcular precio por unidad
            const unitPrice = parseFloat(item.total) / parseInt(item.quantity);
            
            // Crear objeto de venta
            const sale = {
              date: orderDate,
              sku: product.sku,
              name: product.name,
              qty: parseInt(item.quantity),
              price: unitPrice,
              method: mapPaymentMethod(order.payment_method, order.payment_method_title),
              profit: calculateSaleProfit(product, unitPrice, parseInt(item.quantity)),
              cliente: order.billing?.first_name && order.billing?.last_name ? 
                       `${order.billing.first_name} ${order.billing.last_name}` : 
                       (order.billing?.email || "Cliente Online"),
              source: 'woocommerce', // Marcar origen
              order_id: order.id // ID de la orden en WooCommerce
            };

            // Agregar al estado
            state.sales.push(sale);
            newSalesCount++;
            
            console.log(`✅ Venta sincronizada: ${product.name} x${item.quantity} desde orden #${order.id}`);
          }
        } else {
          skippedCount++;
        }

      } catch (itemError) {
        console.error('Error procesando item de orden:', itemError);
        console.error(`   Orden ID: ${order.id}, Producto: ${item.name} (${item.sku})`);
        skippedCount++;
      }
    }

    // Remover overlay
    overlay.remove();

    // Guardar cambios en Firebase
    try {
      saveState();
      console.log('✅ Ventas sincronizadas guardadas en Firebase');
    } catch (error) {
      console.error('❌ Error guardando ventas sincronizadas:', error);
    }

    // Actualizar interfaz
    refreshUI();

    // Mostrar resultado detallado
    let message = `✓ Sincronización desde WooCommerce completada\n\n` +
                 `📈 Ventas nuevas agregadas: ${newSalesCount}\n` +
                 `⏭️ Ventas omitidas: ${skippedCount}\n` +
                 `📊 Total órdenes procesadas: ${orders.length}`;
    
    if (skippedCount > 0) {
      message += `\n\n💡 Las ventas omitidas fueron porque:\n` +
                `• Los productos no existen en el inventario local\n` +
                `• Las ventas ya fueron importadas anteriormente\n\n` +
                `Puedes:\n` +
                `1. Revisar la consola para más detalles\n` +
                `2. Permitir creación automática de productos\n` +
                `3. Sincronizar inventario desde WooCommerce primero`;
    }
    
    alert(message);
    console.log('🎉 Sincronización de ventas completada:', { newSalesCount, skippedCount, totalOrders: orders.length });

  } catch (error) {
    console.error('❌ Error en sincronización de ventas:', error);
    alert(`✗ Error sincronizando ventas desde WooCommerce:\n${error.message}\n\nVerifica:\n• Permisos de lectura de órdenes en WooCommerce API\n• Consumer Key con permisos GET\n• Que existan ventas en tu tienda\n\n💡 Tip: Sincroniza el inventario primero para evitar productos omitidos`);
  }
}

// FUNCIÓN: Sincronizar inventario desde WooCommerce
async function syncProductsFromWooCommerce() {
  try {
    const wooConfig = loadWooConfig();
    if (!wooConfig.success) {
      alert('Primero configura las credenciales de WooCommerce');
      return;
    }

    if (!confirm('¿Sincronizar inventario desde WooCommerce?\n\nEsto importará los productos de tu tienda online.')) {
      return;
    }

    console.log('🔄 Sincronizando inventario desde WooCommerce...');
    
    const response = await fetch(`${wooConfig.config.url}/wp-json/wc/v3/products?per_page=100`, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${wooConfig.config.key}:${wooConfig.config.secret}`),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const products = await response.json();
    let newProductsCount = 0;
    let updatedProductsCount = 0;

    for (const wooProduct of products) {
      const existingProduct = Object.values(state.productos || {}).find(p => 
        p.sku === wooProduct.sku || p.name === wooProduct.name
      );

      // Procesar imágenes desde WooCommerce
      const imagenes = [];
      if (wooProduct.images && wooProduct.images.length > 0) {
        for (let i = 0; i < wooProduct.images.length; i++) {
          const img = wooProduct.images[i];
          imagenes.push({
            id: 'woo_img_' + Date.now() + '_' + i,
            name: img.name || `imagen_${i + 1}.jpg`,
            size: 0,
            type: 'image/jpeg',
            data: img.src, // URL de la imagen desde WooCommerce
            fecha: new Date().toISOString()
          });
        }
      }

      if (existingProduct) {
        // Actualizar producto existente
        existingProduct.price = parseFloat(wooProduct.regular_price) || 0;
        existingProduct.stock = wooProduct.stock_quantity || 0;
        existingProduct.description = wooProduct.description || '';
        existingProduct.imagenes = imagenes; // Actualizar imágenes
        updatedProductsCount++;
      } else {
        // Crear nuevo producto
        const newProduct = {
          id: `woo_${wooProduct.id}`,
          sku: wooProduct.sku || `woo_${wooProduct.id}`,
          name: wooProduct.name,
          price: parseFloat(wooProduct.regular_price) || 0,
          cost: parseFloat(wooProduct.regular_price) * 0.7 || 0,
          stock: wooProduct.stock_quantity || 0,
          category: wooProduct.categories?.[0]?.name || 'Importado desde WooCommerce',
          description: wooProduct.description || '',
          dateAdded: new Date().toISOString(),
          supplier: 'WooCommerce',
          minStock: 0,
          imagenes: imagenes // Incluir imágenes importadas
        };
        
        state.productos[newProduct.id] = newProduct;
        newProductsCount++;
      }
    }

    saveState();
    refreshUI();

    alert(`✅ Sincronización de inventario completada\n\n` +
          `🆕 Productos nuevos: ${newProductsCount}\n` +
          `🔄 Productos actualizados: ${updatedProductsCount}\n` +
          `📊 Total productos en WooCommerce: ${products.length}`);

  } catch (error) {
    console.error('❌ Error sincronizando inventario:', error);
    alert(`✗ Error sincronizando inventario:\n${error.message}`);
  }
}

// FUNCIÓN: Obtener órdenes desde WooCommerce API
async function fetchOrdersFromWooCommerce() {
  const wooConfig = JSON.parse(localStorage.getItem('woo-config'));
  if (!wooConfig || !wooConfig.url || !wooConfig.key || !wooConfig.secret) {
    throw new Error('Configuración de WooCommerce no encontrada');
  }

  const baseUrl = wooConfig.url.replace(/\/$/, '');
  const auth = btoa(`${wooConfig.key}:${wooConfig.secret}`);
  
  // Obtener órdenes completadas y procesadas (últimas 100)
  const url = `${baseUrl}/wp-json/wc/v3/orders?status=completed,processing&per_page=100&orderby=date&order=desc`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
  }

  const orders = await response.json();
  console.log(`📋 Obtenidas ${orders.length} órdenes desde WooCommerce`);
  
  return orders;
}

// FUNCIÓN: Buscar producto en inventario con múltiples criterios
function findProductInInventory(item, order) {
  const productos = Object.values(state.productos || {});
  
  console.log(`🔍 Buscando producto en inventario: "${item.name}" (SKU: ${item.sku || 'no-sku'})`);
  console.log(`   Productos disponibles: ${productos.length}`);
  
  // Criterio 1: SKU exacto
  if (item.sku) {
    const productBySku = productos.find(p => p.sku === item.sku);
    if (productBySku) {
      console.log(`✅ Producto encontrado por SKU exacto: ${productBySku.name}`);
      return productBySku;
    }
  }
  
  // Criterio 2: Nombre exacto
  const productByName = productos.find(p => 
    p.name.toLowerCase() === item.name.toLowerCase()
  );
  if (productByName) {
    console.log(`✅ Producto encontrado por nombre exacto: ${productByName.name}`);
    return productByName;
  }
  
  // Criterio 3: Nombre parcial (incluye)
  const productByPartialName = productos.find(p => 
    p.name.toLowerCase().includes(item.name.toLowerCase()) ||
    item.name.toLowerCase().includes(p.name.toLowerCase())
  );
  if (productByPartialName) {
    console.log(`✅ Producto encontrado por nombre parcial: ${productByPartialName.name}`);
    return productByPartialName;
  }
  
  // Criterio 4: Comparar SKU sin guiones/espacios
  if (item.sku) {
    const cleanItemSku = item.sku.replace(/[-\s]/g, '');
    const productByCleanSku = productos.find(p => {
      const cleanProductSku = p.sku.replace(/[-\s]/g, '');
      return cleanProductSku === cleanItemSku;
    });
    if (productByCleanSku) {
      console.log(`✅ Producto encontrado por SKU limpio: ${productByCleanSku.name}`);
      return productByCleanSku;
    }
  }
  
  console.log(`❌ No se encontró producto para: "${item.name}" (${item.sku || 'no-sku'})`);
  return null;
}

// FUNCIÓN: Crear producto automáticamente desde WooCommerce
async function createProductFromWooCommerceItem(item, order) {
  try {
    const shouldCreate = confirm(
      `¿Crear automáticamente el producto "${item.name}" en el inventario?\n\n` +
      `Este producto no existe en tu inventario actual pero aparece en WooCommerce.\n\n` +
      `SKU: ${item.sku || 'no-sku'}\n` +
      `Precio: $${parseFloat(item.total) / parseInt(item.quantity)}`
    );
    
    if (!shouldCreate) {
      console.log(`⏭️ Usuario eligió no crear producto: ${item.name}`);
      return null;
    }
    
    const unitPrice = parseFloat(item.total) / parseInt(item.quantity);
    
    const newProduct = {
      id: Date.now().toString(),
      sku: item.sku || `woo-${order.id}-${item.product_id}`,
      name: item.name,
      price: unitPrice,
      cost: unitPrice * 0.7, // Asumir 30% de margen
      stock: 999, // Stock alto por defecto
      category: 'Importado desde WooCommerce',
      description: `Producto importado automáticamente desde WooCommerce (Orden #${order.id})`,
      dateAdded: new Date().toISOString(),
      supplier: 'WooCommerce',
      minStock: 0,
      imagenes: [] // Array de imágenes (vacío para productos creados automáticamente)
    };
    
    // Agregar al estado
    state.productos[newProduct.id] = newProduct;
    console.log(`✅ Producto creado automáticamente: ${newProduct.name} (${newProduct.sku})`);
    
    return newProduct;
    
  } catch (error) {
    console.error(`❌ Error creando producto automáticamente:`, error);
    return null;
  }
}

// FUNCIÓN: Mapear método de pago de WooCommerce
function mapPaymentMethod(wooMethod, wooTitle) {
  const methodMap = {
    'bacs': 'Transferencia',
    'cheque': 'Cheque', 
    'cod': 'Efectivo Contra Entrega',
    'paypal': 'PayPal',
    'stripe': 'Tarjeta',
    'razorpay': 'Tarjeta',
    'mercadopago': 'Mercado Pago',
    'bank_transfer': 'Transferencia'
  };

  // Buscar por código de método
  if (methodMap[wooMethod]) {
    return methodMap[wooMethod];
  }

  // Buscar por título si contiene palabras clave
  const title = (wooTitle || '').toLowerCase();
  if (title.includes('mercado pago')) return 'Mercado Pago';
  if (title.includes('paypal')) return 'PayPal';
  if (title.includes('transferencia') || title.includes('bank')) return 'Transferencia';
  if (title.includes('efectivo') || title.includes('cash')) return 'Efectivo';
  if (title.includes('tarjeta') || title.includes('card')) return 'Tarjeta';
  
  // Si no encuentra coincidencia, usar el título original
  return wooTitle || 'Online';
}

// FUNCIÓN: Calcular ganancia de venta
function calculateSaleProfit(product, unitPrice, quantity) {
  const cost = parseFloat(product.cost) || 0;
  const ship = parseFloat(product.ship) || 0;
  const commission = parseFloat(product.commission) || 0;
  
  const commissionAmt = unitPrice * (commission / 100);
  const profitPerUnit = unitPrice - (cost + ship + commissionAmt);
  const totalProfit = profitPerUnit * quantity;
  
  return isNaN(totalProfit) ? 0 : totalProfit;
}

// En js/app.js

/* =========================================================
   FUNCIÓN NUEVA: PREDICCIÓN Y SUGERENCIA DE REORDEN
========================================================= */
function getReorderSuggestions() {
    // Validar estado antes de proceder
    if (!validarState()) {
        console.error('❌ No se pudo validar state en getReorderSuggestions');
        return {};
    }
    
    const suggestions = {};
    const sales = state.sales || [];
    const products = state.productos || {};
    const NOW = new Date().getTime();
    const DAYS_TO_ANALYZE = 90; // Analizamos ventas de los últimos 90 días
    const SAFETY_STOCK_DAYS = 15; // Queremos tener stock para 15 días extra
    const today = new Date();
    today.setDate(today.getDate() - DAYS_TO_ANALYZE);
    const timeLimit = today.getTime();

    // 1. Calcular la Tasa de Consumo (Ventas promedio por día)
    const productSales = {}; // { SKU: { totalQty: X, totalDays: Y } }

    sales.forEach(sale => {
        // Validar que la venta existe y tiene items
        if (!sale || !sale.items) {
            return; // Saltar esta venta si no es válida
        }
        
        const saleTime = new Date(sale.date).getTime();
        
        // Solo ventas dentro del período de análisis
        if (saleTime >= timeLimit) {
            sale.items.forEach(item => {
                const sku = item.sku || 'UNKNOWN';
                if (!productSales[sku]) {
                    productSales[sku] = { totalQty: 0, firstSale: saleTime };
                }
                productSales[sku].totalQty += item.qty;
                // Actualizar la venta más antigua para calcular los días exactos
                if (saleTime < productSales[sku].firstSale) {
                    productSales[sku].firstSale = saleTime;
                }
            });
        }
    });

    // 2. Proyectar Agotamiento y Sugerir Reorden
    for (const sku in products) {
        const product = products[sku];
        const currentStock = product.stock || 0;

        if (productSales[sku] && currentStock > 0) {
            const daysSinceFirstSale = Math.ceil((NOW - productSales[sku].firstSale) / (1000 * 60 * 60 * 24));
            
            // Tasa de Consumo Diaria (DC): Qty Vendida / Días Analizados
            const dailyConsumption = productSales[sku].totalQty / Math.max(daysSinceFirstSale, 1);
            
            // Días de Stock Restante (DOS): Stock Actual / DC
            const daysOfStockRemaining = currentStock / dailyConsumption;
            
            // Punto de Reorden (ROP): Si quedan menos de 30 días de stock
            if (daysOfStockRemaining <= 30) {
                
                // Cantidad Sugerida (EOQ simple): Cubrir 60 días de demanda + stock de seguridad
                const reorderQuantity = Math.ceil(dailyConsumption * (60 + SAFETY_STOCK_DAYS));

                suggestions[sku] = {
                    name: product.name,
                    stock: currentStock,
                    dailyConsumption: dailyConsumption.toFixed(2),
                    daysRemaining: daysOfStockRemaining.toFixed(0),
                    reorderQty: reorderQuantity,
                };
            }
        }
    }
    
    // Guardamos las sugerencias en el estado global para acceso del chatbot y UI
    state.reorderSuggestions = suggestions; 
    return suggestions;
}

/* =========================================================
   SISTEMA DE ÓRDENES DE COMPRA - IMPLEMENTACIÓN COMPLETA
========================================================= */

// Función para cargar productos del proveedor seleccionado
function cargarProductosProveedor() {
  const proveedorSelect = document.getElementById('oc-proveedor');
  const productoSelect = document.getElementById('oc-producto');
  const proveedorSeleccionado = proveedorSelect.value;
  
  // Limpiar select de productos
  productoSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
  
  if (!proveedorSeleccionado) return;
  
  // Validar que state.productos existe
  if (!state.productos || typeof state.productos !== 'object') {
    console.warn('⚠️ No se pueden cargar productos: state.productos no está inicializado');
    return;
  }
  
  // Filtrar productos por proveedor
  const productosProveedor = Object.values(state.productos).filter(p => p && p.supplier === proveedorSeleccionado);
  
  productosProveedor.forEach(producto => {
    const option = document.createElement('option');
    option.value = producto.sku;
    option.textContent = `${producto.name} (Stock: ${producto.stock || 0})`;
    productoSelect.appendChild(option);
  });
}

// Función para cargar información del producto seleccionado
function cargarInfoProducto() {
  const productoSelect = document.getElementById('oc-producto');
  const precioInput = document.getElementById('oc-precio-unitario');
  const cantidadInput = document.getElementById('oc-cantidad');
  const skuSeleccionado = productoSelect.value;
  
  if (!skuSeleccionado) {
    precioInput.value = '';
    return;
  }
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en cargarInfoProducto');
    return;
  }
  
  const producto = state.productos[skuSeleccionado];
  if (producto) {
    // Sugerir precio basado en el costo del proveedor
    precioInput.value = producto.cost || 0;
    
    // Mostrar alerta si el stock está bajo (umbral <= 3)
    if ((producto.stock || 0) <= 3) {
      alert(`⚠️ ALERTA: El producto "${producto.name}" tiene stock bajo (${producto.stock || 0} unidades)\n\nSe recomienda crear una orden de compra urgente.`);
    }
  }
  
  // Recalcular total
  calcularTotalOrden();
}

// Función para calcular el total de la orden
function calcularTotalOrden() {
  const cantidad = parseInt(document.getElementById('oc-cantidad').value) || 0;
  const precioUnitario = parseFloat(document.getElementById('oc-precio-unitario').value) || 0;
  const total = cantidad * precioUnitario;
  
  document.getElementById('oc-total').value = total.toFixed(2);
}

// Función para crear nueva orden de compra
function crearOrdenCompra(event) {
  if (event) event.preventDefault();
  
  const proveedor = document.getElementById('oc-proveedor').value;
  const fechaEntrega = document.getElementById('oc-fecha-entrega').value;
  const productoSku = document.getElementById('oc-producto').value;
  const cantidad = parseInt(document.getElementById('oc-cantidad').value);
  const precioUnitario = parseFloat(document.getElementById('oc-precio-unitario').value);
  const observaciones = document.getElementById('oc-observaciones').value;
  
  if (!proveedor || !fechaEntrega || !productoSku || !cantidad || !precioUnitario) {
    alert('Por favor completa todos los campos requeridos');
    return;
  }
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en crearOrdenCompra');
    alert('Error interno: state no válido');
    return;
  }
  
  const producto = state.productos[productoSku];
  if (!producto) {
    alert('Producto no encontrado');
    return;
  }
  
  const nuevaOrden = {
    id: Date.now().toString(),
    fechaCreacion: new Date().toISOString(),
    fechaEstimadaEntrega: fechaEntrega,
    proveedor: proveedor,
    productoSku: productoSku,
    productoNombre: producto.name,
    cantidad: cantidad,
    precioUnitario: precioUnitario,
    total: cantidad * precioUnitario,
    estado: 'Pendiente', // Pendiente, En Tránsito, Entregado, Cancelado
    observaciones: observaciones,
    fechaRealEntrega: null,
    diasEntrega: null,
    leadTimePromedio: null
  };
  
  // Agregar al estado
  state.ordenesCompra.push(nuevaOrden);
  
  // Actualizar producto con información de la orden
  if (!producto.ordenesCompra) {
    producto.ordenesCompra = [];
  }
  producto.ordenesCompra.push({
    ordenId: nuevaOrden.id,
    fechaCreacion: nuevaOrden.fechaCreacion,
    cantidad: cantidad,
    estado: nuevaOrden.estado
  });
  
  // Guardar cambios
  saveState();
  
  // Limpiar formulario
  limpiarFormOrden();
  
  // Actualizar vista
  renderOrdenesCompra();
  
  alert(`✅ Orden de compra creada exitosamente\n\n📋 Orden #${nuevaOrden.id}\n🏢 Proveedor: ${proveedor}\n📦 Producto: ${producto.name}\n💰 Total: ARS ${nuevaOrden.total.toFixed(2)}`);
}

// Función para limpiar formulario de orden
function limpiarFormOrden() {
  document.getElementById('orden-compra-form').reset();
  document.getElementById('oc-producto').innerHTML = '<option value="">Seleccionar producto...</option>';
  document.getElementById('oc-total').value = '';
}

// Función para renderizar órdenes de compra
function renderOrdenesCompra() {
  // Poblar select de proveedores
  const proveedorSelect = document.getElementById('oc-proveedor');
  if (proveedorSelect) {
    proveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    state.suppliers.forEach(supplier => {
      const option = document.createElement('option');
      option.value = supplier.name;
      option.textContent = supplier.name;
      proveedorSelect.appendChild(option);
    });
  }
  
  // Actualizar estadísticas
  actualizarEstadisticasOrdenes();
  
  // Renderizar tabla
  renderTablaOrdenes();
  
  // Actualizar reporte de cuentas por pagar
  renderReporteCuentasPagar();
}

// Función para actualizar estadísticas de órdenes
function actualizarEstadisticasOrdenes() {
  const ordenes = state.ordenesCompra || [];
  
  const pendientes = ordenes.filter(o => o.estado === 'Pendiente').length;
  const enTransito = ordenes.filter(o => o.estado === 'En Tránsito').length;
  const totalInvertido = ordenes
    .filter(o => o.estado === 'Pendiente' || o.estado === 'En Tránsito')
    .reduce((sum, o) => sum + o.total, 0);
  
  // Actualizar elementos en la UI
  const pendientesEl = document.getElementById('ordenes-pendientes');
  const transitoEl = document.getElementById('ordenes-transito');
  const invertidoEl = document.getElementById('total-invertido');
  
  if (pendientesEl) pendientesEl.textContent = pendientes;
  if (transitoEl) transitoEl.textContent = enTransito;
  if (invertidoEl) invertidoEl.textContent = `ARS ${totalInvertido.toFixed(2)}`;
}

// Función auxiliar para obtener información del primer producto de una orden
function getPrimerProductoInfo(orden) {
  if (orden.productos && orden.productos.length > 0) {
    const primerProducto = orden.productos[0];
    return {
      nombre: primerProducto.nombre,
      cantidad: primerProducto.cantidad,
      esMultiple: orden.productos.length > 1
    };
  }
  
  // Fallback para órdenes con estructura antigua
  return {
    nombre: orden.productoNombre || 'Producto no encontrado',
    cantidad: orden.cantidad || 0,
    esMultiple: false
  };
}

// Función para filtrar órdenes considerando múltiples productos
function filtrarOrdenesConProductos(ordenes, filtro) {
  if (!filtro.trim()) return ordenes;
  
  const filtroLower = filtro.toLowerCase();
  return ordenes.filter(o => {
    // Filtrar por proveedor
    if (o.proveedor && o.proveedor.toLowerCase().includes(filtroLower)) {
      return true;
    }
    
    // Filtrar por productos (nueva estructura)
    if (o.productos && Array.isArray(o.productos)) {
      return o.productos.some(producto => 
        producto.nombre && producto.nombre.toLowerCase().includes(filtroLower)
      );
    }
    
    // Filtrar por productoNombre (estructura antigua)
    if (o.productoNombre && o.productoNombre.toLowerCase().includes(filtroLower)) {
      return true;
    }
    
    return false;
  });
}

// Función para renderizar tabla de órdenes
function renderTablaOrdenes(filtro = '') {
  const tbody = document.querySelector('#tabla-ordenes-compra tbody');
  if (!tbody) return;
  
  const ordenes = state.ordenesCompra || [];
  
  // Filtrar órdenes considerando múltiples productos
  const ordenesFiltradas = filtrarOrdenesConProductos(ordenes, filtro);
  
  // Ordenar por fecha de creación (más recientes primero)
  ordenesFiltradas.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  
  tbody.innerHTML = '';
  
  ordenesFiltradas.forEach(orden => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f0f0f6';
    
    // Obtener información del primer producto
    const productoInfo = getPrimerProductoInfo(orden);
    
    // Calcular días de entrega
    const diasEntrega = calcularDiasEntrega(orden);
    
    // Determinar color del estado
    let colorEstado = '#6c757d';
    let bgEstado = '#f8f9fa';
    switch (orden.estado) {
      case 'Pendiente': colorEstado = '#ffc107'; bgEstado = '#fff3cd'; break;
      case 'En Tránsito': colorEstado = '#fd7e14'; bgEstado = '#ffeaa7'; break;
      case 'Entregado': colorEstado = '#28a745'; bgEstado = '#d4edda'; break;
      case 'Cancelado': colorEstado = '#dc3545'; bgEstado = '#f8d7da'; break;
    }
    
    tr.innerHTML = `
      <td style="padding:10px">${new Date(orden.fechaCreacion).toLocaleDateString()}</td>
      <td style="padding:10px">${orden.proveedor}</td>
      <td style="padding:10px">${productoInfo.nombre}${productoInfo.esMultiple ? ' <small style="color:#666">(+' + (orden.productos.length - 1) + ' más)</small>' : ''}</td>
      <td style="padding:10px;text-align:center">${productoInfo.cantidad}${productoInfo.esMultiple ? '<br><small style="color:#666">(' + orden.productos.length + ' productos)</small>' : ''}</td>
      <td style="padding:10px;text-align:right">ARS ${orden.total.toFixed(2)}</td>
      <td style="padding:10px;text-align:center">
        <span style="padding:4px 8px;border-radius:12px;background:${bgEstado};color:${colorEstado};font-size:12px;font-weight:600">
          ${orden.estado}
        </span>
      </td>
      <td style="padding:10px;text-align:center">
        ${diasEntrega !== null ? `<span style="color:${diasEntrega > 7 ? '#dc3545' : '#28a745'}">${diasEntrega} días</span>` : '-'}
      </td>
      <td style="padding:10px;text-align:center">
        <div style="display:flex;gap:3px;justify-content:center;flex-wrap:wrap">
          <!-- 👁️ Ver orden -->
          <button onclick="verDetalleOrden('${orden.id}')" style="background:#17a2b8;color:white;border:none;padding:4px 6px;border-radius:4px;font-size:11px" title="Ver detalles">👁️</button>
          
          <!-- 🔄 Cambiar estado -->
          <button onclick="abrirCambioEstado('${orden.id}')" style="background:#6f42c1;color:white;border:none;padding:4px 6px;border-radius:4px;font-size:11px" title="Cambiar estado">🔄</button>
          
          <!-- 🖨️ Imprimir -->
          <button onclick="imprimirOrden('${orden.id}')" style="background:#6c757d;color:white;border:none;padding:4px 6px;border-radius:4px;font-size:11px" title="Imprimir orden">🖨️</button>
          
          <!-- 📄 Exportar PDF -->
          <button onclick="exportarOrdenPDF('${orden.id}')" style="background:#fd7e14;color:white;border:none;padding:4px 6px;border-radius:4px;font-size:11px" title="Exportar a PDF">📄</button>
          
          <!-- 🗑️ Eliminar -->
          <button onclick="eliminarOrden('${orden.id}')" style="background:#dc3545;color:white;border:none;padding:4px 6px;border-radius:4px;font-size:11px" title="Eliminar orden">🗑️</button>
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
}

// Función para calcular días de entrega
function calcularDiasEntrega(orden) {
  if (orden.estado === 'Entregado' && orden.fechaRealEntrega) {
    const fechaCreacion = new Date(orden.fechaCreacion);
    const fechaEntrega = new Date(orden.fechaRealEntrega);
    return Math.ceil((fechaEntrega - fechaCreacion) / (1000 * 60 * 60 * 24));
  } else if (orden.estado === 'En Tránsito') {
    const fechaCreacion = new Date(orden.fechaCreacion);
    const hoy = new Date();
    return Math.ceil((hoy - fechaCreacion) / (1000 * 60 * 60 * 24));
  }
  return null;
}

// ✅ NUEVA FUNCIÓN: Ver detalles de una orden específica
function verDetalleOrden(ordenId) {
  // Validar state
  if (!validarState()) {
    console.error('❌ No se pudo validar state en verDetalleOrden');
    return;
  }
  
  const orden = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).find(o => o.id == ordenId);
  if (!orden) {
    alert('❌ Orden no encontrada');
    return;
  }
  
  // Calcular días de entrega
  const diasEntrega = calcularDiasEntrega(orden);
  
  // Construir contenido de la orden
  let contenido = `📋 DETALLE DE ORDEN DE COMPRA

🆔 ID: ${orden.id}
📅 Fecha Creación: ${new Date(orden.fechaCreacion).toLocaleDateString()}
🏢 Proveedor: ${orden.proveedor}
📦 Estado: ${orden.estado}
💰 Total: ARS ${orden.total.toFixed(2)}
${orden.fechaEntregaEstimada ? `📅 Fecha Estimada Entrega: ${new Date(orden.fechaEntregaEstimada).toLocaleDateString()}` : ''}
${diasEntrega ? `⏱️ Días en Proceso: ${diasEntrega}` : ''}

📦 PRODUCTOS:`;
  
  // Mostrar productos (manejar tanto arrays como objetos únicos)
  if (Array.isArray(orden.productos)) {
    orden.productos.forEach((producto, index) => {
      contenido += `
  ${index + 1}. ${producto.nombre} (${producto.sku})
     Cantidad: ${producto.cantidad}
     Precio Unit.: ARS ${producto.precioUnitario.toFixed(2)}
     Subtotal: ARS ${producto.subtotal.toFixed(2)}`;
    });
  } else {
    // Orden del sistema anterior con producto único
    contenido += `
  1. ${orden.productoNombre} (${orden.productoSKU})
     Cantidad: ${orden.cantidad}
     Total: ARS ${orden.total.toFixed(2)}`;
  }
  
  if (orden.observaciones) {
    contenido += `
📝 OBSERVACIONES: ${orden.observaciones}`;
  }
  
  contenido += `

💡 Presiona OK para continuar.`;
  
  alert(contenido);
}

// ✅ NUEVA FUNCIÓN: Abrir modal para cambiar estado
function abrirCambioEstado(ordenId) {
  // ✅ CORREGIR: Comparación consistente de IDs
  const orden = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).find(o => 
    o.id == ordenId || o.id === ordenId
  );
  if (!orden) {
    console.error('❌ Orden no encontrada con ID:', ordenId);
    alert('❌ Orden no encontrada');
    return;
  }
  
  const estadosDisponibles = ['Pendiente', 'En Tránsito', 'Entregado', 'Cancelado'];
  const estadoActual = orden.estado;
  
  let mensaje = `🔄 CAMBIAR ESTADO DE ORDEN\n\n📋 ID: ${orden.id}\n🏢 Proveedor: ${orden.proveedor}\n📦 Estado Actual: ${estadoActual}\n\nSelecciona el nuevo estado:\n\n`;
  
  estadosDisponibles.forEach((estado, index) => {
    const indicador = estado === estadoActual ? ' (ACTUAL)' : '';
    mensaje += `${index + 1}. ${estado}${indicador}\n`;
  });
  
  mensaje += `\n0. Cancelar\n\nIngresa el número del nuevo estado:`;
  
  const opcion = prompt(mensaje);
  
  if (opcion === null || opcion === '0') {
    return; // Cancelar
  }
  
  const nuevoEstado = estadosDisponibles[parseInt(opcion) - 1];
  
  if (!nuevoEstado) {
    alert('❌ Opción inválida');
    return;
  }
  
  if (nuevoEstado === estadoActual) {
    alert('ℹ️ El estado seleccionado es igual al actual');
    return;
  }
  
  // Confirmar cambio
  const confirmar = confirm(`¿Confirmas cambiar el estado de "${estadoActual}" a "${nuevoEstado}"?`);
  if (!confirmar) {
    return;
  }
  
  cambiarEstadoOrden(ordenId, nuevoEstado);
}

// ✅ NUEVA FUNCIÓN: Imprimir orden específica
function imprimirOrden(ordenId) {
  const orden = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).find(o => o.id == ordenId);
  if (!orden) {
    alert('❌ Orden no encontrada');
    return;
  }
  
  // Crear contenido HTML para imprimir una orden específica
  const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>Orden de Compra #${orden.id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .order-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .info-box { border: 1px solid #000; padding: 15px; }
        .info-box h3 { margin-top: 0; }
        .products { margin-top: 30px; }
        .products table { width: 100%; border-collapse: collapse; }
        .products th, .products td { border: 1px solid #000; padding: 8px; text-align: left; }
        .products th { background-color: #f0f0f0; }
        .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ORDEN DE COMPRA</h1>
        <h2>#${orden.id}</h2>
      </div>
      
      <div class="order-info">
        <div class="info-box">
          <h3>📋 Información de la Orden</h3>
          <p><strong>Fecha:</strong> ${new Date(orden.fechaCreacion).toLocaleDateString()}</p>
          <p><strong>Estado:</strong> ${orden.estado}</p>
          ${orden.fechaEntregaEstimada ? `<p><strong>Fecha Estimada:</strong> ${new Date(orden.fechaEntregaEstimada).toLocaleDateString()}</p>` : ''}
        </div>
        
        <div class="info-box">
          <h3>🏢 Información del Proveedor</h3>
          <p><strong>Proveedor:</strong> ${orden.proveedor}</p>
        </div>
      </div>
      
      <div class="products">
        <h3>📦 Productos</h3>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${Array.isArray(orden.productos) ? 
              orden.productos.map(p => `
                <tr>
                  <td>${p.nombre} (${p.sku})</td>
                  <td>${p.cantidad}</td>
                  <td>ARS ${p.precioUnitario.toFixed(2)}</td>
                  <td>ARS ${p.subtotal.toFixed(2)}</td>
                </tr>
              `).join('') :
              `
                <tr>
                  <td>${orden.productoNombre} (${orden.productoSKU})</td>
                  <td>${orden.cantidad}</td>
                  <td>ARS ${(orden.total / orden.cantidad).toFixed(2)}</td>
                  <td>ARS ${orden.total.toFixed(2)}</td>
                </tr>
              `
            }
          </tbody>
        </table>
        
        <div class="total">
          💰 TOTAL: ARS ${orden.total.toFixed(2)}
        </div>
      </div>
      
      ${orden.observaciones ? `
        <div style="margin-top: 30px;">
          <h3>📝 Observaciones</h3>
          <p>${orden.observaciones}</p>
        </div>
      ` : ''}
    </body>
    </html>
  `;
  
  // Abrir en nueva ventana e imprimir
  const ventanaImpresion = window.open('', '_blank');
  ventanaImpresion.document.write(html);
  ventanaImpresion.document.close();
  
  setTimeout(() => {
    ventanaImpresion.print();
  }, 500);
}

// ✅ NUEVA FUNCIÓN: Exportar orden específica a PDF
// ✅ NUEVA FUNCIÓN: Exportar orden a PDF real
function exportarOrdenPDF(ordenId) {
  console.log(`📄 Generando PDF para orden ${ordenId}`);
  
  const orden = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).find(o => o.id == ordenId);
  if (!orden) {
    alert('❌ Orden no encontrada');
    return;
  }
  
  // ✅ CORREGIR: Verificar que html2pdf esté disponible
  if (typeof html2pdf === 'undefined') {
    alert('❌ Error: Librería de PDF no cargada. Recarga la página e intenta nuevamente.');
    return;
  }
  
  // Crear elemento temporal para el PDF
  const elementoPDF = document.createElement('div');
  elementoPDF.style.cssText = `
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background: white;
    color: black;
  `;
  
  // Generar contenido del PDF
  const fechaCreacion = new Date(orden.fechaCreacion).toLocaleDateString();
  const fechaEstimada = orden.fechaEntregaEstimada ? new Date(orden.fechaEntregaEstimada).toLocaleDateString() : 'No especificada';
  
  let productosHTML = '';
  if (Array.isArray(orden.productos)) {
    // Nueva estructura con múltiples productos
    productosHTML = orden.productos.map(p => `
      <tr>
        <td style="border: 1px solid #000; padding: 8px;">${p.nombre}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${p.cantidad}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">ARS ${p.precioUnitario.toFixed(2)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">ARS ${p.subtotal.toFixed(2)}</td>
      </tr>
    `).join('');
  } else {
    // Estructura antigua con producto único
    const precioUnitario = orden.cantidad ? (orden.total / orden.cantidad).toFixed(2) : orden.total.toFixed(2);
    productosHTML = `
      <tr>
        <td style="border: 1px solid #000; padding: 8px;">${orden.productoNombre || 'Producto no especificado'}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${orden.cantidad || 1}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">ARS ${precioUnitario}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">ARS ${orden.total.toFixed(2)}</td>
      </tr>
    `;
  }
  
  const observacionesHTML = orden.observaciones ? `
    <div style="margin-top: 30px; padding: 15px; border: 1px solid #ccc;">
      <h3 style="margin-top: 0; color: #333;">📝 Observaciones</h3>
      <p style="margin: 0; line-height: 1.5;">${orden.observaciones}</p>
    </div>
  ` : '';
  
  elementoPDF.innerHTML = `
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; color: #333;">ORDEN DE COMPRA</h1>
      <h2 style="margin: 10px 0 0 0; color: #666;">#${orden.id}</h2>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
      <div style="border: 1px solid #000; padding: 15px;">
        <h3 style="margin-top: 0; color: #333;">📋 Información de la Orden</h3>
        <p style="margin: 5px 0;"><strong>Fecha:</strong> ${fechaCreacion}</p>
        <p style="margin: 5px 0;"><strong>Estado:</strong> ${orden.estado}</p>
        <p style="margin: 5px 0;"><strong>Fecha Estimada:</strong> ${fechaEstimada}</p>
      </div>
      
      <div style="border: 1px solid #000; padding: 15px;">
        <h3 style="margin-top: 0; color: #333;">🏢 Información del Proveedor</h3>
        <p style="margin: 5px 0;"><strong>Proveedor:</strong> ${orden.proveedor}</p>
      </div>
    </div>
    
    <div style="margin-top: 30px;">
      <h3 style="color: #333;">📦 Productos</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #000; padding: 8px; text-align: left;">Producto</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Cantidad</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right;">Precio Unit.</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${productosHTML}
        </tbody>
      </table>
      
      <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; padding: 10px; background-color: #f8f9fa;">
        💰 TOTAL: ARS ${orden.total.toFixed(2)}
      </div>
    </div>
    
    ${observacionesHTML}
    
    <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
      <p>Documento generado el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}</p>
    </div>
  `;
  
  // Configuración del PDF
  const opciones = {
    margin: [10, 10, 10, 10],
    filename: `orden-compra-${orden.id}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      letterRendering: true
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    }
  };
  
  console.log('📄 Iniciando generación de PDF...');
  
  // Mostrar indicador de carga
  alert('⏳ Generando PDF... Por favor espera');
  
  // Generar y descargar PDF
  html2pdf()
    .set(opciones)
    .from(elementoPDF)
    .save()
    .then(() => {
      console.log('✅ PDF generado y descargado exitosamente');
      alert(`✅ PDF generado exitosamente\n📄 Archivo: orden-compra-${orden.id}.pdf`);
    })
    .catch((error) => {
      console.error('❌ Error generando PDF:', error);
      alert('❌ Error generando PDF. Intenta nuevamente.');
    });
}

// Función para cambiar estado de orden
function cambiarEstadoOrden(ordenId, nuevoEstado) {
  console.log(`🔄 Cambiando estado de orden ${ordenId} a ${nuevoEstado}`);
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en cambiarEstadoOrden');
    return;
  }
  
  // ✅ CORREGIR: Comparación consistente de IDs
  const orden = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).find(o => 
    o.id == ordenId || o.id === ordenId
  );
  if (!orden) {
    console.error('❌ Orden no encontrada en cambiarEstadoOrden con ID:', ordenId);
    return;
  }
  
  const estadoAnterior = orden.estado;
  console.log(`📋 Estado anterior: ${estadoAnterior} → ${nuevoEstado}`);
  
  orden.estado = nuevoEstado;
  console.log(`✅ Estado actualizado en el objeto orden`);
  
  if (nuevoEstado === 'Entregado') {
    orden.fechaRealEntrega = new Date().toISOString();
    orden.diasEntrega = calcularDiasEntrega(orden);
    
    // Actualizar lead time promedio del proveedor
    actualizarLeadTimeProveedor(orden.proveedor, orden.diasEntrega);
    
    // ✅ CORREGIR: Actualizar stock para todos los productos en la orden
    if (orden.productos && Array.isArray(orden.productos)) {
      orden.productos.forEach(productoOrden => {
        const producto = state.productos[productoOrden.sku];
        if (producto) {
          producto.stock = (producto.stock || 0) + productoOrden.cantidad;
          console.log(`✅ Stock actualizado: ${producto.name} +${productoOrden.cantidad}`);
        }
      });
    }
    
    // Fallback para órdenes con estructura antigua
    else if (orden.productoSku && orden.cantidad) {
      const producto = state.productos[orden.productoSku];
      if (producto) {
        producto.stock = (producto.stock || 0) + orden.cantidad;
        console.log(`✅ Stock actualizado (legacy): ${producto.name} +${orden.cantidad}`);
      }
    }
  }
  
  // ✅ CORREGIR: Actualizar información en todos los productos de la orden
  if (orden.productos && Array.isArray(orden.productos)) {
    orden.productos.forEach(productoOrden => {
      const producto = state.productos[productoOrden.sku];
      if (producto && producto.ordenesCompra) {
        const ordenProducto = producto.ordenesCompra.find(oc => oc.ordenId === ordenId);
        if (ordenProducto) {
          ordenProducto.estado = nuevoEstado;
          if (nuevoEstado === 'Entregado') {
            ordenProducto.fechaEntrega = orden.fechaRealEntrega;
          }
        }
      }
    });
  }
  
  // Fallback para órdenes con estructura antigua
  else if (orden.productoSku) {
    const producto = state.productos[orden.productoSku];
    if (producto && producto.ordenesCompra) {
      const ordenProducto = producto.ordenesCompra.find(oc => oc.ordenId === ordenId);
      if (ordenProducto) {
        ordenProducto.estado = nuevoEstado;
        if (nuevoEstado === 'Entregado') {
          ordenProducto.fechaEntrega = orden.fechaRealEntrega;
        }
      }
    }
  }
  
  console.log(`💾 Guardando cambios...`);
  
  // Guardar cambios
  saveState();
  
  console.log(`🔄 Actualizando vista...`);
  
  // ✅ OPTIMIZAR: Solo actualizar tabla y estadísticas, no todo el reporte
  actualizarEstadisticasOrdenes();
  renderTablaOrdenes();
  
  // 🔄 Actualizar kardex automáticamente si se recibió la orden
  if (nuevoEstado === 'Entregado') {
    actualizarKardexAutomatico();
  }
  
  console.log(`✅ Cambio de estado completado: ${estadoAnterior} → ${nuevoEstado}`);
  
  alert(`✅ Orden actualizada: ${estadoAnterior} → ${nuevoEstado}`);
}

// Función para actualizar lead time promedio del proveedor
function actualizarLeadTimeProveedor(proveedor, diasEntrega) {
  const ordenesProveedor = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).filter(o => 
    o.proveedor === proveedor && o.estado === 'Entregado' && o.diasEntrega
  );
  
  if (ordenesProveedor.length > 0) {
    const totalDias = ordenesProveedor.reduce((sum, o) => sum + o.diasEntrega, 0);
    const promedio = Math.round(totalDias / ordenesProveedor.length);
    
    // Actualizar proveedor con lead time
    const supplier = state.suppliers.find(s => s.name === proveedor);
    if (supplier) {
      supplier.leadTimePromedio = promedio;
    }
  }
}

// Función para eliminar orden
function eliminarOrden(ordenId) {
  console.log(`🗑️ Iniciando eliminación de orden ${ordenId}`);
  
  if (!confirm('¿Estás seguro que quieres eliminar esta orden de compra?')) {
    console.log('❌ Usuario canceló la eliminación');
    return;
  }
  
  // ✅ CORRECCIÓN: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en eliminarOrden');
    alert('❌ Error: No se puede validar el estado del sistema');
    return;
  }
  
  // ✅ CORRECCIÓN: Usar comparación flexible de IDs
  const orden = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).find(o => 
    o.id == ordenId || o.id === ordenId
  );
  
  if (!orden) {
    console.error('❌ Orden no encontrada para eliminar:', ordenId);
    alert('❌ Orden no encontrada');
    return;
  }
  
  console.log('📋 Orden encontrada:', orden);
  
  // Remover de la lista de órdenes usando comparación flexible
  const ordenIndex = state.ordenesCompra.findIndex(o => o.id == ordenId || o.id === ordenId);
  if (ordenIndex === -1) {
    console.error('❌ No se pudo encontrar el índice de la orden:', ordenId);
    alert('❌ Error: No se pudo localizar la orden para eliminar');
    return;
  }
  
  console.log(`📍 Índice de orden encontrado: ${ordenIndex}`);
  
  // Remover orden del array principal
  state.ordenesCompra.splice(ordenIndex, 1);
  console.log('✅ Orden removida del array principal');
  
  // ✅ CORRECCIÓN: Manejar tanto estructura antigua como nueva
  if (orden.productos && Array.isArray(orden.productos)) {
    // Nueva estructura: múltiples productos
    console.log('🔄 Procesando orden con múltiples productos');
    
    orden.productos.forEach(productoOrden => {
      const producto = state.productos[productoOrden.sku];
      if (producto && producto.ordenesCompra) {
        producto.ordenesCompra = producto.ordenesCompra.filter(oc => oc.ordenId != ordenId && oc.ordenId !== ordenId);
        console.log(`📦 Referencia removida del producto: ${productoOrden.sku}`);
      }
    });
    
    // Actualizar estado del pedido para todos los productos
    orden.productos.forEach(productoOrden => {
      const producto = state.productos[productoOrden.sku];
      if (producto) {
        producto.pedidoEstado = 'Pedir stock';
        console.log(`📝 Estado de pedido actualizado para: ${productoOrden.sku}`);
      }
    });
  } else if (orden.productoSku) {
    // Estructura antigua: producto único
    console.log('🔄 Procesando orden con producto único');
    
    const producto = state.productos[orden.productoSku];
    if (producto && producto.ordenesCompra) {
      producto.ordenesCompra = producto.ordenesCompra.filter(oc => oc.ordenId != ordenId && oc.ordenId !== ordenId);
      producto.pedidoEstado = 'Pedir stock';
      console.log(`📦 Referencia removida del producto: ${orden.productoSku}`);
    }
  }
  
  // Guardar cambios
  console.log('💾 Guardando cambios...');
  saveState();
  console.log('✅ Cambios guardados');
  
  // Actualizar vistas
  renderOrdenesCompra();
  console.log('✅ Vista de órdenes actualizada');
  
  // Si estamos en la vista de pedidos, refrescarla también
  const pedidosView = document.getElementById('pedidos');
  if (pedidosView && pedidosView.style.display !== 'none') {
    renderPedidos();
    console.log('✅ Vista de pedidos actualizada');
  }
  
  alert(`🗑️ Orden de compra #${ordenId} eliminada exitosamente`);
  console.log(`✅ Eliminación completada para orden ${ordenId}`);
}

// Función para filtrar órdenes
function filtrarOrdenes() {
  const filtro = document.getElementById('buscar-orden').value;
  renderTablaOrdenes(filtro);
}

// Función para renderizar reporte de cuentas por pagar
function renderReporteCuentasPagar() {
  const container = document.getElementById('reporte-cuentas-pagar');
  if (!container) return;
  
  const ordenesPendientes = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).filter(o => 
    o.estado === 'Pendiente' || o.estado === 'En Tránsito'
  );
  
  if (ordenesPendientes.length === 0) {
    container.innerHTML = '<p style="color:#28a745;margin:0">✅ No hay cuentas por pagar pendientes</p>';
    return;
  }
  
  // Agrupar por proveedor
  const porProveedor = {};
  ordenesPendientes.forEach(orden => {
    if (!porProveedor[orden.proveedor]) {
      porProveedor[orden.proveedor] = { total: 0, ordenes: [] };
    }
    porProveedor[orden.proveedor].total += orden.total;
    porProveedor[orden.proveedor].ordenes.push(orden);
  });
  
  let html = '<div style="display:grid;gap:10px">';
  
  Object.entries(porProveedor).forEach(([proveedor, datos]) => {
    html += `
      <div style="background:white;border:1px solid #dee2e6;border-radius:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h5 style="margin:0;color:#026669">${proveedor}</h5>
          <span style="font-weight:bold;color:#dc3545">ARS ${datos.total.toFixed(2)}</span>
        </div>
        <div style="font-size:13px;color:#6c757d">
          ${datos.ordenes.length} orden(es) pendiente(s)
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  const totalGeneral = ordenesPendientes.reduce((sum, o) => sum + o.total, 0);
  html += `
    <div style="margin-top:15px;padding:12px;background:#dc3545;color:white;border-radius:8px;text-align:center">
      <strong>TOTAL POR PAGAR: ARS ${totalGeneral.toFixed(2)}</strong>
    </div>
  `;
  
  container.innerHTML = html;
}

// Función para limpiar todas las órdenes
function limpiarOrdenesCompra() {
  if (!confirm('¿Estás seguro que quieres eliminar TODAS las órdenes de compra?')) return;
  
  // Validar que ordenesCompra es un array antes de limpiar
  if (Array.isArray(state.ordenesCompra)) {
    state.ordenesCompra = [];
  }
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en limpiarOrdenesCompra');
    return;
  }
  
  // Limpiar referencias en productos
  Object.values(state.productos).forEach(producto => {
    if (producto.ordenesCompra) {
      delete producto.ordenesCompra;
    }
  });
  
  // Guardar cambios
  saveState();
  
  // Actualizar vista
  renderOrdenesCompra();
  
  alert('🧹 Todas las órdenes de compra han sido eliminadas');
}

// Función para obtener lead time promedio de un proveedor
function getLeadTimeProveedor(proveedor) {
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en getLeadTimeProveedor');
    return null;
  }
  
  const ordenesEntregadas = (Array.isArray(state.ordenesCompra) ? state.ordenesCompra : []).filter(o => 
    o.proveedor === proveedor && o.estado === 'Entregado' && o.diasEntrega
  );
  
  if (ordenesEntregadas.length === 0) return null;
  
  const totalDias = ordenesEntregadas.reduce((sum, o) => sum + o.diasEntrega, 0);
  return Math.round(totalDias / ordenesEntregadas.length);
}

// Función para mostrar información de órdenes en el producto
function mostrarInfoOrdenesProducto(sku) {
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en mostrarInfoOrdenesProducto');
    return 'Error interno: state no válido';
  }
  
  const producto = state.productos[sku];
  if (!producto || !producto.ordenesCompra || producto.ordenesCompra.length === 0) {
    return 'No hay órdenes activas para este producto';
  }
  
  const ordenesActivas = producto.ordenesCompra.filter(oc => 
    oc.estado === 'Pendiente' || oc.estado === 'En Tránsito'
  );
  
  if (ordenesActivas.length === 0) {
    return 'No hay órdenes activas';
  }
  
  let info = `📋 ${ordenesActivas.length} orden(es) activa(s):\n`;
  ordenesActivas.forEach(oc => {
    info += `• ${oc.estado} - ${oc.cantidad} unidades\n`;
  });
  
  return info;
}

// Función para navegar a las órdenes de un proveedor específico
function navegarAOrdenesProveedor(nombreProveedor) {
  // Navegar a la sección de compras
  navigate('compras');
  
  // Filtrar las órdenes para mostrar solo las del proveedor
  setTimeout(() => {
    const searchInput = document.getElementById('buscar-orden');
    if (searchInput) {
      searchInput.value = nombreProveedor;
      filtrarOrdenes();
    }
  }, 100);
  
  alert(`📋 Mostrando órdenes del proveedor: ${nombreProveedor}`);
}

// Función para abrir modal de nueva orden de compra
function abrirModalNuevaOrden() {
  // ✅ DEBUG: Verificar estado de productos y proveedores
  console.log('🔍 DEBUG MODAL - Estado de productos y proveedores:');
  console.log('📦 Total productos:', Object.keys(state.productos || {}).length);
  console.log('🏢 Total proveedores:', (state.suppliers || []).length);
  
  // ✅ MEJORA: Mostrar suppliers únicos de productos (más preciso)
  const suppliersEnProductos = [...new Set(
    Object.values(state.productos || {})
      .map(p => p.supplier || p.proveedor)
      .filter(s => s && s.trim() !== '')
  )].sort();
  
  console.log('🏢 Suppliers únicos encontrados en productos:', suppliersEnProductos);
  
  // Mostrar proveedores legacy (state.suppliers) para referencia
  if (state.suppliers && state.suppliers.length > 0) {
    console.log('🏢 Proveedores legacy (state.suppliers):');
    state.suppliers.forEach(s => {
      console.log(`  - ${s.name}`);
    });
  }
  
  // Mostrar algunos productos de ejemplo para ver su estructura
  console.log('📋 Primeros 3 productos de ejemplo:');
  const productosEjemplo = Object.values(state.productos || {}).slice(0, 3);
  productosEjemplo.forEach(p => {
    console.log(`  - ${p.name} (${p.sku}): stock=${p.stock}, supplier="${p.supplier}"`);
  });
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center';
  
  console.log('🏢 Suppliers únicos encontrados en productos:', suppliersEnProductos);
  
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:15px;max-width:600px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 10px 30px rgba(0,0,0,0.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="margin:0;color:#026669">📋 Nueva Orden de Compra</h3>
        <button onclick="this.closest('.modal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999">×</button>
      </div>
      
      <form id="modal-orden-form" onsubmit="crearOrdenCompraModal(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px">
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold">Proveedor *</label>
            <select id="modal-proveedor" required onchange="cargarProductosProveedorModal()" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px">
              <option value="">Seleccionar proveedor...</option>
              ${suppliersEnProductos.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold">Fecha Estimada Entrega *</label>
            <input id="modal-fecha-entrega" type="date" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px" />
          </div>
        </div>
        
        <!-- ✅ NUEVA SECCIÓN: MÚLTIPLES PRODUCTOS -->
        <div style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <label style="font-weight:bold;color:#026669">📦 Productos de la Orden</label>
            <button type="button" onclick="agregarFilaProducto()" style="padding:8px 16px;background:#007bff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px">
              ➕ Agregar Producto
            </button>
          </div>
          
          <div id="productos-container" style="border:1px solid #ddd;border-radius:8px;overflow:hidden">
            <!-- Headers de la tabla -->
            <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:1px;background:#f8f9fa;font-weight:bold;padding:10px;font-size:12px;color:#495057">
              <div>Producto</div>
              <div>Cantidad</div>
              <div>Precio Unit.</div>
              <div>Subtotal</div>
              <div>Acciones</div>
            </div>
            
            <!-- Primera fila de producto (agregada automáticamente) -->
            <div class="producto-row" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:1px;background:#f8f9fa;align-items:center">
              <div style="padding:10px">
                <select class="producto-select" onchange="cargarInfoProductoFila(this)" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:12px">
                  <option value="">Seleccionar producto...</option>
                </select>
              </div>
              <div style="padding:10px">
                <input type="number" class="cantidad-input" min="1" value="1" onchange="calcularTotalOrden()" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:12px">
              </div>
              <div style="padding:10px">
                <input type="number" class="precio-input" step="0.01" onchange="calcularTotalOrden()" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:12px">
              </div>
              <div style="padding:10px">
                <span class="subtotal-display" style="font-weight:bold;color:#28a745">$0.00</span>
              </div>
              <div style="padding:10px">
                <button type="button" onclick="eliminarFilaProducto(this)" style="background:#dc3545;color:white;border:none;border-radius:4px;padding:8px;cursor:pointer;font-size:12px">
                  🗑️
                </button>
              </div>
            </div>
          </div>
          
          <!-- Total general -->
          <div style="display:flex;justify-content:flex-end;margin-top:15px;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-weight:bold;color:#495057">💰 Total de la Orden:</span>
              <span id="total-orden" style="font-size:18px;font-weight:bold;color:#28a745">$0.00</span>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom:20px">
          <label style="display:block;margin-bottom:5px;font-weight:bold">Observaciones</label>
          <textarea id="modal-observaciones" rows="3" placeholder="Detalles adicionales sobre la orden..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;resize:vertical"></textarea>
        </div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" onclick="this.closest('.modal').remove()" style="padding:12px 24px;border:1px solid #ddd;border-radius:8px;cursor:pointer">Cancelar</button>
          <button type="submit" style="padding:12px 24px;background:linear-gradient(135deg,#28a745,#20c997);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold">📋 Crear Orden</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Cerrar modal al hacer clic fuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ✅ FUNCIÓN CORREGIDA: Cargar productos del proveedor seleccionado en TODOS los selects del modal
// ✅ FUNCIÓN CORREGIDA: Cargar productos del proveedor seleccionado en TODOS los selects del modal
function cargarProductosProveedorModal() {
  console.log('\n🔄 === ACTUALIZANDO PRODUCTOS EN MODAL DE MÚLTIPLES PRODUCTOS === 🔄');
  
  // ✅ USAR LA FUNCIÓN CORRECTA PARA EL NUEVO SISTEMA DE MÚLTIPLES PRODUCTOS
  cargarProductosEnTodosLosSelects();
  
  // ✅ RECALCULAR TOTALES DESPUÉS DE CARGAR PRODUCTOS
  calcularTotalOrden();
}

// ❌ FUNCIÓN OBSOLETA - Sistema anterior de un solo producto
// Ahora se usa cargarInfoProductoFila() para el sistema de múltiples productos
function cargarInfoProductoModal() {
  // Esta función ya no se usa - mantener por compatibilidad
  console.warn('⚠️ cargarInfoProductoModal() está obsoleta. Usar cargarInfoProductoFila() en su lugar.');
}

// ❌ FUNCIÓN OBSOLETA - Sistema anterior de un solo producto  
// Ahora se usa calcularTotalOrden() para el sistema de múltiples productos
function calcularTotalOrdenModal() {
  // Esta función ya no se usa - mantener por compatibilidad
  console.warn('⚠️ calcularTotalOrdenModal() está obsoleta. Usar calcularTotalOrden() en su lugar.');
  const cantidad = parseFloat(document.getElementById('modal-cantidad').value) || 0;
  const precioUnitario = parseFloat(document.getElementById('modal-precio-unitario').value) || 0;
  const total = cantidad * precioUnitario;
  document.getElementById('modal-total').value = total.toFixed(2);
}

// ✅ NUEVAS FUNCIONES PARA MÚLTIPLES PRODUCTOS

// Agregar una nueva fila de producto al modal
function agregarFilaProducto() {
  const container = document.getElementById('productos-container');
  const proveedorSeleccionado = document.getElementById('modal-proveedor').value;
  
  // Crear nueva fila
  const nuevaFila = document.createElement('div');
  nuevaFila.className = 'producto-row';
  nuevaFila.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:1px;background:#f8f9fa;align-items:center';
  
  nuevaFila.innerHTML = `
    <div style="padding:10px">
      <select class="producto-select" onchange="cargarInfoProductoFila(this)" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:12px">
        <option value="">Seleccionar producto...</option>
      </select>
    </div>
    <div style="padding:10px">
      <input type="number" class="cantidad-input" min="1" value="1" onchange="calcularTotalOrden()" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:12px">
    </div>
    <div style="padding:10px">
      <input type="number" class="precio-input" step="0.01" onchange="calcularTotalOrden()" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:12px">
    </div>
    <div style="padding:10px">
      <span class="subtotal-display" style="font-weight:bold;color:#28a745">$0.00</span>
    </div>
    <div style="padding:10px">
      <button type="button" onclick="eliminarFilaProducto(this)" style="background:#dc3545;color:white;border:none;border-radius:4px;padding:8px;cursor:pointer;font-size:12px">
        🗑️
      </button>
    </div>
  `;
  
  container.appendChild(nuevaFila);
  
  // Cargar productos en el nuevo select
  const nuevoSelect = nuevaFila.querySelector('.producto-select');
  cargarProductosEnSelect(nuevoSelect, proveedorSeleccionado);
  
  console.log('➕ Nueva fila de producto agregada');
}

// Eliminar una fila de producto
function eliminarFilaProducto(boton) {
  const filas = document.querySelectorAll('.producto-row');
  if (filas.length <= 1) {
    alert('❌ Debe mantener al menos un producto en la orden');
    return;
  }
  
  const fila = boton.closest('.producto-row');
  fila.remove();
  calcularTotalOrden();
  console.log('🗑️ Fila de producto eliminada');
}

// Cargar información del producto en una fila específica
function cargarInfoProductoFila(select) {
  const fila = select.closest('.producto-row');
  const precioInput = fila.querySelector('.precio-input');
  const sku = select.value;
  
  if (sku && state.productos[sku]) {
    const producto = state.productos[sku];
    precioInput.value = producto.cost || 0;
  } else {
    precioInput.value = '';
  }
  
  calcularTotalOrden();
}

// Calcular el total general de la orden
function calcularTotalOrden() {
  let totalGeneral = 0;
  const filas = document.querySelectorAll('.producto-row');
  
  filas.forEach(fila => {
    const cantidad = parseFloat(fila.querySelector('.cantidad-input').value) || 0;
    const precio = parseFloat(fila.querySelector('.precio-input').value) || 0;
    const subtotal = cantidad * precio;
    
    // Actualizar subtotal de la fila
    const subtotalDisplay = fila.querySelector('.subtotal-display');
    subtotalDisplay.textContent = `$${subtotal.toFixed(2)}`;
    
    totalGeneral += subtotal;
  });
  
  // Actualizar total general
  document.getElementById('total-orden').textContent = `$${totalGeneral.toFixed(2)}`;
}

// Cargar productos en un select específico
function cargarProductosEnSelect(select, proveedor) {
  select.innerHTML = '<option value="">Seleccionar producto...</option>';
  
  if (!proveedor) {
    console.log('⚠️ No hay proveedor seleccionado para cargar productos');
    return;
  }
  
  const productosDelProveedor = Object.values(state.productos || {}).filter(p => {
    return p && (p.supplier === proveedor || p.proveedor === proveedor);
  });
  
  productosDelProveedor.forEach(producto => {
    const option = document.createElement('option');
    option.value = producto.sku;
    option.textContent = `${producto.name} (${producto.sku})`;
    select.appendChild(option);
  });
  
  console.log(`📦 Cargados ${productosDelProveedor.length} productos para proveedor "${proveedor}"`);
}

// ✅ NUEVA FUNCIÓN: Cargar productos en todos los selects de la tabla
function cargarProductosEnTodosLosSelects() {
  const proveedorSeleccionado = document.getElementById('modal-proveedor').value;
  const selects = document.querySelectorAll('.producto-select');
  
  console.log('🔄 Actualizando', selects.length, 'selects de productos para proveedor:', proveedorSeleccionado);
  
  selects.forEach((select, index) => {
    cargarProductosEnSelect(select, proveedorSeleccionado);
  });
}

// Función para crear orden desde el modal
function crearOrdenCompraModal(event) {
  event.preventDefault();
  
  const proveedor = document.getElementById('modal-proveedor').value;
  const fechaEntrega = document.getElementById('modal-fecha-entrega').value;
  // ✅ CAMBIO: Ahora se recopilan múltiples productos de las filas
  const observaciones = document.getElementById('modal-observaciones').value;
  
  // Validar campos básicos
  if (!proveedor || !fechaEntrega) {
    alert('❌ Por favor complete el proveedor y la fecha de entrega');
    return;
  }
  
  // ✅ CORRECCIÓN ERROR FOREACH: Validar state antes de acceder a productos
  if (!validarState()) {
    console.error('❌ No se pudo validar state en crearOrdenCompraModal');
    alert('Error interno: state no válido');
    return;
  }
  
  // Recopilar todos los productos de todas las filas
  const filas = document.querySelectorAll('.producto-row');
  const productosOrden = [];
  let totalOrden = 0;
  
  console.log('🔍 Procesando', filas.length, 'filas de productos');
  
  filas.forEach((fila, index) => {
    const productoSelect = fila.querySelector('.producto-select');
    const cantidadInput = fila.querySelector('.cantidad-input');
    const precioInput = fila.querySelector('.precio-input');
    
    const sku = productoSelect.value;
    const cantidad = parseInt(cantidadInput.value) || 0;
    const precioUnitario = parseFloat(precioInput.value) || 0;
    
    console.log(`📋 Fila ${index + 1}: SKU=${sku}, Cantidad=${cantidad}, Precio=${precioUnitario}`);
    
    // Validar fila
    if (!sku || !cantidad || !precioUnitario) {
      console.warn(`⚠️ Fila ${index + 1} incompleta, saltando...`);
      return; // Saltar filas incompletas
    }
    
    const producto = state.productos[sku];
    if (!producto) {
      console.error(`❌ Producto ${sku} no encontrado en fila ${index + 1}`);
      alert(`❌ Error: Producto no encontrado en fila ${index + 1}`);
      return;
    }
    
    const subtotal = cantidad * precioUnitario;
    totalOrden += subtotal;
    
    productosOrden.push({
      sku: sku,
      nombre: producto.name,
      cantidad: cantidad,
      precioUnitario: precioUnitario,
      subtotal: subtotal
    });
    
    console.log(`✅ Producto agregado: ${producto.name} - ${cantidad} x $${precioUnitario} = $${subtotal}`);
  });
  
  // Validar que hay productos válidos
  if (productosOrden.length === 0) {
    alert('❌ Debe agregar al menos un producto válido a la orden');
    return;
  }
  
  console.log(`🎯 Total productos válidos: ${productosOrden.length}`);
  console.log(`💰 Total orden: $${totalOrden.toFixed(2)}`);
  
  // Crear la nueva orden
  const nuevaOrden = {
    id: Date.now(),
    proveedor: proveedor,
    productos: productosOrden, // ✅ CAMBIO: Array de productos en lugar de uno solo
    total: totalOrden,
    fechaCreacion: new Date().toISOString(),
    fechaEntregaEstimada: fechaEntrega,
    fechaEnvio: null,
    fechaRecepcion: null,
    estado: 'Pendiente',
    observaciones: observaciones,
    leadTime: null
  };
  
  // Agregar a la lista de órdenes
  if (!Array.isArray(state.ordenesCompra)) {
    state.ordenesCompra = [];
  }
  state.ordenesCompra.push(nuevaOrden);
  
  // Agregar referencias a todos los productos
  productosOrden.forEach(productoOrden => {
    const producto = state.productos[productoOrden.sku];
    if (producto) {
      if (!producto.ordenesCompra) {
        producto.ordenesCompra = [];
      }
      producto.ordenesCompra.push({
        ordenId: nuevaOrden.id,
        estado: 'Pendiente',
        cantidad: productoOrden.cantidad,
        fechaEstimada: fechaEntrega
      });
      
      console.log(`📦 Referencia agregada al producto: ${productoOrden.nombre}`);
    }
  });
  
  // Verificar stock bajo de productos (<= 3 unidades)
  const productosStockBajo = productosOrden.filter(p => {
    const producto = state.productos[p.sku];
    return producto && producto.stock <= 3;
  });
  
  if (productosStockBajo.length > 0) {
    let mensaje = '⚠️ Stock bajo detectado en:\\n\\n';
    productosStockBajo.forEach(p => {
      const producto = state.productos[p.sku];
      mensaje += `• ${p.nombre}: ${producto.stock} unidades\\n`;
    });
    mensaje += `\\nSe han creado las órdenes correspondientes.`;
    alert(mensaje);
  }
  
  // Guardar en Firebase
  saveState();
  
  // Actualizar UI
  renderOrdenesCompra();
  renderProducts();
  
  // Cerrar modal
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
  
  alert(`✅ Orden creada exitosamente\\n\\n📦 Productos: ${productosOrden.length}\\n💰 Total: ARS ${totalOrden.toFixed(2)}`);
}

// Función para exportar órdenes a PDF
function exportarOrdenesPDF() {
  const ordenes = state.ordenesCompra || [];
  
  if (ordenes.length === 0) {
    alert('No hay órdenes para exportar');
    return;
  }
  
  // Crear contenido HTML para el PDF
  let html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reporte de Órdenes de Compra</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #026669; text-align: center; }
        .header { text-align: center; margin-bottom: 30px; }
        .fecha { text-align: center; color: #666; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .total { font-weight: bold; text-align: right; }
        .status { padding: 2px 6px; border-radius: 3px; font-size: 11px; }
        .pendiente { background: #fff3cd; color: #856404; }
        .transito { background: #ffeaa7; color: #fd7e14; }
        .entregado { background: #d4edda; color: #28a745; }
        .cancelado { background: #f8d7da; color: #dc3545; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📋 REPORTE DE ÓRDENES DE COMPRA</h1>
        <div class="fecha">Generado el: ${new Date().toLocaleDateString()}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha Entrega</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Agregar cada orden
  ordenes.forEach(orden => {
    const statusClass = orden.estado === 'Pendiente' ? 'pendiente' : 
                       orden.estado === 'En Tránsito' ? 'transito' :
                       orden.estado === 'Entregado' ? 'entregado' : 'cancelado';
    
    html += `
      <tr>
        <td>${new Date(orden.fechaCreacion).toLocaleDateString()}</td>
        <td>${orden.proveedor}</td>
        <td>${orden.productoNombre}</td>
        <td>${orden.cantidad}</td>
        <td>ARS ${orden.total.toFixed(2)}</td>
        <td><span class="status ${statusClass}">${orden.estado}</span></td>
        <td>${orden.fechaEntregaEstimada ? new Date(orden.fechaEntregaEstimada).toLocaleDateString() : '-'}</td>
      </tr>
    `;
  });
  
  // Calcular totales
  const totalGeneral = ordenes.reduce((sum, o) => sum + o.total, 0);
  const ordenesPendientes = ordenes.filter(o => o.estado === 'Pendiente').length;
  const ordenesTransito = ordenes.filter(o => o.estado === 'En Tránsito').length;
  
  html += `
        </tbody>
      </table>
      
      <div style="margin-top: 30px;">
        <h3>Resumen</h3>
        <p><strong>Total de órdenes:</strong> ${ordenes.length}</p>
        <p><strong>Órdenes pendientes:</strong> ${ordenesPendientes}</p>
        <p><strong>Órdenes en tránsito:</strong> ${ordenesTransito}</p>
        <p class="total"><strong>TOTAL GENERAL: ARS ${totalGeneral.toFixed(2)}</strong></p>
      </div>
    </body>
    </html>
  `;
  
  // Abrir en nueva ventana para imprimir
  const ventana = window.open('', '_blank');
  ventana.document.write(html);
  ventana.document.close();
  
  // Esperar a que cargue y luego imprimir
  setTimeout(() => {
    ventana.print();
  }, 500);
}

// Función para imprimir órdenes en formato A4
function imprimirOrdenesA4() {
  const ordenes = state.ordenesCompra || [];
  
  if (ordenes.length === 0) {
    alert('No hay órdenes para imprimir');
    return;
  }
  
  // Crear contenido HTML optimizado para impresión A4
  let html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>Órdenes de Compra - Formato A4</title>
      <style>
        @page { size: A4; margin: 1cm; }
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #026669; padding-bottom: 10px; }
        .header h1 { color: #026669; margin: 0; font-size: 18px; }
        .header .fecha { color: #666; margin-top: 5px; }
        .summary { background: #f8f9fa; padding: 10px; margin-bottom: 15px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
        th { background-color: #026669; color: white; font-weight: bold; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .status { font-weight: bold; }
        .pendiente { color: #ffc107; }
        .transito { color: #fd7e14; }
        .entregado { color: #28a745; }
        .cancelado { color: #dc3545; }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>REPORTE DE ÓRDENES DE COMPRA</h1>
        <div class="fecha">Fecha de generación: ${new Date().toLocaleDateString()}</div>
      </div>
      
      <div class="summary">
        <strong>Resumen:</strong> 
        Total de órdenes: ${ordenes.length} | 
        Pendientes: ${ordenes.filter(o => o.estado === 'Pendiente').length} | 
        En tránsito: ${ordenes.filter(o => o.estado === 'En Tránsito').length} | 
        Total invertido: ARS ${ordenes.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Producto</th>
            <th class="text-center">Cant.</th>
            <th class="text-right">Total</th>
            <th class="text-center">Estado</th>
            <th class="text-center">Entrega Est.</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Agregar cada orden
  ordenes
    .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
    .forEach(orden => {
      const statusClass = orden.estado === 'Pendiente' ? 'pendiente' : 
                         orden.estado === 'En Tránsito' ? 'transito' :
                         orden.estado === 'Entregado' ? 'entregado' : 'cancelado';
      
      html += `
        <tr>
          <td>${new Date(orden.fechaCreacion).toLocaleDateString()}</td>
          <td>${orden.proveedor}</td>
          <td>${orden.productoNombre}</td>
          <td class="text-center">${orden.cantidad}</td>
          <td class="text-right">ARS ${orden.total.toFixed(2)}</td>
          <td class="text-center status ${statusClass}">${orden.estado}</td>
          <td class="text-center">${orden.fechaEntregaEstimada ? new Date(orden.fechaEntregaEstimada).toLocaleDateString() : '-'}</td>
        </tr>
      `;
    });
  
  html += `
        </tbody>
      </table>
      
      <div class="footer">
        <p>Reporte generado automáticamente | MiniMax Agent</p>
      </div>
    </body>
    </html>
  `;
  
  // Abrir en nueva ventana para imprimir
  const ventana = window.open('', '_blank');
  ventana.document.write(html);
  ventana.document.close();
  
  // Esperar a que cargue y luego imprimir
  setTimeout(() => {
    ventana.print();
  }, 500);
}



// ========================================================
// FUNCIONES AUXILIARES PARA WOOCOMMERCE (SOLUCIÓN SKU DUPLICADO)
// Agregadas para corregir errores de sincronización
// ========================================================

// FUNCIÓN AUXILIAR: Actualizar producto por SKU (HOTFIX PARA SKU DUPLICADO)
async function updateProductBySku(product) {
  try {
    console.log(`🔍 Buscando producto ${product.sku} para actualizar...`);
    
    // Buscar el producto existente
    const searchResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products?sku=${encodeURIComponent(product.sku)}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (!searchResponse.ok) {
      console.error(`Error buscando producto ${product.sku}:`, searchResponse.status);
      return { 
        success: false, 
        message: `No se pudo buscar producto existente: ${searchResponse.status}`,
        action: 'search_error'
      };
    }
    
    const existingProducts = await searchResponse.json();
    console.log(`📋 Productos encontrados para ${product.sku}:`, existingProducts.length);
    
    if (existingProducts.length === 0) {
      console.error(`❌ Producto ${product.sku} no encontrado después de error de duplicado`);
      return { 
        success: false, 
        message: `Producto no encontrado después de error de duplicado`,
        action: 'not_found'
      };
    }
    
    // Actualizar el producto encontrado
    const existingProduct = existingProducts[0];
    console.log(`📝 Actualizando producto ${product.sku} (ID: ${existingProduct.id})`);
    
    // Procesar imágenes para WooCommerce (solo URLs válidas)
    const wooImages = [];
    if (product.imagenes && product.imagenes.length > 0) {
      for (let i = 0; i < product.imagenes.length; i++) {
        const img = product.imagenes[i];
        
        if (img.data && img.data.startsWith('http')) {
          wooImages.push({
            src: img.data,
            name: img.name,
            alt: `${product.name} - Imagen ${i + 1}`
          });
        } else if (img.data && img.data.startsWith('data:image/')) {
          console.warn(`⚠️ Imagen "${img.name}" es Base64 y no se puede enviar a WooCommerce.`);
        }
      }
    }
    
    const updateData = {
      name: product.name,
      regular_price: product.price.toString(),
      stock_quantity: product.stock,
      manage_stock: true,
      description: `Producto: ${product.name}\nSKU: ${product.sku}`,
      short_description: `${product.brand || ''} - ${product.category || ''}`,
      images: wooImages // Incluir imágenes en la actualización
    };
    
    console.log(`📤 Enviando PUT a: ${currentWooConfig.url}/wp-json/wc/v3/products/${existingProduct.id}`);
    console.log(`📤 Datos de actualización:`, updateData);
    
    const updateResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products/${existingProduct.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (updateResponse.ok) {
      const updatedProduct = await updateResponse.json();
      console.log(`✅ Producto ${product.sku} actualizado exitosamente en WooCommerce`);
      
      let imageInfo = '';
      if (wooImages.length > 0) {
        imageInfo = ` + ${wooImages.length} imagen${wooImages.length !== 1 ? 'es' : ''}`;
      }
      
      return { 
        success: true, 
        message: `Producto actualizado (era duplicado): ${product.stock} unidades${imageInfo}`,
        action: 'updated'
      };
    } else {
      const errorData = await updateResponse.json();
      console.error(`Error actualizando producto ${product.sku}:`, errorData);
      
      return { 
        success: false, 
        message: `Error actualizando producto duplicado: ${errorData.message || 'Error desconocido'}`,
        action: 'update_error'
      };
    }
    
  } catch (error) {
    console.error(`Error actualizando producto por SKU ${product.sku}:`, error);
    return { 
      success: false, 
      message: `Error de red: ${error.message}`,
      action: 'network_error'
    };
  }
}

// FUNCIÓN AUXILIAR: Validar SKUs antes de sincronizar
function validateSkusBeforeSync() {
  console.log('🔍 === VALIDACIÓN DE SKUs ANTES DE SINCRONIZACIÓN ===');
  
  const skuCounts = {};
  const products = Object.values(state.productos);
  
  // Contar ocurrencias de cada SKU
  products.forEach(product => {
    const sku = product.sku;
    if (skuCounts[sku]) {
      skuCounts[sku]++;
    } else {
      skuCounts[sku] = 1;
    }
  });
  
  // Encontrar SKUs duplicados
  const duplicateSkus = Object.keys(skuCounts).filter(sku => skuCounts[sku] > 1);
  
  if (duplicateSkus.length > 0) {
    console.warn('⚠️ SKUs duplicados encontrados:', duplicateSkus);
    console.log('📊 Detalle de duplicados:');
    duplicateSkus.forEach(sku => {
      console.log(`  - ${sku}: ${skuCounts[sku]} ocurrencias`);
    });
    
    alert(`⚠️ Se encontraron ${duplicateSkus.length} SKUs duplicados en el inventario.\n\n` +
          `Esto puede causar errores al sincronizar con WooCommerce.\n\n` +
          `Revisa la consola para más detalles.`);
    
    return {
      hasDuplicates: true,
      duplicateCount: duplicateSkus.length,
      duplicateSkus: duplicateSkus,
      totalProducts: products.length
    };
  } else {
    console.log('✅ Todos los SKUs son únicos - listo para sincronizar');
    
    alert(`✅ Validación completada: Todos los SKUs son únicos.\n\n` +
          `Total productos: ${products.length}\n` +
          `Puedes proceder con la sincronización.`);
    
    return {
      hasDuplicates: false,
      duplicateCount: 0,
      duplicateSkus: [],
      totalProducts: products.length
    };
  }
}

// 🔐 FUNCIÓN MEJORADA PARA VALIDAR CREDENCIALES DE WOOCOMMERCE
async function validateWooCommerceCredentials() {
  try {
    console.log('🔐 Validando credenciales de WooCommerce...');
    
    // Usar endpoint más confiable que siempre está disponible
    const testUrl = `${currentWooConfig.url}/wp-json/wc/v3/products?per_page=1`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`)
      }
    });
    
    if (response.ok) {
      console.log('✅ Credenciales de WooCommerce válidas');
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      return true;
    } else {
      console.error(`❌ Error de conexión: ${response.status} ${response.statusText}`);
      console.error('🔍 Posibles causas:');
      console.error('   - URL incorrecta (debe terminar sin /)');
      console.error('   - Credenciales incorrectas');
      console.error('   - WooCommerce no instalado');
      console.error('   - Permalinks no configurados');
      return false;
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.error('🔍 Posibles causas:');
    console.error('   - URL incorrecta o sitio no disponible');
    console.error('   - Problema de CORS');
    console.error('   - Certificado SSL inválido');
    console.error('   - Firewall bloqueando la conexión');
    
    // Mostrar información adicional para debugging
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('💡 Verifica que la URL sea: https://tudominio.com');
      console.error('💡 Asegúrate de que WooCommerce esté instalado y activado');
    }
    
    return false;
  }
}

// 🔍 FUNCIÓN DE PRUEBA DE CONEXIÓN DETALLADA
async function testWooCommerceConnectionDetailed() {
  console.log('🔍 INICIANDO PRUEBA DETALLADA DE CONEXIÓN...');
  console.log('='.repeat(50));
  
  // Verificar que las credenciales estén configuradas
  if (!currentWooConfig) {
    console.error('❌ No hay configuración de WooCommerce');
    return false;
  }
  
  console.log(`🌐 URL configurada: ${currentWooConfig.url}`);
  console.log(`🔑 Key configurada: ${currentWooConfig.key.substring(0, 8)}...`);
  console.log(`🔒 Secret configurada: ${currentWooConfig.secret.substring(0, 8)}...`);
  
  // Probar diferentes endpoints
  const endpoints = [
    '/wp-json/',
    '/wp-json/wc/v3/',
    '/wp-json/wc/v3/products?per_page=1',
    '/wp-json/wc/v3/system_status'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Probando endpoint: ${endpoint}`);
      const testUrl = `${currentWooConfig.url}${endpoint}`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`)
        }
      });
      
      console.log(`📊 Respuesta: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log(`✅ Endpoint ${endpoint} funciona correctamente`);
        
        // Si llegamos aquí, las credenciales son válidas
        console.log('\n🎉 CONEXIÓN EXITOSA');
        console.log('='.repeat(50));
        return true;
      } else {
        console.log(`⚠️  Endpoint ${endpoint} respondió con error`);
      }
    } catch (error) {
      console.log(`❌ Error en endpoint ${endpoint}: ${error.message}`);
    }
  }
  
  console.log('\n💥 TODOS LOS ENDPOINTS FALLARON');
  console.log('='.repeat(50));
  return false;
}



// 🎯 FUNCIÓN PARA SINCRONIZAR SOLO UN SKU
async function syncSingleProductWithWoo(sku) {
  console.log(`🎯 Sincronizando solo el producto con SKU: ${sku}`);
  
  if (!currentWooConfig) {
    alert('❌ WooCommerce no configurado');
    return;
  }
  
  const products = Object.values(state.productos);
  const product = products.find(p => p.sku === sku);
  
  if (!product) {
    alert(`❌ Producto con SKU ${sku} no encontrado`);
    return;
  }
  
  // Verificar si tiene imágenes Base64 y convertirlas primero
  if (product.imagenes && product.imagenes.some(img => img.data && img.data.startsWith('data:image/'))) {
    console.log(`🎨 Convirtiendo imágenes Base64 para ${sku}...`);
    
    for (let i = 0; i < product.imagenes.length; i++) {
      const img = product.imagenes[i];
      if (img.data && img.data.startsWith('data:image/')) {
        try {
          const convertedUrl = await convertBase64ImageToWooUrl(img.data, sku, i);
          product.imagenes[i].data = convertedUrl;
          product.imagenes[i].name = `product-${sku}-${i+1}`;
          console.log(`✅ Imagen ${i+1} convertida para ${sku}`);
        } catch (error) {
          console.error(`❌ Error convirtiendo imagen ${i+1} de ${sku}:`, error);
          alert(`❌ Error convirtiendo imagen ${i+1} de ${sku}: ${error.message}`);
          return;
        }
      }
    }
  }
  
  // Ahora sincronizar el producto
  try {
    console.log(`🚀 Sincronizando ${sku} con WooCommerce...`);
    const result = await syncProductWithWoo(product);
    
    if (result.success) {
      alert(`✅ Producto ${sku} sincronizado exitosamente\n\n${result.message}`);
      console.log(`✅ ${sku}: ${result.message}`);
    } else {
      alert(`❌ Error sincronizando ${sku}\n\n${result.message}`);
      console.error(`❌ ${sku}: ${result.message}`);
    }
  } catch (error) {
    alert(`❌ Error inesperado sincronizando ${sku}: ${error.message}`);
    console.error(`❌ Error inesperado sincronizando ${sku}:`, error);
  }
}






// FUNCIÓN MEJORADA: Sincronización con mejor manejo de errores
async function syncAllProductsWithWooImproved() {
  if (!currentWooConfig) {
    alert('❌ WooCommerce no está configurado. Ve a la configuración para configurarlo.');
    return;
  }

  const products = Object.values(state.productos);
  if (products.length === 0) {
    alert('❌ No hay productos para sincronizar');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  let updateCount = 0; // Contador para productos que se actualizaron (eran duplicados)

  // Crear indicador de progreso mejorado
  const progressDiv = document.createElement('div');
  progressDiv.id = 'sync-progress-container';
  progressDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    text-align: center;
    min-width: 400px;
  `;
  
  progressDiv.innerHTML = `
    <h3 style="margin-top: 0; color: #026669;">🔄 Sincronizando con WooCommerce</h3>
    <div style="margin: 20px 0;">
      <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden;">
        <div id="sync-progress-bar" style="background: #28a745; height: 20px; width: 0%; transition: width 0.3s;"></div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; font-size: 14px;">
      <div>
        <strong>Progreso:</strong> <span id="sync-progress">0</span>/${products.length}
      </div>
      <div>
        <strong>Exitosos:</strong> <span id="sync-success" style="color: #28a745;">0</span>
      </div>
      <div>
        <strong>Actualizados:</strong> <span id="sync-updated" style="color: #17a2b8;">0</span>
      </div>
      <div>
        <strong>Omitidos:</strong> <span id="sync-skipped" style="color: #ffc107;">0</span>
      </div>
      <div style="grid-column: 1 / -1;">
        <strong>Errores:</strong> <span id="sync-errors" style="color: #dc3545;">0</span>
      </div>
    </div>
    <div id="sync-status" style="margin-top: 15px; color: #666; font-size: 12px;">Iniciando sincronización...</div>
  `;
  
  document.body.appendChild(progressDiv);
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      // Actualizar barra de progreso
      const progress = ((i + 1) / products.length) * 100;
      document.getElementById('sync-progress-bar').style.width = progress + '%';
      document.getElementById('sync-progress').textContent = i + 1;
      document.getElementById('sync-status').textContent = `Procesando: ${product.name} (${product.sku})`;
      
      const result = await syncProductWithWoo(product);
      
      if (result.success) {
        successCount++;
        if (result.action === 'updated') {
          updateCount++;
          console.log(`🔄 ${product.sku}: ${result.message}`);
        } else {
          console.log(`✅ ${product.sku}: ${result.message}`);
        }
      } else {
        if (result.action === 'duplicate_sku' || result.message.includes('ya existe')) {
          skipCount++;
          console.log(`⏭️ ${product.sku}: Omitido - ${result.message}`);
        } else {
          errorCount++;
          console.warn(`❌ ${product.sku}: ${result.message}`);
        }
      }
    } catch (error) {
      console.error('Error sincronizando producto:', error);
      errorCount++;
    }
    
    // Actualizar contadores
    document.getElementById('sync-success').textContent = successCount;
    document.getElementById('sync-updated').textContent = updateCount;
    document.getElementById('sync-errors').textContent = errorCount;
    document.getElementById('sync-skipped').textContent = skipCount;
    
    // Pequeña pausa para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Limpiar progreso
  document.body.removeChild(progressDiv);
  
  // Resumen final mejorado
  const summary = `✓ Sincronización completada\n\n` +
                  `✅ Creados: ${successCount - updateCount}\n` +
                  `🔄 Actualizados: ${updateCount}\n` +
                  `⏭️ Omitidos: ${skipCount}\n` +
                  `❌ Errores: ${errorCount}\n` +
                  `📊 Total: ${products.length}`;
  
  alert(summary);
  
  // Log detallado para debugging
  console.log('📊 Resumen de sincronización:', {
    total: products.length,
    created: successCount - updateCount,
    updated: updateCount,
    successful: successCount,
    skipped: skipCount,
    errors: errorCount
  });
}


// FUNCIÓN MEJORADA: Procesar imágenes para WooCommerce con mejor manejo de errores
function processImagesForWooCommerce(product) {
  const wooImages = [];
  const imageWarnings = [];
  const imageErrors = [];

  if (!product.imagenes || product.imagenes.length === 0) {
    return { images: wooImages, warnings: imageWarnings, errors: imageErrors };
  }

  for (let i = 0; i < product.imagenes.length; i++) {
    const img = product.imagenes[i];
    
    // Solo enviar imágenes que son URLs válidas (importadas desde WooCommerce)
    if (img.data && img.data.startsWith('http')) {
      // Verificar si la URL parece válida
      try {
        const url = new URL(img.data);
        
        // Verificar si es una URL de WooCommerce
        if (url.hostname.includes('laplatacompu.com')) {
          wooImages.push({
            src: img.data, // URL de imagen
            name: img.name,
            alt: `${product.name} - Imagen ${i + 1}`
          });
          
          // Verificar formato de imagen
          const pathname = url.pathname.toLowerCase();
          if (pathname.endsWith('.webp')) {
            imageWarnings.push(`🖼️ Imagen "${img.name}" está en formato WebP (óptimo para web)`);
          } else if (pathname.endsWith('.png')) {
            imageWarnings.push(`🖼️ Imagen "${img.name}" está en formato PNG (se convertirá a WebP)`);
          } else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
            imageWarnings.push(`🖼️ Imagen "${img.name}" está en formato JPEG (se convertirá a WebP)`);
          }
        } else {
          imageWarnings.push(`⚠️ Imagen "${img.name}" no está en el dominio de la tienda`);
        }
      } catch (error) {
        imageErrors.push(`❌ URL inválida para imagen "${img.name}": ${error.message}`);
      }
    } else if (img.data && img.data.startsWith('data:image/')) {
      // Para imágenes Base64 (subidas localmente), mostrar advertencia
      imageWarnings.push(`⚠️ Imagen "${img.name}" es Base64 y no se puede enviar a WooCommerce. URL requerida.`);
    } else {
      imageErrors.push(`❌ Imagen "${img.name}" tiene formato desconocido`);
    }
  }

  return { images: wooImages, warnings: imageWarnings, errors: imageErrors };
}

// =============================================================================
// FUNCIONES MEJORADAS PARA HOTFIX V2.0 - SKU DUPLICADO E IMÁGENES
// =============================================================================

// FUNCIÓN MEJORADA: Buscar producto con múltiples estrategias
async function findProductBySkuImproved(sku) {
  console.log(`🔍 Buscando producto con SKU: ${sku}`);
  
  try {
    // ESTRATEGIA 1: Búsqueda directa por SKU
    const searchUrl = `${currentWooConfig.url}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}`;
    console.log(`🔗 URL de búsqueda: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Respuesta de búsqueda: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`❌ Error en búsqueda: ${response.status} ${response.statusText}`);
      return { success: false, reason: `HTTP ${response.status}`, products: [] };
    }
    
    const products = await response.json();
    console.log(`📋 Productos encontrados: ${products.length}`);
    
    if (products.length > 0) {
      console.log(`✅ Producto encontrado:`, products[0]);
      return { success: true, products, strategy: 'direct_search' };
    }
    
    // ESTRATEGIA 2: Búsqueda por nombre (si no se encuentra por SKU)
    console.log(`🔄 SKU no encontrado, intentando búsqueda por nombre...`);
    
    const nameSearchUrl = `${currentWooConfig.url}/wp-json/wc/v3/products?per_page=100`;
    const nameResponse = await fetch(nameSearchUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (nameResponse.ok) {
      const allProducts = await nameResponse.json();
      const foundBySku = allProducts.filter(p => p.sku === sku);
      
      if (foundBySku.length > 0) {
        console.log(`✅ Producto encontrado en búsqueda masiva:`, foundBySku[0]);
        return { success: true, products: foundBySku, strategy: 'bulk_search' };
      }
    }
    
    console.log(`❌ Producto ${sku} no encontrado en ninguna búsqueda`);
    return { success: false, reason: 'not_found', products: [] };
    
  } catch (error) {
    console.error(`❌ Error buscando producto ${sku}:`, error);
    return { success: false, reason: error.message, products: [] };
  }
}

// FUNCIÓN MEJORADA: Actualizar producto con mejor debugging
async function updateProductBySkuImproved(product) {
  console.log(`🔄 Iniciando actualización mejorada para SKU: ${product.sku}`);
  
  // Buscar el producto
  const searchResult = await findProductBySkuImproved(product.sku);
  
  if (!searchResult.success) {
    console.error(`❌ No se pudo encontrar producto ${product.sku}`);
    console.log(`💡 Posibles causas:`);
    console.log(`   - El producto no existe en WooCommerce`);
    console.log(`   - Problemas de permisos o autenticación`);
    console.log(`   - El SKU podría estar ligeramente diferente`);
    
    return { 
      success: false, 
      message: `Producto no encontrado: ${searchResult.reason}`,
      action: 'not_found',
      suggestions: [
        'Verificar que el producto existe en WooCommerce',
        'Revisar que el SKU sea exactamente el mismo',
        'Confirmar permisos de la API'
      ]
    };
  }
  
  // Actualizar el producto encontrado
  const existingProduct = searchResult.products[0];
  console.log(`📝 Actualizando producto ${product.sku} (ID: ${existingProduct.id}) usando estrategia: ${searchResult.strategy}`);
  
  try {
    // ✅ PROCESAMIENTO MEJORADO DE IMÁGENES
    console.log(`🖼️ Procesando imágenes para producto ${product.sku}...`);
    const imageResult = processImagesForWooCommerce(product);
    const wooImages = imageResult.images;
    
    // Mostrar información sobre imágenes
    if (imageResult.warnings.length > 0) {
      console.log(`📋 Advertencias de imágenes:`);
      imageResult.warnings.forEach(warning => console.log(`  ${warning}`));
    }
    
    if (imageResult.errors.length > 0) {
      console.log(`❌ Errores de imágenes:`);
      imageResult.errors.forEach(error => console.log(`  ${error}`));
    }
    
    // Crear datos del producto para actualización
    const productData = {
      name: product.name,
      regular_price: product.price.toString(),
      stock_quantity: product.stock,
      manage_stock: true,
      description: `Producto: ${product.name}\nSKU: ${product.sku}`,
      short_description: `${product.brand || ''} - ${product.category || ''}`,
      sku: product.sku
    };
    
    // Solo agregar imágenes si hay alguna válida
    if (wooImages.length > 0) {
      productData.images = wooImages;
      console.log(`🖼️ Incluyendo ${wooImages.length} imagen(es) en la actualización`);
    } else {
      console.log(`⚠️ No se incluirán imágenes en la actualización (solo URLs válidas)`);
    }
    
    console.log(`📤 Enviando PUT a: ${currentWooConfig.url}/wp-json/wc/v3/products/${existingProduct.id}`);
    
    // Enviar actualización
    const updateResponse = await fetch(`${currentWooConfig.url}/wp-json/wc/v3/products/${existingProduct.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${currentWooConfig.key}:${currentWooConfig.secret}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
    const updateResult = await updateResponse.json();
    
    if (updateResponse.ok) {
      console.log(`✅ Producto ${product.sku} actualizado exitosamente`);
      return { 
        success: true, 
        message: `Producto ${product.sku} actualizado correctamente`,
        product: updateResult,
        action: 'updated'
      };
    } else {
      console.error(`❌ Error actualizando producto ${product.sku}:`, updateResult);
      return { 
        success: false, 
        message: `Error de actualización: ${updateResult.message || updateResult.code}`,
        error: updateResult,
        action: 'update_error'
      };
    }
    
  } catch (error) {
    console.error(`❌ Excepción actualizando producto ${product.sku}:`, error);
    return { 
      success: false, 
      message: `Excepción: ${error.message}`,
      action: 'exception'
    };
  }
}

// FUNCIÓN MEJORADA: Validar SKUs con mejor información
async function validateSkusBeforeSyncImproved() {
  console.log(`🔍 Iniciando validación mejorada de SKUs...`);
  
  if (!currentWooConfig || !currentWooConfig.url) {
    alert('❌ Configuración de WooCommerce no disponible');
    return;
  }
  
  // Obtener productos del inventario local
  const products = Object.values(state.productos);
  
  // Detectar SKUs duplicados en el inventario local
  const skuMap = new Map();
  const duplicates = [];
  
  products.forEach(product => {
    if (product.sku) {
      if (skuMap.has(product.sku)) {
        duplicates.push(product.sku);
      } else {
        skuMap.set(product.sku, product);
      }
    }
  });
  
  console.log(`📊 Análisis del inventario local:`);
  console.log(`   - Total productos: ${products.length}`);
  console.log(`   - SKUs únicos: ${skuMap.size}`);
  console.log(`   - SKUs duplicados: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log(`⚠️ SKUs duplicados encontrados:`, duplicates);
    alert(`⚠️ Se encontraron ${duplicates.length} SKUs duplicados en el inventario local:\n${duplicates.join(', ')}`);
  } else {
    console.log(`✅ No hay SKUs duplicados en el inventario local`);
    alert(`✅ No se encontraron SKUs duplicados en el inventario local`);
  }
  
  // Verificar algunos productos en WooCommerce
  const sampleSkus = Array.from(skuMap.keys()).slice(0, 5);
  console.log(`🔍 Verificando ${sampleSkus.length} SKUs en WooCommerce...`);
  
  for (const sku of sampleSkus) {
    const result = await findProductBySkuImproved(sku);
    console.log(`   - SKU ${sku}: ${result.success ? '✅ Existe' : '❌ No existe'}`);
  }
  
  return {
    localProducts: products.length,
    uniqueSkus: skuMap.size,
    duplicateSkus: duplicates,
    checkedInWoo: sampleSkus.length
  };
}




// FUNCIÓN PARA PROCESAR TODOS LOS PRODUCTOS CON CONVERSIÓN AUTOMÁTICA
async function syncAllProductsWithAutoImageConversion() {
  console.log(`🚀 Iniciando sincronización masiva con conversión automática de imágenes...`);
  
  const products = Object.values(state.productos);
  const results = {
    total: products.length,
    processed: 0,
    converted: 0,
    synced: 0,
    errors: 0,
    skipped: 0
  };
  
  // Mostrar resumen inicial
  const productsWithBase64 = products.filter(p => 
    p.imagenes && p.imagenes.some(img => img.data && img.data.startsWith('data:image/'))
  );
  
  console.log(`📊 Resumen inicial:`);
  console.log(`   - Total productos: ${products.length}`);
  console.log(`   - Productos con imágenes Base64: ${productsWithBase64.length}`);
  console.log(`   - Productos sin imágenes Base64: ${products.length - productsWithBase64.length}`);
  
  for (const product of products) {
    try {
      console.log(`\n--- Procesando producto ${product.sku} ---`);
      results.processed++;
      
      // Verificar si tiene imágenes Base64
      const hasBase64Images = product.imagenes && 
                             product.imagenes.some(img => img.data && img.data.startsWith('data:image/'));
      
      if (hasBase64Images) {
        console.log(`🔄 Convirtiendo imágenes Base64...`);
        const conversionResult = await updateProductWithConvertedImages(product);
        
        if (conversionResult.success) {
          results.converted++;
          console.log(`✅ ${conversionResult.convertedCount} imagen(es) convertida(s)`);
        }
      }
      
      // Sincronizar con WooCommerce
      const syncResult = await syncProductWithWoo(product);
      
      if (syncResult.success) {
        results.synced++;
        console.log(`✅ Sincronización exitosa`);
      } else {
        results.errors++;
        console.log(`❌ Error en sincronización: ${syncResult.message}`);
      }
      
    } catch (error) {
      results.errors++;
      console.error(`❌ Error procesando producto ${product.sku}:`, error);
    }
    
    // Pequeña pausa para evitar sobrecarga
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n🎯 RESUMEN FINAL:`);
  console.log(`   - Total procesados: ${results.processed}`);
  console.log(`   - Imágenes convertidas: ${results.converted}`);
  console.log(`   - Sincronizados exitosamente: ${results.synced}`);
  console.log(`   - Errores: ${results.errors}`);
  console.log(`   - Tasa de éxito: ${Math.round((results.synced / results.total) * 100)}%`);
  
  return results;
}

// Nueva función para ocultar chatbot de forma segura
function safeHideChatbot() {
  try {
    if (typeof hideChatbot === 'function') {
      hideChatbot();
    } else {
      // Fallback manual
      const trigger = document.getElementById('chatbot-trigger');
      const widget = document.getElementById('chatbot-widget');
      if (trigger) trigger.style.display = 'none';
      if (widget) widget.style.display = 'none';
    }
  } catch (error) {
    console.error('Error ocultando chatbot:', error);
  }
}

// ========================================================
// MÓDULO KARDEX PROMEDIO (COSTO PROMEDIO PONDERADO)
// ========================================================

// Variables globales para gráficos de Kardex
let kardexChartCostos = null;
let kardexChartInventario = null;
let kardexChartMovimientos = null;
let kardexChartRotacion = null;
let kardexChartComparacion = null;
let kardexChartEvolucion = null;
let kardexChartTop = null;

// Variable global para almacenar datos del kardex calculados
let kardexDataGlobal = [];

// Bandera para controlar si el kardex ya fue renderizado
let kardexRenderizado = false;

/**
 * Destruye todos los gráficos de kardex de forma segura
 * Nota: Los gráficos se acceden directamente (no via window[]) porque están declarados a nivel de módulo
 */
function destroyKardexCharts() {
  const charts = [
    kardexChartCostos,
    kardexChartInventario,
    kardexChartMovimientos,
    kardexChartRotacion,
    kardexChartComparacion,
    kardexChartEvolucion,
    kardexChartTop
  ];

  charts.forEach(chart => {
    try {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    } catch (e) {
      // Ignorar errores al destruir
    }
  });

  // Resetear todas las variables de gráficos a null
  kardexChartCostos = null;
  kardexChartInventario = null;
  kardexChartMovimientos = null;
  kardexChartRotacion = null;
  kardexChartComparacion = null;
  kardexChartEvolucion = null;
  kardexChartTop = null;
}

/**
 * Calcula el kardex promedio (costo promedio ponderado) para un producto
 * @param {string} sku - SKU del producto
 * @param {Object} producto - Datos del producto
 * @returns {Object} Objeto con el costo promedio y detalles del cálculo
 */
function calcularKardexPromedio(sku, producto) {
  // Validar state antes de proceder (solo una vez al inicio)
  if (typeof state === 'undefined' || !state.productos) {
    console.warn('⚠️ State no disponible en calcularKardexPromedio');
    return null;
  }

  // Obtener historial de compras del producto desde órdenes de compra
  const ordenes = state.ordenesCompra || [];
  const historialCompras = [];

  ordenes.forEach(orden => {
    if (orden.productos && Array.isArray(orden.productos)) {
      orden.productos.forEach(item => {
        if (item.sku === sku) {
          historialCompras.push({
            fecha: orden.fechaCreacion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            proveedor: orden.proveedor,
            ordenId: orden.id,
            estado: orden.estado
          });
        }
      });
    }
  });

  // Ordenar por fecha (más reciente primero)
  historialCompras.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Calcular costo promedio ponderado
  let totalCantidad = 0;
  let totalCosto = 0;
  let ultimoPrecio = producto.cost || 0;
  let primeraCompra = null;
  let ultimaCompra = null;

  if (historialCompras.length > 0) {
    ultimaCompra = historialCompras[0].fecha;
    primeraCompra = historialCompras[historialCompras.length - 1].fecha;

    historialCompras.forEach(compra => {
      totalCantidad += compra.cantidad;
      totalCosto += compra.subtotal;
    });

    ultimoPrecio = historialCompras[0].precioUnitario;
  }

  // Calcular costo promedio ponderado
  const costoPromedio = totalCantidad > 0 ? totalCosto / totalCantidad : producto.cost || 0;

  // Calcular valor actual del inventario
  const valorInventario = producto.stock * costoPromedio;

  // Calcular ganancia/pérdida respecto al costo actual
  const diferenciaCosto = (producto.cost || 0) - costoPromedio;
  const porcentajeDiferencia = costoPromedio > 0 ? (diferenciaCosto / costoPromedio) * 100 : 0;

  return {
    sku: sku,
    nombre: producto.name,
    stockActual: producto.stock,
    costoUnitario: producto.cost || 0,
    costoPromedio: costoPromedio,
    ultimoPrecioCompra: ultimoPrecio,
    valorInventario: valorInventario,
    diferenciaCosto: diferenciaCosto,
    porcentajeDiferencia: porcentajeDiferencia,
    totalComprado: totalCantidad,
    totalInvertido: totalCosto,
    historial: historialCompras,
    primeraCompra: primeraCompra,
    ultimaCompra: ultimaCompra,
    proveedorHabitual: historialCompras.length > 0 ? historialCompras[0].proveedor : '-'
  };
}

/**
 * Renderiza la vista de Kardex Promedio con gráficos y tabla de datos
 * SOLO renderiza si la sección está visible
 * Si ya hay datos calculados en kardexDataGlobal, los usa
 */
function renderKardex() {
  // 🚨 CRÍTICO: Verificar si la sección kardex está visible antes de renderizar
  const kardexSection = document.getElementById('kardex');
  if (!kardexSection || kardexSection.style.display === 'none') {
    // La sección no está visible, no renderizar
    return;
  }

  console.log('📊 Renderizando módulo Kardex Promedio...');

  // 🚨 CRÍTICO: Destruir gráficos anteriores ANTES de crear nuevos
  destroyKardexCharts();

  // Usar SOLO datos globales si existen (nunca calcular ni sobrescribir)
  let kardexData = [];
  if (kardexDataGlobal && kardexDataGlobal.length > 0) {
    console.log('📊 Usando datos globales del kardex');
    kardexData = kardexDataGlobal;
  } else {
    console.log('📊 No hay datos calculados. Calculando automáticamente...');
    // Calcular automáticamente si no hay datos
    try {
      let kardexDataTemp = [];
      let errores = 0;
      
      if (state.productos && Object.keys(state.productos).length > 0) {
        const productos = Object.values(state.productos);
        
        productos.forEach(producto => {
          const kardex = calcularKardexPromedio(producto.sku, producto);
          if (kardex) {
            kardexDataTemp.push(kardex);
          } else {
            errores++;
          }
        });
        
        // Guardar en variable global
        kardexDataGlobal = kardexDataTemp;
        kardexData = kardexDataTemp;
        
        console.log(`✅ Kardex calculado automáticamente: ${kardexData.length} productos`);
      } else {
        console.warn('⚠️ No hay productos en el inventario');
        return;
      }
    } catch (error) {
      console.error('❌ Error calculando kardex automáticamente:', error);
      return;
    }
  }

  // Ordenar por valor de inventario (mayor a menor)
  kardexData.sort((a, b) => b.valorInventario - a.valorInventario);

  console.log(`✅ Kardex renderizado: ${kardexData.length} productos`);

  // Renderizar gráficos usando IDs del HTML
  renderKardexChartsFiltered(kardexData);

  // Renderizar tabla de datos
  renderKardexTable(kardexData);

  // Actualizar resumen
  renderKardexSummary(kardexData);

  // Marcar como renderizado
  kardexRenderizado = true;
}


// ========================================================
// FIN DEL MÓDULO KARDEX PROMEDIO (CÓDIGO ANTERIOR ELIMINADO)
// ========================================================

function renderKardexTable(kardexData) {
  const tableBody = document.querySelector('#tabla-kardex tbody');

  if (!tableBody) {
    console.warn('⚠️ Tabla de kardex no encontrada');
    return;
  }

  let html = '';

  kardexData.forEach(kardex => {
    // Calcular salidas estimadas
    const salidasEstimadas = Math.max(0, kardex.totalComprado - (kardex.stockActual > kardex.totalComprado ? 0 : kardex.stockActual));

    // Calcular inventario promedio
    const inventarioPromedio = Math.round((kardex.stockActual + kardex.totalComprado) / 2) || kardex.stockActual;

    // Calcular rotación
    const rotacion = inventarioPromedio > 0 ? (salidasEstimadas / inventarioPromedio).toFixed(2) : '0.00';

    // Calcular días de stock (asumiendo 30 días)
    const diasStock = parseFloat(rotacion) > 0 ? Math.round(30 / parseFloat(rotacion)) : 999;

    html += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:10px"><strong>${kardex.sku}</strong></td>
        <td style="padding:10px">${kardex.nombre.substring(0, 35)}${kardex.nombre.length > 35 ? '...' : ''}</td>
        <td style="padding:10px;text-align:center">${Math.max(0, kardex.stockActual - kardex.totalComprado + salidasEstimadas)}</td>
        <td style="padding:10px;text-align:center;color:#28a745;font-weight:bold">+${kardex.totalComprado}</td>
        <td style="padding:10px;text-align:center;color:#dc3545;font-weight:bold">-${salidasEstimadas}</td>
        <td style="padding:10px;text-align:center;font-weight:bold">${kardex.stockActual}</td>
        <td style="padding:10px;text-align:center">${inventarioPromedio}</td>
        <td style="padding:10px;text-align:center">${rotacion}</td>
        <td style="padding:10px;text-align:center">${diasStock > 365 ? '365+' : diasStock}</td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;

  // Actualizar contador si existe
  const tableInfo = document.getElementById('kardex-table-info');
  if (tableInfo) {
    tableInfo.textContent = `Mostrando ${kardexData.length} productos`;
  }

  console.log(`📊 Tabla kardex actualizada con ${kardexData.length} productos`);
}

/**
 * Función para actualizar automáticamente el kardex cuando hay movimientos de inventario
 * Se llama después de registrar una venta o recibir una orden de compra
 */
function actualizarKardexAutomatico() {
  console.log('🔄 Actualizando kardex automáticamente...');
  
  // Verificar que hay productos en el inventario
  if (!state.productos || Object.keys(state.productos).length === 0) {
    console.warn('⚠️ No hay productos para actualizar kardex');
    return;
  }
  
  try {
    // Calcular kardex para todos los productos
    let kardexData = [];
    let errores = 0;
    
    const productos = Object.values(state.productos);
    
    productos.forEach(producto => {
      const kardex = calcularKardexPromedio(producto.sku, producto);
      if (kardex) {
        kardexData.push(kardex);
      } else {
        errores++;
      }
    });
    
    // Guardar en variable global
    kardexDataGlobal = kardexData;
    
    // Renderizar todos los componentes del kardex
    renderKardexChartsFiltered(kardexDataGlobal);
    renderKardexTable(kardexDataGlobal);
    renderKardexSummary(kardexDataGlobal);
    
    console.log(`✅ Kardex actualizado automáticamente: ${kardexData.length} productos procesados`);
  } catch (error) {
    console.error('❌ Error actualizando kardex automáticamente:', error);
  }
}

/**
 * Renderiza el resumen estadístico del kardex
 * @param {Array} kardexData - Array con datos del kardex de cada producto
 */
function renderKardexSummary(kardexData) {
  // Calcular métricas
  let totalStock = 0;
  let totalEntradas = 0;
  let totalSalidas = 0;
  let inventarioPromedio = 0;
  let rotacionPromedio = 0;
  let valorTotalInventario = 0;

  kardexData.forEach(kardex => {
    totalStock += kardex.stockActual;
    totalEntradas += kardex.totalComprado;
    // El valor del inventario ya viene calculado desde calcularKardexPromedio
    valorTotalInventario += kardex.valorInventario || 0;
    // Estimar salidas: si el stock actual es menor que las compras, hubo ventas
    const salidasEstimadas = Math.max(0, kardex.totalComprado - (kardex.stockActual > kardex.totalComprado ? 0 : kardex.stockActual));
    totalSalidas += salidasEstimadas;
  });

  // Calcular inventario promedio
  inventarioPromedio = kardexData.length > 0 ? Math.round(totalStock / kardexData.length) : 0;

  // Calcular rotación promedio (entradas / inventario promedio)
  rotacionPromedio = inventarioPromedio > 0 ? (totalEntradas / inventarioPromedio).toFixed(2) : '0.00';

  // Actualizar elementos del DOM según estructura del HTML
  const elements = {
    'kardex-valor-total': valorTotalInventario.toLocaleString('es-BO', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
    'kardex-inv-promedio': inventarioPromedio.toLocaleString(),
    'kardex-rotacion': rotacionPromedio,
    'kardex-entradas': totalEntradas.toLocaleString(),
    'kardex-salidas': totalSalidas.toLocaleString()
  };

  Object.keys(elements).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = elements[id];
    }
  });

  console.log('📊 Resumen Kardex actualizado:', elements);
}

/**
 * Muestra el detalle completo de un producto en el kardex
 * @param {string} sku - SKU del producto
 */
function verDetalleKardex(sku) {
  console.log(`🔍 Ver detalle de kardex para: ${sku}`);

  const producto = state.productos[sku];
  if (!producto) {
    alert('Producto no encontrado');
    return;
  }

  const kardex = calcularKardexPromedio(sku, producto);
  if (!kardex) {
    alert('Error calculando kardex');
    return;
  }

  // Crear modal con detalle
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'display: flex; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);';

  modal.innerHTML = `
    <div style="background-color: #fefefe; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 800px; max-height: 80vh; overflow-y: auto; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #026669; padding-bottom: 10px;">
        <h2 style="margin: 0; color: #026669;">📊 Kardex Detallado: ${kardex.nombre}</h2>
        <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
          <div style="font-size: 12px; color: #666;">SKU</div>
          <div style="font-weight: bold; font-size: 16px;">${kardex.sku}</div>
        </div>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
          <div style="font-size: 12px; color: #666;">Stock Actual</div>
          <div style="font-weight: bold; font-size: 16px;">${kardex.stockActual} unidades</div>
        </div>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
          <div style="font-size: 12px; color: #666;">Proveedor Habitual</div>
          <div style="font-weight: bold; font-size: 14px;">${kardex.proveedorHabitual}</div>
        </div>
      </div>

      <h3 style="color: #026669; margin-top: 20px;">💰 Análisis de Costos</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px;">
          <div style="font-size: 12px; color: #0d47a1;">Costo Unitario Actual</div>
          <div style="font-size: 24px; font-weight: bold; color: #0d47a1;">ARS ${kardex.costoUnitario.toFixed(2)}</div>
        </div>
        <div style="background: #e8f5e9; padding: 15px; border-radius: 5px;">
          <div style="font-size: 12px; color: #1b5e20;">Costo Promedio Ponderado</div>
          <div style="font-size: 24px; font-weight: bold; color: #1b5e20;">ARS ${kardex.costoPromedio.toFixed(2)}</div>
        </div>
        <div style="background: ${kardex.diferenciaCosto >= 0 ? '#fff3e0' : '#fce4ec'}; padding: 15px; border-radius: 5px;">
          <div style="font-size: 12px; color: ${kardex.diferenciaCosto >= 0 ? '#e65100' : '#880e4f'};">Diferencia</div>
          <div style="font-size: 20px; font-weight: bold; color: ${kardex.diferenciaCosto >= 0 ? '#e65100' : '#880e4f'};">
            ${kardex.diferenciaCosto >= 0 ? '+' : ''}ARS ${kardex.diferenciaCosto.toFixed(2)} (${kardex.porcentajeDiferencia.toFixed(1)}%)
          </div>
        </div>
        <div style="background: #f3e5f5; padding: 15px; border-radius: 5px;">
          <div style="font-size: 12px; color: #4a148c;">Valor Total Inventario</div>
          <div style="font-size: 24px; font-weight: bold; color: #4a148c;">ARS ${kardex.valorInventario.toFixed(2)}</div>
        </div>
      </div>

      <h3 style="color: #026669;">📋 Historial de Compras</h3>
      ${kardex.historial.length > 0 ? `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background: #026669; color: white;">
              <th style="padding: 10px; text-align: left;">Fecha</th>
              <th style="padding: 10px; text-align: left;">Proveedor</th>
              <th style="padding: 10px; text-align: right;">Cantidad</th>
              <th style="padding: 10px; text-align: right;">Precio Unit.</th>
              <th style="padding: 10px; text-align: right;">Subtotal</th>
              <th style="padding: 10px; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${kardex.historial.map(compra => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;">${new Date(compra.fecha).toLocaleDateString()}</td>
                <td style="padding: 8px;">${compra.proveedor}</td>
                <td style="padding: 8px; text-align: right;">${compra.cantidad}</td>
                <td style="padding: 8px; text-align: right;">ARS ${compra.precioUnitario.toFixed(2)}</td>
                <td style="padding: 8px; text-align: right;">ARS ${compra.subtotal.toFixed(2)}</td>
                <td style="padding: 8px; text-align: center;">
                  <span style="padding: 2px 8px; border-radius: 3px; font-size: 11px;
                    ${compra.estado === 'Entregado' ? 'background: #d4edda; color: #155724;' :
                      compra.estado === 'En Tránsito' ? 'background: #fff3cd; color: #856404;' :
                      'background: #f8d7da; color: #721c24;'}">
                    ${compra.estado}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color: #666; font-style: italic;">No hay historial de compras registrado</p>'}

      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
        <p style="margin: 5px 0; font-size: 12px; color: #666;">
          <strong>Primera compra:</strong> ${kardex.primeraCompra ? new Date(kardex.primeraCompra).toLocaleDateString() : 'Sin datos'}
          | <strong>Última compra:</strong> ${kardex.ultimaCompra ? new Date(kardex.ultimaCompra).toLocaleDateString() : 'Sin datos'}
          | <strong>Total histórico:</strong> ${kardex.totalComprado} unidades por ARS ${kardex.totalInvertido.toFixed(2)}
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

/**
 * Exporta el reporte de kardex a Excel/CSV
 */
function exportKardexToExcel() {
  console.log('📤 Exportando kardex a Excel...');

  // Validar state antes de proceder
  if (!validarState()) {
    console.error('❌ No se pudo validar state en exportKardexToExcel');
    return;
  }

  const productos = Object.values(state.productos);
  const kardexData = [];

  productos.forEach(producto => {
    const kardex = calcularKardexPromedio(producto.sku, producto);
    if (kardex) {
      kardexData.push(kardex);
    }
  });

  // Crear headers CSV
  let csv = 'SKU,Nombre,Stock Actual,Costo Unitario,Costo Promedio,Diferencia,Porcentaje,Valor Inventario,Proveedor,Total Comprado,Total Invertido\n';

  // Agregar datos
  kardexData.forEach(kardex => {
    const row = [
      kardex.sku,
      `"${kardex.nombre.replace(/"/g, '""')}"`,
      kardex.stockActual,
      kardex.costoUnitario.toFixed(2),
      kardex.costoPromedio.toFixed(2),
      kardex.diferenciaCosto.toFixed(2),
      kardex.porcentajeDiferencia.toFixed(2) + '%',
      kardex.valorInventario.toFixed(2),
      `"${kardex.proveedorHabitual}"`,
      kardex.totalComprado,
      kardex.totalInvertido.toFixed(2)
    ];
    csv += row.join(',') + '\n';
  });

  // Crear blob y descargar
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `kardex_promedio_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('✅ Kardex exportado exitosamente');
}

/**
 * Filtra la tabla de kardex por texto de búsqueda
 */
function filterKardexTable() {
  const searchTerm = document.getElementById('kardex-search')?.value?.toLowerCase() || '';
  const tableRows = document.querySelectorAll('#kardex-table-body tr');

  tableRows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

/**
 * Filtra la tabla de kardex por categoría de diferencia
 */
function filterKardexByDiffCategory() {
  const filter = document.getElementById('kardex-diff-filter')?.value || 'all';
  const tableRows = document.querySelectorAll('#kardex-table-body tr');

  tableRows.forEach(row => {
    const diffCell = row.querySelector('td:nth-child(7)');
    if (!diffCell) return;

    const diffText = diffCell.textContent;

    if (filter === 'all') {
      row.style.display = '';
    } else if (filter === 'positive' && diffText.includes('+')) {
      row.style.display = '';
    } else if (filter === 'negative' && !diffText.includes('+') && !diffText.includes('Igual')) {
      row.style.display = '';
    } else if (filter === 'equal' && diffText.includes('Igual')) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ========================================================
// FUNCIONES WRAPPER PARA COMPATIBILIDAD CON EL HTML
// ========================================================

/**
 * Función wrapper para calcular kardex general (llamada desde el botón del HTML)
 * Nota: Renombrada para evitar conflicto con calcularKardexPromedio(sku, producto)
 */
function calcularKardexPromedioGeneral() {
  console.log('📊 Iniciando cálculo de Kardex Promedio...');

  // Obtener filtros
  const fechaInicio = document.getElementById('kardex-fecha-inicio')?.value;
  const fechaFin = document.getElementById('kardex-fecha-fin')?.value;
  const proveedor = document.getElementById('kardex-proveedor')?.value;
  const categoria = document.getElementById('kardex-categoria')?.value;

  // Debug: Verificar state
  console.log('📦 State disponible:', typeof state !== 'undefined');
  console.log('📦 Productos disponibles:', state.productos ? Object.keys(state.productos).length : 0);
  
  if (!state.productos || Object.keys(state.productos).length === 0) {
    console.warn('⚠️ No hay productos en el inventario');
    alert('⚠️ No hay productos registrados en el inventario.\n\nAgrega productos primero antes de calcular el kardex.');
    return;
  }

  // Obtener todos los productos
  const productos = Object.values(state.productos);
  console.log(`📋 Productos encontrados: ${productos.length}`);
  
  let kardexData = [];
  let errores = 0;

  productos.forEach(producto => {
    // Aplicar filtros de categoría
    if (categoria && producto.category !== categoria) {
      return;
    }

    // Usar la función original que calcula kardex individual
    const kardex = calcularKardexPromedio(producto.sku, producto);
    if (kardex) {
      kardexData.push(kardex);
    } else {
      errores++;
      console.warn(`⚠️ Error calculando kardex para: ${producto.sku} - ${producto.name}`);
    }
  });

  console.log(`📊 Kardex calculado: ${kardexData.length} productos (${errores} errores)`);

  // DEBUG: Verificar datos antes de filtros
  console.log(`🔍 DEBUG: Datos antes de filtros:`, kardexData.map(k => ({nombre: k.nombre, ultimaCompra: k.ultimaCompra, proveedor: k.proveedorHabitual})));
  console.log(`🔍 DEBUG: Filtros activos - inicio: "${fechaInicio}", fin: "${fechaFin}", proveedor: "${proveedor}", categoria: "${categoria}"`);

  // Aplicar filtro de categoría
  if (categoria) {
    console.log(`🔍 DEBUG: Aplicando filtro categoria: ${categoria}`);
    kardexData = kardexData.filter(k => k.categoria === categoria);
    console.log(`🔍 DEBUG: Despues filtro categoria: ${kardexData.length} productos`);
  }

  // Aplicar filtro de proveedor (basado en proveedor habitual)
  if (proveedor) {
    console.log(`🔍 DEBUG: Aplicando filtro proveedor: ${proveedor}`);
    kardexData = kardexData.filter(k => k.proveedorHabitual === proveedor);
    console.log(`🔍 DEBUG: Despues filtro proveedor: ${kardexData.length} productos`);
  }

  // Aplicar filtro de fecha (basado en última compra) - SOLO si hay fechas válidas
  // Los productos SIN fecha de última compra se incluyen por defecto (no se excluyen)
  if (fechaInicio && fechaFin) {
    console.log(`🔍 DEBUG: Aplicando filtros de fecha: ${fechaInicio} a ${fechaFin}`);
    const fechaInicioObj = new Date(fechaInicio);
    const fechaFinObj = new Date(fechaFin + 'T23:59:59');
    
    kardexData = kardexData.filter(k => {
      if (!k.ultimaCompra) {
        // Producto sin fecha de última compra - INCLUIRLO igualmente
        console.log(`🔍 DEBUG: Producto "${k.nombre}" sin fecha, INCLUIDO por defecto`);
        return true;
      }
      const fechaCompra = new Date(k.ultimaCompra);
      const cumple = fechaCompra >= fechaInicioObj && fechaCompra <= fechaFinObj;
      if (!cumple) {
        console.log(`🔍 DEBUG: Producto "${k.nombre}" fecha=${k.ultimaCompra} fuera de rango, excluido`);
      }
      return cumple;
    });
    console.log(`🔍 DEBUG: Despues filtros de fecha: ${kardexData.length} productos`);
  } else {
    console.log(`🔍 DEBUG: No hay filtros de fecha activos (valores: inicio="${fechaInicio}", fin="${fechaFin}")`);
  }

  // Ordenar por valor de inventario
  kardexData.sort((a, b) => b.valorInventario - a.valorInventario);

  // Guardar en variable global para uso compartido
  kardexDataGlobal = kardexData;
  console.log(`📊 Datos guardados en kardexDataGlobal: ${kardexDataGlobal.length} productos`);

  // Renderizar
  console.log(`📊 Llamando a renderKardexChartsFiltered con ${kardexDataGlobal.length} productos`);
  renderKardexChartsFiltered(kardexDataGlobal);
  console.log(`📊 Llamando a renderKardexTable con ${kardexDataGlobal.length} productos`);
  renderKardexTable(kardexDataGlobal);
  console.log(`📊 Llamando a renderKardexSummary con ${kardexDataGlobal.length} productos`);
  renderKardexSummary(kardexDataGlobal);

  console.log(`✅ Kardex calculado: ${kardexDataGlobal.length} productos`);
}

/**
 * Renderiza los gráficos del kardex con los IDs específicos del HTML
 * @param {Array} kardexData - Datos del kardex
 */
function renderKardexChartsFiltered(kardexData) {
  // 🚨 CRÍTICO: Si no hay datos, solo destruir gráficos y salir
  if (!kardexData || kardexData.length === 0) {
    console.log('📊 No hay datos para mostrar en gráficos de kardex');
    destroyKardexCharts();
    return;
  }

  // 🚨 CRÍTICO: Destruir todos los gráficos anteriores de forma segura
  destroyKardexCharts();

  const colors = {
    primary: '#026669',
    secondary: '#17a2b8',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    light: '#f8f9fa',
    dark: '#343a40',
    purple: '#6f42c1',
    pink: '#e83e8c',
    orange: '#fd7e14',
    teal: '#20c997'
  };

  // ============ GRÁFICO 1: ROTACIÓN POR PRODUCTO ============
  const ctxRotacion = document.getElementById('kardex-rotacion-chart');
  if (ctxRotacion) {
    const top10Rotacion = kardexData.slice(0, 10);

    kardexChartRotacion = new Chart(ctxRotacion, {
      type: 'bar',
      data: {
        labels: top10Rotacion.map(k => k.nombre.substring(0, 15) + (k.nombre.length > 15 ? '...' : '')),
        datasets: [{
          label: 'Rotación (veces)',
          data: top10Rotacion.map(k => k.totalComprado > 0 ? Math.round((k.stockActual / k.totalComprado) * 100) / 100 : 0),
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Rotación de Inventario por Producto (Top 10)',
            font: { size: 14 }
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Veces' }
          }
        }
      }
    });
  }

  // ============ GRÁFICO 2: ENTRADAS VS SALIDAS ============
  const ctxComparacion = document.getElementById('kardex-comparacion-chart');
  if (ctxComparacion) {
    let totalEntradas = 0;
    let totalSalidas = 0;

    kardexData.forEach(k => {
      totalEntradas += k.totalComprado;
      // Estimación de salidas basadas en el stock actual vs compras
      const ventasEstimadas = k.totalComprado - (k.stockActual > k.totalComprado ? k.totalComprado : k.stockActual);
      totalSalidas += Math.max(0, ventasEstimadas);
    });

    kardexChartComparacion = new Chart(ctxComparacion, {
      type: 'pie',
      data: {
        labels: ['Entradas (Compras)', 'Salidas (Estimadas)'],
        datasets: [{
          data: [totalEntradas, totalSalidas],
          backgroundColor: [colors.success, colors.danger],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Entradas vs Salidas de Inventario',
            font: { size: 14 }
          },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  // ============ GRÁFICO 3: EVOLUCIÓN DEL INVENTARIO PROMEDIO ============
  const ctxEvolucion = document.getElementById('kardex-evolucion-chart');
  if (ctxEvolucion) {
    // Calcular promedio por mes
    const mesesData = {};
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentYear = new Date().getFullYear();

    kardexData.forEach(k => {
      k.historial.forEach(compra => {
        const fecha = new Date(compra.fecha);
        if (fecha.getFullYear() === currentYear) {
          const mesKey = `${mesesNombres[fecha.getMonth()]}-${fecha.getFullYear()}`;
          if (!mesesData[mesKey]) {
            mesesData[mesKey] = { total: 0, count: 0 };
          }
          mesesData[mesKey].total += compra.cantidad;
          mesesData[mesKey].count++;
        }
      });
    });

    const labels = Object.keys(mesesData).sort((a, b) => {
      const [mesA, añoA] = a.split('-');
      const [mesB, añoB] = b.split('-');
      if (añoA !== añoB) return parseInt(añoA) - parseInt(añoB);
      return mesesNombres.indexOf(mesA) - mesesNombres.indexOf(mesB);
    });

    kardexChartEvolucion = new Chart(ctxEvolucion, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Unidades Promedio',
          data: labels.map(m => mesesData[m].count > 0 ? mesesData[m].total / mesesData[m].count : 0),
          borderColor: colors.info,
          backgroundColor: 'rgba(23, 162, 184, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Evolución del Inventario Promedio (Año Actual)',
            font: { size: 14 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Unidades' }
          }
        }
      }
    });
  }

  // ============ GRÁFICO 4: TOP 10 PRODUCTOS CON MAYOR ROTACIÓN ============
  const ctxTop = document.getElementById('kardex-top-chart');
  if (ctxTop) {
    // Calcular rotación para cada producto
    const productosConRotacion = kardexData.map(k => ({
      ...k,
      rotacion: k.totalComprado > 0 ? (k.stockActual / k.totalComprado) : 0
    }));

    // Ordenar por rotación descendente
    productosConRotacion.sort((a, b) => b.rotacion - a.rotacion);
    const top10 = productosConRotacion.slice(0, 10);

    const gradient = ctxTop.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 0.8)');
    gradient.addColorStop(1, 'rgba(118, 75, 162, 0.8)');

    kardexChartTop = new Chart(ctxTop, {
      type: 'bar',
      data: {
        labels: top10.map(k => k.nombre.substring(0, 12) + (k.nombre.length > 12 ? '...' : '')),
        datasets: [{
          label: 'Índice de Rotación',
          data: top10.map(k => k.rotacion),
          backgroundColor: gradient,
          borderColor: colors.purple,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          title: {
            display: true,
            text: 'TOP 10 - Productos con Mayor Rotación',
            font: { size: 14 }
          },
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Índice de Rotación' }
          }
        }
      }
    });
  }
}

/**
 * Filtra la tabla de kardex en tiempo real
 * @param {string} term - Término de búsqueda
 */
function filtrarKardex(term) {
  if (!term) {
    // Si no hay término, mostrar todos
    document.querySelectorAll('#kardex-table-body tr').forEach(row => {
      row.style.display = '';
    });
    return;
  }

  const searchTerm = term.toLowerCase();
  const tableRows = document.querySelectorAll('#kardex-table-body tr');

  tableRows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

/**
 * Exporta el kardex a PDF
 */
function exportarKardexPDF() {
  console.log('📄 Exportando kardex a PDF...');

  const kardexSection = document.getElementById('kardex');
  if (!kardexSection) {
    alert('Error: No se encontró la sección de kardex');
    return;
  }

  // Crear contenido temporal para el PDF
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: #026669; text-align: center;">📊 Reporte de Kardex Promedio</h1>
      <p style="text-align: center; color: #666;">Generado el: ${new Date().toLocaleDateString()}</p>
      <hr style="margin: 20px 0;">
      ${kardexSection.innerHTML}
    </div>
  `;

  // Configuración para html2pdf
  const opt = {
    margin: 10,
    filename: `kardex_promedio_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  // Verificar si html2pdf está disponible
  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(tempDiv).save();
    console.log('✅ PDF exportado exitosamente');
  } else {
    // Alternativa: abrir en nueva ventana para imprimir
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte Kardex Promedio</title>
          <link rel="stylesheet" href="css/styles.css">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">🖨️ IMPRIMIR</button>
            <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer;">❌ CERRAR</button>
          </div>
          ${tempDiv.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    console.log('✅ Ventana de impresión abierta');
  }
}

/**
 * Exporta el kardex a Excel (wrapper)
 */
function exportarKardexExcel() {
  console.log('📊 Exportando kardex a Excel...');
  exportKardexToExcel();
}
