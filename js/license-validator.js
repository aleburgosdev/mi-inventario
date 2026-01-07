/**
 * =========================================================
 * SISTEMA DE VALIDACIÓN DE LICENCIAS - LICENSE VALIDATOR
 * Archivo separado para gestión completa de licencias
 * Compatible con Firebase Realtime Database
 * =========================================================
 */

// URL base de Firebase para licencias
const LICENSE_FIREBASE_URL = 'https://licencias-378d4-default-rtdb.firebaseio.com';

// Estado global del sistema de licencias
let licenseState = {
  isValid: false,
  isInitialized: false,
  currentLicense: null,
  validationInterval: null,
  isChecking: false
};

/**
 * =========================================================
 * FUNCIONES PRINCIPALES DE INICIALIZACIÓN
 * =========================================================
 */

/**
 * Inicializa el sistema de validación de licencias
 * Se ejecuta al cargar la aplicación
 */
async function initializeLicenseSystem() {
  try {
    console.log('🔒 ===============================================');
    console.log('🔒 INICIANDO SISTEMA DE LICENCIAS');
    console.log('🔒 ===============================================');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('🌐 URL actual:', window.location.href);
    console.log('💾 LocalStorage disponible:', typeof localStorage !== 'undefined');
    
    // Verificar si hay una licencia guardada localmente
    console.log('🔍 🔍 🔍 VERIFICANDO LICENCIA GUARDADA...');
    const savedLicense = getSavedLicense();
    
    console.log('🔍 Resultado de getSavedLicense():', savedLicense);
    console.log('🔍 ¿savedLicense existe?:', !!savedLicense);
    console.log('🔍 ¿savedLicense.code existe?:', savedLicense && !!savedLicense.code);
    
    if (savedLicense && savedLicense.code) {
      console.log('✅ ✅ ✅ LICENCIA ENCONTRADA - PROCEDIENDO CON VALIDACIÓN');
      console.log('📋 ✅ LICENCIA ENCONTRADA EN LOCALSTORAGE');
      console.log('📋 Código:', savedLicense.code);
      console.log('📋 Guardada el:', savedLicense.savedAt);
      console.log('📋 DeviceId:', savedLicense.deviceId);
      
      try {
        console.log('🔄 🔄 🔄 INICIANDO VALIDACIÓN DE LICENCIA GUARDADA...');
        console.log('🔄 Código a validar:', savedLicense.code);
        console.log('🔄 Timestamp de guardado:', savedLicense.savedAt);
        
        const validationResult = await validateLicense(savedLicense.code);
        
        console.log('📊 📊 📊 RESULTADO DE VALIDACIÓN COMPLETO:');
        console.log('📊 isValid:', validationResult.isValid);
        console.log('📊 error:', validationResult.error);
        console.log('📊 license:', validationResult.license);
        
        if (validationResult.isValid) {
          console.log('✅ ✅ ✅ LICENCIA VÁLIDA - INICIANDO APLICACIÓN');
          console.log('📋 Datos de licencia validada:', validationResult.license);
          
          licenseState.isValid = true;
          licenseState.currentLicense = validationResult.license;
          showApplication();
          startLicenseValidationMonitoring();
          
          console.log('✅ ✅ ✅ APLICACIÓN INICIADA CORRECTAMENTE');
        } else {
          console.log('❌ ❌ ❌ LICENCIA GUARDADA NO ES VÁLIDA');
          console.log('❌ Error:', validationResult.error);
          console.log('🔍 MANTENIENDO licencia en localStorage para debugging');
          console.log('🔍 Ejecutar: checkLicenseStatus("' + savedLicense.code + '") en consola');
          
          // NO borrar inmediatamente - mantener para debug
          showLicenseScreen();
        }
      } catch (validationError) {
        console.error('❌ ❌ ❌ ERROR VALIDANDO LICENCIA GUARDADA');
        console.error('❌ Error completo:', validationError);
        console.log('🔍 MANTENIENDO licencia en localStorage debido al error de red');
        console.log('🔍 Verificar conectividad y reintentar manualmente');
        // NO borrar la licencia si hay error de red u otro problema
        showLicenseScreen();
      }
    } else {
      console.log('🚫 ❌ ❌ ❌ NO SE ENCONTRÓ LICENCIA VÁLIDA GUARDADA');
      console.log('🚫 🔍 Análisis detallado:');
      console.log('🚫 savedLicense:', savedLicense);
      console.log('🚫 savedLicense existe:', !!savedLicense);
      console.log('🚫 savedLicense.code existe:', savedLicense && !!savedLicense.code);
      console.log('🚫 🔍 Posibles causas:');
      console.log('  1. Primera vez usando la aplicación');
      console.log('  2. Licencia guardada previamente borrada');
      console.log('  3. Error leyendo localStorage');
      console.log('  4. Datos de licencia corruptos');
      console.log('  5. Formato de código inválido');
      console.log('🚫 💡 Para debuggear, ejecuta: diagnosticarLocalStorage()');
      showLicenseScreen();
    }
    
    licenseState.isInitialized = true;
    updateLicenseStatusIndicator('Sistema inicializado', '#28a745');
    console.log('🔒 ✅ SISTEMA DE LICENCIAS INICIALIZADO COMPLETAMENTE');
    
  } catch (error) {
    console.error('❌ ❌ ❌ ERROR CRÍTICO INICIALIZANDO SISTEMA');
    console.error('❌ Error completo:', error);
    updateLicenseStatusIndicator('Error de inicialización', '#dc3545');
    showLicenseScreen();
  }
}

/**
 * =========================================================
 * PANTALLA DE LICENCIAS Y BLOQUEO
 * =========================================================
 */

/**
 * Muestra la pantalla de licencias (bloqueo de aplicación)
 */
function showLicenseScreen() {
  const licenseScreen = document.getElementById('license-screen') || createLicenseScreen();
  licenseScreen.style.display = 'flex';
  
  // Ocultar aplicación principal
  const appContainer = document.querySelector('.app');
  if (appContainer) {
    appContainer.style.display = 'none';
  }
  
  // Ocultar chatbot si está visible
  const chatbotWidget = document.getElementById('chatbot-widget');
  const chatbotTrigger = document.getElementById('chatbot-trigger');
  
  if (chatbotWidget) {
    chatbotWidget.style.display = 'none';
  }
  
  if (chatbotTrigger) {
    chatbotTrigger.style.display = 'none';
  }
  
  updateLicenseStatusIndicator('🔒 Esperando licencia válida', '#ffc107');
}

/**
 * Crea la pantalla de licencias si no existe
 */
function createLicenseScreen() {
  const licenseScreen = document.createElement('div');
  licenseScreen.id = 'license-screen';
  licenseScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  `;
  
  licenseScreen.innerHTML = `
    <div style="
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
      text-align: center;
      animation: slideIn 0.5s ease-out;
    ">
      <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
      <h2 style="color: #333; margin-bottom: 10px; font-size: 28px;">Control de Inventario</h2>
      <p style="color: #666; margin-bottom: 30px; font-size: 16px;">Ingresa tu código de licencia para continuar</p>
      
      <div style="margin-bottom: 20px;">
        <input 
          type="text" 
          id="license-input" 
          placeholder="Ej: INV-CODIGO-LICENCIA"
          style="
            width: 100%;
            padding: 15px;
            border: 2px solid #e1e5e9;
            border-radius: 10px;
            font-size: 16px;
            text-align: center;
            font-family: monospace;
            box-sizing: border-box;
          "
          onkeydown="if(event.key==='Enter') validateLicenseInput()"
        />
      </div>
      
      <div id="license-error" style="
        color: #dc3545;
        background: #f8d7da;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 20px;
        display: none;
        font-size: 14px;
      "></div>
      
      <button 
        onclick="validateLicenseInput()"
        id="validate-license-btn"
        style="
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          transition: all 0.3s ease;
        "
        onmouseover="this.style.transform='translateY(-2px)'"
        onmouseout="this.style.transform='translateY(0)'"
      >
        🔍 Validar Licencia
      </button>
      
      <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: left;">
        <h4 style="margin: 0 0 10px 0; color: #333;">ℹ️ Información:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px;">
          <li>Las licencias de prueba expiran automáticamente</li>
          <li>Las licencias estándar no expiran</li>
          <li>Cada licencia solo se puede usar en un dispositivo</li>
        </ul>
      </div>
    </div>
    
    <style>
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-50px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  `;
  
  document.body.appendChild(licenseScreen);
  return licenseScreen;
}

/**
 * Muestra la aplicación principal después de validar licencia
 */
function showApplication() {
  // Ocultar pantalla de licencias
  const licenseScreen = document.getElementById('license-screen');
  if (licenseScreen) {
    licenseScreen.style.display = 'none';
  }
  
  // Mostrar aplicación principal
  const appContainer = document.querySelector('.app');
  if (appContainer) {
    appContainer.style.display = 'flex';
  }
  
  // Mostrar chatbot si el usuario está logueado
  if (typeof isLoggedIn !== 'undefined' && isLoggedIn) {
    // Usar safeShowChatbot para mantener consistencia
    if (typeof safeShowChatbot === 'function') {
      safeShowChatbot();
    } else {
      // Fallback manual
      const chatbotTrigger = document.getElementById('chatbot-trigger');
      if (chatbotTrigger) {
        chatbotTrigger.style.display = 'flex';
      }
    }
  }
}

/**
 * =========================================================
 * VALIDACIÓN DE LICENCIAS
 * =========================================================
 */

/**
 * Valida un código de licencia contra Firebase
 * 
 * LÓGICA DE VALIDACIÓN MEJORADA:
 * - Si la licencia está en localStorage, significa que fue validada en este dispositivo
 * - Una licencia activada en este mismo dispositivo debe seguir siendo válida
 * - Solo se rechaza si la licencia está en localStorage de OTRO dispositivo
 */
async function validateLicense(licenseCode) {
  if (!licenseCode) {
    return { isValid: false, error: 'Código de licencia requerido' };
  }
  
  try {
    console.log('🔍 Validando licencia:', licenseCode);
    console.log('🔍 Timestamp:', new Date().toISOString());
    
    // Obtener licencia desde Firebase
    const license = await fetchLicenseFromFirebase(licenseCode);
    
    if (!license) {
      return { isValid: false, error: 'Licencia no encontrada en el sistema' };
    }
    
    // Validar estructura de licencia
    const validation = validateLicenseStructure(license);
    if (!validation.isValid) {
      return { isValid: false, error: validation.error };
    }
    
    // Verificar estado de la licencia
    if (license.status !== 'active') {
      return { isValid: false, error: `Licencia ${license.status}. Contacta al administrador` };
    }
    
    // Verificar expiración para licencias de prueba
    if (license.isTrial && license.expirationDate) {
      const now = new Date();
      const expiration = new Date(license.expirationDate);
      
      if (now >= expiration) {
        return { isValid: false, error: 'Licencia de prueba ha expirado' };
      }
    }
    
    // 🔒 VALIDACIÓN ANTI-PIRATEO: Verificar si la licencia ya está activada
    const currentDeviceId = getDeviceId();
    
    console.log('🔍 Verificando estado de deviceId:', license.deviceId);
    console.log('🔍 DeviceId actual (este dispositivo):', currentDeviceId);
    console.log('🔍 DeviceId de la licencia (Firebase):', license.deviceId);
    
    // Si deviceId es "Activada" o cualquier valor, verificar si es la misma licencia del mismo dispositivo
    if (license.deviceId === 'Activada' || (license.deviceId && license.deviceId !== 'pending_activation')) {
      console.log('⚠️ Licencia ya activada anteriormente con deviceId:', license.deviceId);
      
      // IMPORTANTE: Si la licencia está en localStorage, significa que fue activada en este dispositivo
      // No debería fallar la validación si ya está guardada localmente
      const savedLicense = getSavedLicense();
      if (savedLicense && savedLicense.code === license.code) {
        console.log('✅ ✅ ✅ LICENCIA GUARDADA LOCALMENTE - ES LA MISMA LICENCIA DEL MISMO DISPOSITIVO');
        console.log('✅ Permitiendo uso de licencia ya activada en este dispositivo');
        console.log('📋 Licencia guardada:', savedLicense.code);
        console.log('📋 DeviceId guardado:', savedLicense.deviceId);
        return { isValid: true, license: license };
      } else {
        console.log('❌ Licencia activada en otro dispositivo diferente');
        return { 
          isValid: false, 
          error: '❌ Esta licencia ya fue activada en otro dispositivo y no puede utilizarse aquí. Contacta al administrador para una nueva licencia.' 
        };
      }
    }
    
    // Si deviceId tiene un valor específico (no es pending_activation), verificar si es el mismo dispositivo
    if (license.deviceId && license.deviceId !== 'pending_activation') {
      console.log('⚠️ Licencia activada anteriormente con deviceId específico');
      
      // Verificar si es el mismo deviceId que estamos usando actualmente
      if (license.deviceId === currentDeviceId) {
        console.log('✅ ✅ ✅ MISMO DISPOSITIVO - PERMITIENDO USO');
        return { isValid: true, license: license };
      } else {
        console.log('❌ ❌ ❌ OTRO DISPOSITIVO - RECHAZANDO');
        return { 
          isValid: false, 
          error: '⚠️ Esta licencia ya fue activada en otro dispositivo y no puede utilizarse aquí. Contacta al administrador.' 
        };
      }
    }
    
    // Solo las licencias con deviceId = "pending_activation" pueden activarse
    if (license.deviceId === 'pending_activation') {
      console.log('🔄 Activando licencia por primera vez...');
      await activateLicense(licenseCode);
      
      // Actualizar la licencia local con los nuevos datos
      const updatedLicense = await fetchLicenseFromFirebase(licenseCode);
      console.log('✅ Licencia activada exitosamente');
      return { isValid: true, license: updatedLicense };
    }
    
    // Si no hay deviceId (caso edge), activar la licencia
    if (!license.deviceId) {
      console.log('🔄 Activando licencia (sin deviceId)...');
      await activateLicense(licenseCode);
      
      const updatedLicense = await fetchLicenseFromFirebase(licenseCode);
      return { isValid: true, license: updatedLicense };
    }
    
    // Si llegamos aquí, algo inesperado ocurrió
    return { 
      isValid: false, 
      error: 'Error inesperado al validar licencia. Contacta al administrador.' 
    };
    
  } catch (error) {
    console.error('❌ Error validando licencia:', error);
    return { isValid: false, error: 'Error de conexión con el sistema de licencias' };
  }
}

/**
 * Obtiene una licencia desde Firebase
 */
async function fetchLicenseFromFirebase(licenseCode) {
  try {
    const response = await fetch(`${LICENSE_FIREBASE_URL}/licenses/${licenseCode}.json`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const license = await response.json();
    return license;
    
  } catch (error) {
    console.error('Error obteniendo licencia desde Firebase:', error);
    throw error;
  }
}

/**
 * Valida la estructura de una licencia
 */
function validateLicenseStructure(license) {
  const requiredFields = ['code', 'clientName', 'clientEmail', 'status', 'createdAt'];
  
  for (const field of requiredFields) {
    if (!license[field]) {
      return { isValid: false, error: `Campo requerido faltante: ${field}` };
    }
  }
  
  // Validar formato de código
  if (!license.code.startsWith('INV-')) {
    return { isValid: false, error: 'Formato de código de licencia inválido' };
  }
  
  return { isValid: true };
}

/**
 * Activa una licencia (actualiza deviceId y validationCount)
 */
async function activateLicense(licenseCode) {
  try {
    // Obtener la licencia actual para saber el validationCount actual
    const currentLicense = await fetchLicenseFromFirebase(licenseCode);
    const currentValidationCount = currentLicense.validationCount || 0;
    
    const activationData = {
      deviceId: getDeviceId(), // Usar el deviceId real del dispositivo actual
      validationCount: currentValidationCount + 1, // Incrementar contador
      activatedAt: new Date().toISOString(),
      lastValidation: new Date().toISOString()
    };
    
    const response = await fetch(`${LICENSE_FIREBASE_URL}/licenses/${licenseCode}.json`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(activationData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    console.log('🔄 Licencia activada en Firebase:', activationData);
    console.log('✅ Esta licencia ahora está vinculada a este dispositivo específico');
    
  } catch (error) {
    console.error('Error activando licencia:', error);
    throw error;
  }
}

/**
 * =========================================================
 * MANEJO DE INPUT DE LICENCIA
 * =========================================================
 */

/**
 * Procesa el input de licencia desde la pantalla de bloqueo
 */
async function validateLicenseInput() {
  const licenseInput = document.getElementById('license-input');
  const errorDiv = document.getElementById('license-error');
  const validateBtn = document.getElementById('validate-license-btn');
  
  if (!licenseInput || !errorDiv || !validateBtn) {
    console.error('Elementos de interfaz no encontrados');
    return;
  }
  
  const licenseCode = licenseInput.value.trim().toUpperCase();
  
  if (!licenseCode) {
    showError('Por favor ingresa un código de licencia');
    return;
  }
  
  // Mostrar estado de carga
  showLoading(true);
  hideError();
  
  try {
    const result = await validateLicense(licenseCode);
    
    if (result.isValid) {
      // Licencia válida
      console.log('💾 💾 💾 GUARDANDO LICENCIA VÁLIDA...');
      const saveSuccess = saveLicense(licenseCode);
      
      if (saveSuccess) {
        console.log('✅ ✅ ✅ LICENCIA GUARDADA EXITOSAMENTE');
        licenseState.isValid = true;
        licenseState.currentLicense = result.license;
        
        // Verificación adicional inmediata
        console.log('🔍 Verificando que la licencia se guardó correctamente...');
        const savedCheck = localStorage.getItem('app-license');
        if (savedCheck) {
          console.log('✅ ✅ ✅ VERIFICACIÓN INMEDIATA EXITOSA');
          console.log('📋 Licencia guardada confirmada:', JSON.parse(savedCheck));
        } else {
          console.log('❌ ❌ ❌ ERROR: La licencia no se encontró inmediatamente después del guardado');
        }
        
        showSuccess(`✅ Licencia válida\n\nCliente: ${result.license.clientName}\nTipo: ${result.license.isTrial ? 'Prueba' : 'Estándar'}`);
        
        setTimeout(() => {
          showApplication();
          startLicenseValidationMonitoring();
        }, 2000);
      } else {
        console.log('❌ ❌ ❌ ERROR: No se pudo guardar la licencia');
        showError('Error guardando la licencia. La validación fue exitosa pero no se pudo guardar localmente.');
      }
      
    } else {
      // Licencia inválida
      console.log('❌ ❌ ❌ LICENCIA INVÁLIDA - NO SE GUARDA');
      showError(result.error);
    }
    
  } catch (error) {
    console.error('Error validando licencia:', error);
    showError('Error de conexión. Verifica tu internet e intenta nuevamente.');
    
  } finally {
    showLoading(false);
  }
  
  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
  
  function hideError() {
    errorDiv.style.display = 'none';
  }
  
  function showLoading(isLoading) {
    if (isLoading) {
      validateBtn.innerHTML = '<span class="spinner"></span>Validando...';
      validateBtn.disabled = true;
      validateBtn.style.opacity = '0.7';
    } else {
      validateBtn.innerHTML = '🔍 Validar Licencia';
      validateBtn.disabled = false;
      validateBtn.style.opacity = '1';
    }
  }
  
  function showSuccess(message) {
    errorDiv.style.display = 'none';
    
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      color: #28a745;
      background: #d4edda;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      white-space: pre-line;
    `;
    successDiv.textContent = message;
    
    errorDiv.parentNode.insertBefore(successDiv, errorDiv);
    
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }
}

/**
 * =========================================================
 * GESTIÓN DE LOCALSTORAGE
 * =========================================================
 */

/**
 * Guarda una licencia en localStorage
 */
function saveLicense(licenseCode) {
  const licenseData = {
    code: licenseCode.toUpperCase(), // Asegurar que esté en mayúsculas
    savedAt: new Date().toISOString(),
    deviceId: getDeviceId()
  };
  
  console.log('💾 💾 💾 GUARDANDO LICENCIA EN LOCALSTORAGE');
  console.log('💾 Datos a guardar:', licenseData);
  console.log('💾 Timestamp de guardado:', new Date().toISOString());
  
  try {
    // Verificar que localStorage está disponible
    if (typeof localStorage === 'undefined') {
      console.error('❌ localStorage no está disponible');
      throw new Error('localStorage no disponible');
    }
    
    // Convertir a JSON y guardar
    const jsonData = JSON.stringify(licenseData);
    console.log('💾 JSON a guardar:', jsonData);
    
    localStorage.setItem('app-license', jsonData);
    console.log('💾 ✅ Datos guardados en localStorage');
    
    // Verificar que se guardó correctamente
    const verification = localStorage.getItem('app-license');
    if (verification) {
      console.log('✅ ✅ ✅ VERIFICACIÓN DE GUARDADO EXITOSA');
      try {
        const parsedData = JSON.parse(verification);
        console.log('📋 Datos verificados:', parsedData);
        console.log('✅ ✅ ✅ LICENSE GUARDADA Y VERIFICADA CORRECTAMENTE');
        return true;
      } catch (parseError) {
        console.error('❌ Error parseando verificación:', parseError);
        return false;
      }
    } else {
      console.log('❌ ❌ ❌ VERIFICACIÓN FALLÓ - no se encontró la licencia');
      return false;
    }
    
  } catch (error) {
    console.error('❌ ❌ ❌ ERROR GUARDANDO EN LOCALSTORAGE');
    console.error('❌ Error completo:', error);
    console.error('❌ Tipo de error:', error.name, error.message);
    
    // Intentar método alternativo si falla
    try {
      console.log('🔄 🔄 🔄 INTENTANDO MÉTODO ALTERNATIVO (sessionStorage)...');
      sessionStorage.setItem('app-license-backup', JSON.stringify(licenseData));
      console.log('💾 ✅ Licencia guardada en sessionStorage como backup');
      console.log('⚠️ ⚠️ ⚠️ WARNING: Los datos están en sessionStorage, se perderán al cerrar la pestaña');
      return true;
    } catch (backupError) {
      console.error('❌ ❌ ❌ ERROR TAMBIÉN EN SESSIONSTORAGE');
      console.error('❌ Error backup:', backupError);
      return false;
    }
  }
}

/**
 * Obtiene la licencia guardada desde localStorage
 */
function getSavedLicense() {
  console.log('🔍 🔍 🔍 INICIANDO getSavedLicense()');
  
  try {
    // Verificar que localStorage está disponible
    if (typeof localStorage === 'undefined') {
      console.error('❌ localStorage no está disponible');
      return null;
    }
    
    // Intentar leer la licencia
    const saved = localStorage.getItem('app-license');
    console.log('🔍 Resultado de localStorage.getItem("app-license"):', saved);
    console.log('🔍 ¿saved es null/undefined?:', saved === null || saved === undefined);
    console.log('🔍 ¿saved es string vacío?:', saved === '');
    
    if (!saved) {
      console.log('❌ No se encontró licencia en localStorage');
      return null;
    }
    
    if (saved === '') {
      console.log('❌ localStorage tiene valor vacío para app-license');
      return null;
    }
    
    try {
      console.log('🔍 Intentando parsear datos JSON...');
      const licenseData = JSON.parse(saved);
      console.log('📋 Datos parseados exitosamente:', licenseData);
      console.log('📋 Tipo de datos:', typeof licenseData);
      console.log('📋 ¿licenseData es null?:', licenseData === null);
      console.log('📋 ¿licenseData es objeto?:', typeof licenseData === 'object' && licenseData !== null);
      
      if (!licenseData) {
        console.log('❌ licenseData es null después del parse');
        return null;
      }
      
      if (typeof licenseData !== 'object') {
        console.log('❌ licenseData no es un objeto:', typeof licenseData);
        return null;
      }
      
      // Verificar campo code
      console.log('🔍 Verificando campo "code"...');
      console.log('🔍 licenseData.code:', licenseData.code);
      console.log('🔍 ¿code existe?:', 'code' in licenseData);
      console.log('🔍 ¿code no es null/undefined?:', licenseData.code !== null && licenseData.code !== undefined);
      
      if (!licenseData.code) {
        console.log('❌ Campo "code" faltante o vacío');
        console.log('🔍 licenseData completo:', licenseData);
        console.log('🔍 Keys disponibles:', Object.keys(licenseData));
        return null;
      }
      
      // Verificar que code es string
      if (typeof licenseData.code !== 'string') {
        console.log('❌ Campo "code" no es string:', typeof licenseData.code);
        return null;
      }
      
      // Verificar formato INV-
      if (!licenseData.code.startsWith('INV-')) {
        console.log('❌ Formato de código inválido:', licenseData.code);
        console.log('❌ No comienza con "INV-"');
        return null;
      }
      
      // Verificar otros campos importantes
      console.log('🔍 Verificando otros campos...');
      if (licenseData.savedAt) {
        console.log('✅ savedAt presente:', licenseData.savedAt);
      } else {
        console.log('⚠️ savedAt faltante (no crítico)');
      }
      
      if (licenseData.deviceId) {
        console.log('✅ deviceId presente:', licenseData.deviceId);
      } else {
        console.log('⚠️ deviceId faltante (no crítico)');
      }
      
      console.log('✅ ✅ ✅ LICENCIA GUARDADA VÁLIDA ENCONTRADA');
      console.log('📋 Código de licencia:', licenseData.code);
      console.log('📋 Guardada el:', licenseData.savedAt);
      
      return licenseData;
        
    } catch (parseError) {
      console.error('❌ ❌ ❌ ERROR PARSEANDO JSON');
      console.error('❌ Error completo:', parseError);
      console.error('❌ Mensaje del error:', parseError.message);
      console.log('🔍 Datos que fallaron al parsear:', saved);
      console.log('🔍 Longitud de datos:', saved ? saved.length : 'N/A');
      console.log('🔍 Primeros 100 caracteres:', saved ? saved.substring(0, 100) : 'N/A');
      return null;
    }
    
  } catch (error) {
    console.error('❌ ❌ ❌ ERROR GENERAL EN getSavedLicense()');
    console.error('❌ Error completo:', error);
    console.error('❌ Tipo de error:', error.name, error.message);
    return null;
  }
}

/**
 * Limpia la licencia guardada
 */
function clearSavedLicense() {
  try {
    console.log('🗑️ 🗑️ 🗑️ ELIMINANDO LICENCIA GUARDADA');
    
    // Verificar qué hay antes de eliminar
    const beforeDelete = localStorage.getItem('app-license');
    console.log('🔍 Antes de eliminar:', beforeDelete ? 'Hay licencia' : 'No hay licencia');
    
    localStorage.removeItem('app-license');
    console.log('🗑️ Comando de eliminación ejecutado');
    
    // Verificar que se eliminó
    const verification = localStorage.getItem('app-license');
    if (verification) {
      console.log('❌ ❌ ❌ ERROR: La licencia aún existe después de la eliminación');
    } else {
      console.log('✅ ✅ ✅ Licencia eliminada exitosamente');
    }
    
  } catch (error) {
    console.error('❌ ❌ ❌ Error eliminando licencia de localStorage:', error);
  }
}

/**
 * =========================================================
 * MONITOREO Y ACTUALIZACIÓN
 * =========================================================
 */

/**
 * Inicia el monitoreo continuo de la licencia
 */
function startLicenseValidationMonitoring() {
  // Validar cada 5 minutos
  if (licenseState.validationInterval) {
    clearInterval(licenseState.validationInterval);
  }
  
  licenseState.validationInterval = setInterval(async () => {
    if (licenseState.isValid && licenseState.currentLicense) {
      await checkLicenseValidity();
    }
  }, 300000); // 5 minutos
  
  // Validar inmediatamente
  setTimeout(() => {
    checkLicenseValidity();
  }, 1000);
}

/**
 * Verifica la validez actual de la licencia
 */
async function checkLicenseValidity() {
  if (licenseState.isChecking || !licenseState.currentLicense) {
    return;
  }
  
  licenseState.isChecking = true;
  
  try {
    const license = await fetchLicenseFromFirebase(licenseState.currentLicense.code);
    
    if (!license) {
      console.log('❌ Licencia no encontrada en Firebase');
      handleLicenseInvalid();
      return;
    }
    
    // Verificar si la licencia fue revocada
    if (license.status !== 'active') {
      console.log('❌ Licencia revocada');
      handleLicenseInvalid('Licencia revocada por el administrador');
      return;
    }
    
    // Verificar expiración para licencias de prueba
    if (license.isTrial && license.expirationDate) {
      const now = new Date();
      const expiration = new Date(license.expirationDate);
      
      if (now >= expiration) {
        console.log('❌ Licencia de prueba expirada');
        handleLicenseInvalid('Licencia de prueba ha expirado');
        return;
      }
      
      // Actualizar tiempo restante si está próximo a expirar
      const timeRemaining = expiration - now;
      const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
      
      if (daysRemaining <= 1) {
        updateLicenseStatusIndicator(`⚠️ Expira en ${daysRemaining} día`, '#ffc107');
      } else if (daysRemaining <= 3) {
        updateLicenseStatusIndicator(`⏰ Expira en ${daysRemaining} días`, '#fd7e14');
      }
    }
    
    // Actualizar última validación
    await updateLastValidation(licenseState.currentLicense.code);
    
    if (licenseState.currentLicense.isTrial) {
      updateLicenseStatusIndicator('🧪 Licencia de prueba activa', '#17a2b8');
    } else {
      updateLicenseStatusIndicator('⭐ Licencia estándar activa', '#28a745');
    }
    
  } catch (error) {
    console.error('Error verificando validez de licencia:', error);
    updateLicenseStatusIndicator('⚠️ Error de conexión', '#ffc107');
  } finally {
    licenseState.isChecking = false;
  }
}

/**
 * Maneja cuando una licencia se vuelve inválida
 */
function handleLicenseInvalid(reason = 'Licencia no válida') {
  licenseState.isValid = false;
  licenseState.currentLicense = null;
  clearSavedLicense();
  
  updateLicenseStatusIndicator('🔒 Licencia inválida', '#dc3545');
  
  // Mostrar mensaje y volver a pantalla de licencias
  alert(`⚠️ ${reason}\n\nLa aplicación se reiniciará para validar una nueva licencia.`);
  
  setTimeout(() => {
    showLicenseScreen();
  }, 2000);
}

/**
 * Actualiza la última validación en Firebase
 */
async function updateLastValidation(licenseCode) {
  try {
    await fetch(`${LICENSE_FIREBASE_URL}/licenses/${licenseCode}/lastValidation.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(new Date().toISOString())
    });
  } catch (error) {
    console.error('Error actualizando última validación:', error);
  }
}

/**
 * =========================================================
 * FUNCIONES DE UI Y ESTADO
 * =========================================================
 */

/**
 * Actualiza el indicador de estado de licencia en la interfaz
 */
function updateLicenseStatusIndicator(text, color = '#666') {
  const indicator = document.getElementById('license-status-indicator');
  if (indicator) {
    indicator.textContent = text;
    indicator.style.color = color;
  }
  
  // Actualizar también en la sección de configuración si existe
  const configIndicator = document.getElementById('current-license-status');
  if (configIndicator) {
    configIndicator.textContent = text;
    configIndicator.style.color = color;
  }
}

/**
 * Obtiene un identificador único del dispositivo
 */
function getDeviceId() {
  return navigator.userAgent + 
         navigator.language + 
         screen.width + 'x' + screen.height + 
         new Date().getTimezoneOffset();
}

/**
 * =========================================================
 * FUNCIONES PARA GESTIÓN DE LICENCIAS (MODALES)
 * =========================================================
 */

/**
 * Refresca el estado de la licencia desde la configuración
 */
async function refreshLicenseStatus() {
  if (!licenseState.currentLicense) {
    alert('No hay licencia activa');
    return;
  }
  
  updateLicenseStatusIndicator('🔄 Actualizando...', '#ffc107');
  
  try {
    await checkLicenseValidity();
    showLicenseDetails();
  } catch (error) {
    console.error('Error actualizando estado:', error);
    alert('Error actualizando estado de licencia');
  }
}

/**
 * Muestra los detalles de la licencia actual
 */
function showLicenseDetails() {
  if (!licenseState.currentLicense) {
    document.getElementById('license-details').style.display = 'none';
    return;
  }
  
  const license = licenseState.currentLicense;
  const contentDiv = document.getElementById('license-info-content');
  
  if (!contentDiv) return;
  
  let detailsHtml = `
    <div style="display: grid; gap: 10px;">
      <div><strong>Código:</strong> <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 4px;">${license.code}</code></div>
      <div><strong>Cliente:</strong> ${license.clientName}</div>
      <div><strong>Email:</strong> ${license.clientEmail}</div>
      <div><strong>Tipo:</strong> ${license.isTrial ? '🧪 Prueba' : '⭐ Estándar'}</div>
      <div><strong>Estado:</strong> ${license.status}</div>
      <div><strong>Creada:</strong> ${new Date(license.createdAt).toLocaleDateString()}</div>
  `;
  
  if (license.isTrial && license.expirationDate) {
    const expiration = new Date(license.expirationDate);
    const now = new Date();
    const timeRemaining = expiration - now;
    const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    
    detailsHtml += `
      <div><strong>Expira:</strong> ${expiration.toLocaleDateString()}</div>
      <div><strong>Tiempo restante:</strong> ${daysRemaining > 0 ? `${daysRemaining} días` : 'Expirada'}</div>
    `;
  }
  
  if (license.activatedAt) {
    detailsHtml += `<div><strong>Activada:</strong> ${new Date(license.activatedAt).toLocaleDateString()}</div>`;
  }
  
  detailsHtml += '</div>';
  
  contentDiv.innerHTML = detailsHtml;
  document.getElementById('license-details').style.display = 'block';
}

/**
 * Abre el modal para cambiar licencia
 */
function changeLicense() {
  const modal = document.getElementById('change-license-modal');
  if (modal) {
    modal.style.display = 'flex';
    
    // Limpiar input
    const input = document.getElementById('license-code-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    
    // Ocultar errores previos
    const errorDiv = document.getElementById('modal-error-message');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }
}

/**
 * Cierra el modal de cambio de licencia
 */
function closeChangeLicenseModal() {
  const modal = document.getElementById('change-license-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Procesa el cambio de licencia desde el modal
 */
async function processLicenseChange() {
  const input = document.getElementById('license-code-input');
  const errorDiv = document.getElementById('modal-error-message');
  const validateBtn = document.getElementById('validate-license-btn');
  
  if (!input || !errorDiv || !validateBtn) return;
  
  const licenseCode = input.value.trim().toUpperCase();
  
  if (!licenseCode) {
    showModalError('Por favor ingresa un código de licencia');
    return;
  }
  
  // Mostrar estado de carga
  validateBtn.innerHTML = '<span class="spinner"></span>Validando...';
  validateBtn.disabled = true;
  
  hideModalError();
  
  try {
    const result = await validateLicense(licenseCode);
    
    if (result.isValid) {
      // Limpiar licencia anterior
      clearSavedLicense();
      
      // Guardar nueva licencia
      saveLicense(licenseCode);
      licenseState.isValid = true;
      licenseState.currentLicense = result.license;
      
      // Cerrar modal
      closeChangeLicenseModal();
      
      // Mostrar éxito
      showSuccessModal(`✅ Licencia actualizada exitosamente\n\nCliente: ${result.license.clientName}\nTipo: ${result.license.isTrial ? 'Prueba' : 'Estándar'}`);
      
      // Actualizar interfaz
      updateLicenseStatusIndicator('✅ Licencia actualizada', '#28a745');
      
    } else {
      showModalError(result.error);
    }
    
  } catch (error) {
    console.error('Error cambiando licencia:', error);
    showModalError('Error de conexión. Verifica tu internet e intenta nuevamente.');
    
  } finally {
    validateBtn.innerHTML = '🔍 Validar Licencia';
    validateBtn.disabled = false;
  }
}

/**
 * Limpia los datos de licencia actual
 */
function clearCurrentLicenseData() {
  if (!confirm('¿Estás seguro de que quieres limpiar la licencia actual?\n\nEsto cerrará la aplicación y tendrás que validar una nueva licencia.')) {
    return;
  }
  
  clearSavedLicense();
  licenseState.isValid = false;
  licenseState.currentLicense = null;
  
  updateLicenseStatusIndicator('🔒 Sin licencia', '#dc3545');
  
  // Ocultar detalles
  const detailsDiv = document.getElementById('license-details');
  if (detailsDiv) {
    detailsDiv.style.display = 'none';
  }
  
  // Recargar página para volver a pantalla de licencias
  setTimeout(() => {
    location.reload();
  }, 1000);
}

/**
 * Muestra ayuda sobre el sistema de licencias
 */
function showLicenseHelp() {
  const modal = document.getElementById('help-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

/**
 * Cierra el modal de ayuda
 */
function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Muestra el modal de éxito
 */
function showSuccessModal(message) {
  const modal = document.getElementById('success-modal');
  const contentDiv = document.getElementById('success-modal-content');
  
  if (!modal || !contentDiv) return;
  
  contentDiv.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">✅ Éxito</h3>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
      <p style="font-size: 16px; line-height: 1.6; white-space: pre-line;">${message}</p>
    </div>
    <div class="modal-buttons" style="justify-content: center;">
      <button class="modal-button" onclick="closeSuccessModal()" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold;">
        Perfecto, gracias
      </button>
    </div>
  `;
  
  modal.style.display = 'flex';
}

/**
 * Cierra el modal de éxito
 */
function closeSuccessModal() {
  const modal = document.getElementById('success-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Funciones auxiliares para modales
 */
function showModalError(message) {
  const errorDiv = document.getElementById('modal-error-message');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

function hideModalError() {
  const errorDiv = document.getElementById('modal-error-message');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

/**
 * =========================================================
 * INICIALIZACIÓN AUTOMÁTICA
 * =========================================================
 */

/**
 * =========================================================
 * FUNCIONES DE DEBUG Y TROUBLESHOOTING
 * =========================================================
 */

/**
 * Función de debug para verificar el estado del localStorage
 * Uso: En consola del navegador escribe: debugLicenseStorage()
 */
function debugLicenseStorage() {
  console.log('🔍 === DEBUG LOCALSTORAGE ===');
  console.log('LocalStorage actual:', localStorage.getItem('app-license'));
  console.log('Estado de licencia:', licenseState);
  console.log('Timestamp actual:', new Date().toISOString());
  console.log('===========================');
  return localStorage.getItem('app-license');
}

/**
 * Función para forzar el guardado de una licencia específica
 * Uso: En consola del navegador escribe: forceSaveLicense('TU-CODIGO')
 */
function forceSaveLicense(licenseCode) {
  if (!licenseCode) {
    console.log('❌ Error: Código de licencia requerido');
    return false;
  }
  
  console.log('🔧 Forzando guardado de licencia:', licenseCode);
  saveLicense(licenseCode);
  
  // Verificar que se guardó
  const saved = localStorage.getItem('app-license');
  if (saved) {
    console.log('✅ Licencia guardada exitosamente');
    console.log('📋 Datos guardados:', JSON.parse(saved));
    return true;
  } else {
    console.log('❌ Error: No se pudo guardar la licencia');
    return false;
  }
}

/**
 * Función para limpiar completamente el localStorage de licencias
 * Uso: En consola del navegador escribe: clearLicenseStorage()
 */
function clearLicenseStorage() {
  console.log('🧹 Limpiando localStorage de licencias...');
  clearSavedLicense();
  console.log('✅ LocalStorage limpiado');
}

/**
 * Función para forzar la re-activación de una licencia específica
 * Útil cuando una licencia está marcada como "Activada" pero queremos usarla en este dispositivo
 * Uso: En consola del navegador escribe: reActivarLicencia('CODIGO-LICENCIA')
 */
async function reActivarLicencia(licenseCode) {
  console.log('🔄 🔄 🔄 FORZANDO RE-ACTIVACIÓN DE LICENCIA 🔄 🔄 🔄');
  console.log('🔄 Código:', licenseCode);
  
  try {
    // Limpiar localStorage actual
    console.log('1. Limpiando localStorage...');
    clearLicenseStorage();
    
    // Validar la licencia
    console.log('2. Validando licencia...');
    const result = await validateLicense(licenseCode);
    
    if (result.isValid) {
      console.log('3. Guardando licencia re-activada...');
      const saveSuccess = saveLicense(licenseCode);
      
      if (saveSuccess) {
        console.log('✅ ✅ ✅ LICENCIA RE-ACTIVADA EXITOSAMENTE');
        console.log('💡 Recarga la página para ver los cambios');
      } else {
        console.log('❌ Error guardando licencia re-activada');
      }
    } else {
      console.log('❌ No se pudo validar la licencia:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error durante re-activación:', error);
  }
  
  console.log('🔄 🔄 🔄 FIN DE RE-ACTIVACIÓN 🔄 🔄 🔄');
}

/**
 * Función para simular una nueva validación
 * Uso: En consola del navegador escribe: testLicenseValidation('TU-CODIGO-LICENCIA')
 */
async function testLicenseValidation(licenseCode) {
  console.log('🧪 Probando validación de licencia:', licenseCode);
  clearLicenseStorage();
  const result = await validateLicense(licenseCode);
  console.log('📊 Resultado de prueba:', result);
  return result;
}

/**
 * Función para verificar el estado de una licencia en Firebase
 * Uso: En consola del navegador escribe: checkLicenseStatus('TU-CODIGO-LICENCIA')
 */
async function checkLicenseStatus(licenseCode) {
  console.log('🔍 Verificando estado de licencia:', licenseCode);
  try {
    const license = await fetchLicenseFromFirebase(licenseCode);
    if (license) {
      console.log('📋 Estado actual de la licencia:', {
        code: license.code,
        deviceId: license.deviceId,
        validationCount: license.validationCount,
        status: license.status,
        isTrial: license.isTrial,
        expirationDate: license.expirationDate,
        clientName: license.clientName
      });
      
      // Analizar si la licencia puede usarse
      if (license.deviceId === 'Activada') {
        console.log('⚠️ LICENCIA YA ACTIVADA: Verificar si está en localStorage');
        const saved = localStorage.getItem('app-license');
        if (saved) {
          try {
            const savedData = JSON.parse(saved);
            if (savedData.code === license.code) {
              console.log('✅ ✅ ✅ MISMA LICENCIA EN LOCALSTORAGE - PUEDE USARSE');
            } else {
              console.log('❌ LICENCIA DIFERENTE EN LOCALSTORAGE - NO PUEDE USARSE');
            }
          } catch (e) {
            console.log('❌ Error analizando localStorage');
          }
        } else {
          console.log('❌ NO HAY LICENCIA EN LOCALSTORAGE - NO PUEDE USARSE');
        }
      } else if (license.deviceId === 'pending_activation') {
        console.log('✅ LICENCIA DISPONIBLE: Puede activarse');
      } else if (license.deviceId) {
        console.log('⚠️ LICENCIA EN OTRO DISPOSITIVO: Ya activada en otro equipo');
      } else {
        console.log('❓ ESTADO INDEFINIDO: deviceId no reconocido');
      }
      
      return license;
    } else {
      console.log('❌ Licencia no encontrada en Firebase');
      return null;
    }
  } catch (error) {
    console.error('❌ Error consultando Firebase:', error);
    return null;
  }
}

/**
 * FUNCIÓN DE DIAGNÓSTICO COMPLETO PARA LOCALSTORAGE
 * Uso: En consola del navegador escribe: diagnosticarLocalStorage()
 */
function diagnosticarLocalStorage() {
  console.log('🔍 🔍 🔍 DIAGNÓSTICO COMPLETO DE LOCALSTORAGE 🔍 🔍 🔍');
  console.log('🕐 Timestamp del diagnóstico:', new Date().toISOString());
  console.log('🌐 URL actual:', window.location.href);
  console.log('📱 User Agent:', navigator.userAgent.substring(0, 100) + '...');
  console.log('💾 LocalStorage disponible:', typeof localStorage !== 'undefined');
  
  try {
    // Verificar localStorage básico
    console.log('💾 Probando escritura en localStorage...');
    localStorage.setItem('test-write', 'test-value');
    const testRead = localStorage.getItem('test-write');
    localStorage.removeItem('test-write');
    
    if (testRead === 'test-value') {
      console.log('✅ ✅ ✅ localStorage funciona correctamente');
    } else {
      console.log('❌ ❌ ❌ localStorage tiene problemas');
      return;
    }
    
    // Verificar licencia guardada
    console.log('🔍 Verificando licencia guardada...');
    const saved = localStorage.getItem('app-license');
    
    if (saved) {
      console.log('✅ ✅ ✅ Licencia encontrada en localStorage');
      try {
        const licenseData = JSON.parse(saved);
        console.log('📋 Datos de licencia:', licenseData);
        
        // Verificar estructura
        const requiredFields = ['code', 'savedAt', 'deviceId'];
        let allFieldsPresent = true;
        
        requiredFields.forEach(field => {
          if (licenseData[field]) {
            console.log(`✅ Campo "${field}": presente`);
          } else {
            console.log(`❌ Campo "${field}": faltante`);
            allFieldsPresent = false;
          }
        });
        
        // Verificar formato del código
        if (licenseData.code && licenseData.code.startsWith('INV-')) {
          console.log('✅ ✅ ✅ Formato de código correcto:', licenseData.code);
        } else {
          console.log('❌ ❌ ❌ Formato de código inválido:', licenseData.code);
          allFieldsPresent = false;
        }
        
        // Verificar antigüedad
        if (licenseData.savedAt) {
          const savedTime = new Date(licenseData.savedAt);
          const now = new Date();
          const diffHours = (now - savedTime) / (1000 * 60 * 60);
          console.log(`🕐 Licencia guardada hace ${diffHours.toFixed(2)} horas`);
        }
        
        console.log('📊 Estado general:', allFieldsPresent ? '✅ VÁLIDA' : '❌ INVÁLIDA');
        
        if (allFieldsPresent) {
          console.log('✅ ✅ ✅ LA LICENCIA ESTÁ BIEN GUARDADA');
          console.log('🔍 Si aún así no persiste, el problema podría estar en:');
          console.log('  1. La validación contra Firebase falla');
          console.log('  2. El navegador borra localStorage por alguna razón');
          console.log('  3. Hay algún código que limpia localStorage');
        } else {
          console.log('❌ ❌ ❌ LA LICENCIA TIENE DATOS CORRUPTOS');
          console.log('💡 Solución: forceSaveLicense("' + licenseData.code + '")');
        }
        
      } catch (parseError) {
        console.log('❌ ❌ ❌ Error parseando datos de licencia:', parseError);
        console.log('💡 Solución: clearLicenseStorage() para limpiar datos corruptos');
      }
    } else {
      console.log('🚫 ❌ No hay licencia guardada en localStorage');
    }
    
    // Verificar sessionStorage como backup
    console.log('🔍 Verificando sessionStorage como backup...');
    const sessionBackup = sessionStorage.getItem('app-license-backup');
    if (sessionBackup) {
      console.log('⚠️ ⚠️ ⚠️ Encontrada licencia en sessionStorage (backup)');
      try {
        const backupData = JSON.parse(sessionBackup);
        console.log('📋 Datos de backup:', backupData);
        console.log('💡 Restaurar con: forceSaveLicense("' + backupData.code + '")');
      } catch (e) {
        console.log('❌ Error parseando backup');
      }
    } else {
      console.log('✅ No hay backup en sessionStorage');
    }
    
    // Verificar estado de licenseState
    console.log('🔍 Estado interno de licenseState:');
    console.log(licenseState);
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  }
  
  console.log('🔍 🔍 🔍 FIN DEL DIAGNÓSTICO 🔍 🔍 🔍');
  
  console.log('');
  console.log('💡 RECOMENDACIONES:');
  console.log('1. Si localStorage funciona pero no persiste la licencia:');
  console.log('   - Ejecuta: simularInicializacion()');
  console.log('   - Verifica que la validación contra Firebase sea exitosa');
  console.log('   - Revisa los logs de inicialización en la consola');
  console.log('');
  console.log('2. Si hay problemas de guardado:');
  console.log('   - Ejecuta: forceSaveLicense("TU-CODIGO")');
  console.log('   - Luego: debugLicenseStorage()');
  console.log('');
  console.log('3. Si hay problemas de lectura:');
  console.log('   - Ejecuta: simularInicializacion()');
  console.log('   - Revisa los logs paso a paso');
}

/**
 * FUNCIÓN PARA PROBAR SOLO EL GUARDADO
 * Útil para verificar si el problema está en saveLicense()
 */
function probarGuardado() {
  console.log('🧪 🧪 🧪 PROBANDO SOLO EL GUARDADO 🧪 🧪 🧪');
  
  const testCode = 'INV-TEST-' + Date.now();
  console.log('🧪 Código de prueba:', testCode);
  
  console.log('1. Limpiando localStorage...');
  clearLicenseStorage();
  
  console.log('2. Guardando licencia de prueba...');
  const success = saveLicense(testCode);
  
  console.log('3. Verificando resultado del guardado:', success);
  
  if (success) {
    console.log('4. Verificando persistencia inmediata...');
    const verification = localStorage.getItem('app-license');
    console.log('5. Resultado de verificación:', verification ? 'ÉXITO' : 'FALLO');
    
    if (verification) {
      try {
        const parsed = JSON.parse(verification);
        console.log('6. Datos parseados:', parsed);
        console.log('✅ ✅ ✅ GUARDADO FUNCIONA CORRECTAMENTE');
      } catch (e) {
        console.log('❌ Error parseando verificación:', e);
      }
    }
  }
  
  console.log('🧪 🧪 🧪 FIN DE PRUEBA DE GUARDADO 🧪 🧪 🧪');
}

/**
 * FUNCIÓN PARA PROBAR SOLO LA LECTURA
 * Útil para verificar si el problema está en getSavedLicense()
 */
function probarLectura() {
  console.log('📖 📖 📖 PROBANDO SOLO LA LECTURA 📖 📖 📖');
  
  console.log('1. Verificando qué hay en localStorage...');
  const saved = localStorage.getItem('app-license');
  console.log('2. Contenido de app-license:', saved);
  
  console.log('3. Llamando getSavedLicense()...');
  const result = getSavedLicense();
  
  console.log('4. Resultado de getSavedLicense():', result);
  
  if (result && result.code) {
    console.log('✅ ✅ ✅ LECTURA FUNCIONA CORRECTAMENTE');
    console.log('📋 Código leído:', result.code);
  } else {
    console.log('❌ ❌ ❌ PROBLEMA EN LA LECTURA');
    console.log('💡 El problema está en getSavedLicense()');
  }
  
  console.log('📖 📖 📖 FIN DE PRUEBA DE LECTURA 📖 📖 📖');
}

// Hacer las funciones disponibles globalmente para debug
window.debugLicenseStorage = debugLicenseStorage;
window.clearLicenseStorage = clearLicenseStorage;
window.testLicenseValidation = testLicenseValidation;
window.checkLicenseStatus = checkLicenseStatus;
window.forceSaveLicense = forceSaveLicense;
window.diagnosticarLocalStorage = diagnosticarLocalStorage;
window.simularInicializacion = simularInicializacion;
window.probarGuardado = probarGuardado;
window.probarLectura = probarLectura;
window.reActivarLicencia = reActivarLicencia;

// Inicializar el sistema cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLicenseSystem);
} else {
  initializeLicenseSystem();
}

// También inicializar cuando se cargue la ventana por si acaso
window.addEventListener('load', () => {
  if (!licenseState.isInitialized) {
    initializeLicenseSystem();
  }
});

console.log('🔒 Sistema de Licencias cargado correctamente');
console.log('🔧 Funciones de debug disponibles:');
console.log('  - debugLicenseStorage() - Ver estado del localStorage');
console.log('  - forceSaveLicense("CODIGO") - Forzar guardado de licencia');
console.log('  - clearLicenseStorage() - Limpiar localStorage');
console.log('  - testLicenseValidation("CODIGO") - Probar validación');
console.log('  - checkLicenseStatus("CODIGO") - Ver estado en Firebase');
console.log('  - diagnosticarLocalStorage() - DIAGNÓSTICO COMPLETO');
console.log('  - simularInicializacion() - Simular proceso de inicio');
console.log('  - probarGuardado() - Probar solo la función saveLicense()');
console.log('  - probarLectura() - Probar solo la función getSavedLicense()');
console.log('  - reActivarLicencia("CODIGO") - Re-activar licencia ya usada');
console.log('');
console.log('🆘 Solución de problemas:');
console.log('   1. diagnosticarLocalStorage() - Para diagnóstico completo');
console.log('   2. simularInicializacion() - Para ver exactamente dónde falla');
console.log('   3. Si dice "licencia ya activada":');
console.log('      - Verificar que la licencia en localStorage es la misma');
console.log('      - La aplicación debería permitir licencias ya activadas en este dispositivo');
console.log('   4. probarGuardado() - Si el problema es el guardado');
console.log('   5. probarLectura() - Si el problema es la lectura');

/**
 * SIMULA EL PROCESO COMPLETO DE INICIALIZACIÓN
 * Útil para debuggear paso a paso qué está fallando
 */
async function simularInicializacion() {
  console.log('🎭 🎭 🎭 SIMULANDO PROCESO DE INICIALIZACIÓN 🎭 🎭 🎭');
  
  try {
    console.log('PASO 1: Verificando localStorage disponible...');
    console.log('localStorage disponible:', typeof localStorage !== 'undefined');
    
    console.log('PASO 2: Leyendo licencia guardada...');
    const savedLicense = getSavedLicense();
    
    console.log('PASO 3: Analizando resultado...');
    if (savedLicense && savedLicense.code) {
      console.log('✅ ✅ ✅ LICENCIA ENCONTRADA');
      console.log('📋 Código:', savedLicense.code);
      
      console.log('PASO 4: Validando licencia contra Firebase...');
      const validationResult = await validateLicense(savedLicense.code);
      
      console.log('PASO 5: Analizando resultado de validación...');
      if (validationResult.isValid) {
        console.log('✅ ✅ ✅ LICENCIA VÁLIDA - APLICACIÓN DEBERÍA INICIAR');
        console.log('📋 Datos de licencia:', validationResult.license);
      } else {
        console.log('❌ ❌ ❌ LICENCIA NO VÁLIDA');
        console.log('❌ Error:', validationResult.error);
      }
    } else {
      console.log('❌ ❌ ❌ NO SE ENCONTRÓ LICENCIA VÁLIDA');
      console.log('💡 Solución: forceSaveLicense("TU-CODIGO-LICENCIA")');
    }
    
  } catch (error) {
    console.error('❌ Error durante simulación:', error);
  }
  
  console.log('🎭 🎭 🎭 FIN DE LA SIMULACIÓN 🎭 🎭 🎭');
}