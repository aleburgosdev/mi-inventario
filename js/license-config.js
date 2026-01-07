/**
 * =========================================================
 * CONFIGURACIÓN DEL SISTEMA DE LICENCIAS
 * Este archivo contiene las configuraciones principales
 * para personalizar el sistema según tus necesidades
 * =========================================================
 */

// 📋 CONFIGURACIÓN PRINCIPAL
const LICENSE_CONFIG = {
  // URL base de Firebase para licencias
  FIREBASE_URL: 'https://licencias-378d4-default-rtdb.firebaseio.com',
  
  // Tiempo de verificación automática (en milisegundos)
  // 300000 = 5 minutos
  VALIDATION_INTERVAL: 300000,
  
  // Días de advertencia antes de que expire una licencia de prueba
  WARNING_DAYS: 3,
  
  // Configuración de UI
  UI: {
    // Mostrar mensajes de debug en consola
    DEBUG_MODE: true,
    
    // Colores para estados de licencia
    COLORS: {
      ACTIVE: '#28a745',      // Verde - Licencia activa
      WARNING: '#ffc107',     // Amarillo - Advertencia
      ERROR: '#dc3545',       // Rojo - Error
      TRIAL: '#17a2b8',       // Azul - Licencia de prueba
      EXPIRED: '#6c757d'      // Gris - Expirada
    },
    
    // Textos personalizados
    MESSAGES: {
      LICENSE_BLOCKED: '🔒 Licencia requerida',
      LICENSE_EXPIRED: '🧪 Licencia de prueba ha expirado',
      LICENSE_REVOKED: '❌ Licencia revocada',
      VALIDATING: '🔍 Validando licencia...',
      LOADING: '⏳ Cargando...'
    }
  },
  
  // Configuración de validación
  VALIDATION: {
    // Timeout para requests a Firebase (milisegundos)
    REQUEST_TIMEOUT: 10000,
    
    // Número de reintentos antes de mostrar error
    MAX_RETRIES: 3,
    
    // Validar checksum del código de licencia
    VALIDATE_CHECKSUM: true,
    
    // Requerir deviceId único
    REQUIRE_DEVICE_BINDING: true
  }
};

// 🔧 CONFIGURACIÓN AVANZADA
const ADVANCED_CONFIG = {
  // Patrón para códigos de licencia
  LICENSE_PATTERN: /^INV-[A-Z0-9]+-[A-Z0-9]+-[0-9]{6}$/,
  
  // Longitud mínima y máxima del código
  CODE_LENGTH: {
    MIN: 20,
    MAX: 50
  },
  
  // Configuración de localStorage
  STORAGE: {
    KEY: 'app-license',
    EXPIRY_DAYS: 30  // Días antes de forzar revalidación
  },
  
  // Configuración de logs
  LOGGING: {
    LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
    MAX_ENTRIES: 100
  },
  
  // Configuración de notificaciones
  NOTIFICATIONS: {
    ENABLED: true,
    SHOW_SUCCESS: true,
    SHOW_ERRORS: true,
    AUTO_HIDE_DELAY: 5000
  }
};

// 🌐 CONFIGURACIÓN DE FIREBASE
const FIREBASE_CONFIG = {
  // Configuración de Firebase Realtime Database
  DATABASE_URL: 'https://licencias-378d4-default-rtdb.firebaseio.com',
  
  // Rutas de la base de datos
  PATHS: {
    LICENSES: '/licenses',
    VALIDATION_LOGS: '/validation-logs',
    DEVICE_REGISTRY: '/devices'
  },
  
  // Configuración de seguridad
  SECURITY: {
    // Requiere autenticación (si está habilitada en Firebase)
    REQUIRE_AUTH: false,
    
    // Whitelist de dominios permitidos (para CORS)
    ALLOWED_ORIGINS: ['*'],
    
    // Rate limiting (requests por minuto)
    RATE_LIMIT: 60
  }
};

// 📱 CONFIGURACIÓN DE DISPOSITIVOS
const DEVICE_CONFIG = {
  // Componentes para generar Device ID
  COMPONENTS: [
    'userAgent',
    'language',
    'platform',
    'screenResolution',
    'timezone',
    'hardwareConcurrency',
    'deviceMemory'
  ],
  
  // Hash para obfuscación del Device ID
  HASH_ALGORITHM: 'sha256',
  
  // Configuración de fingerprinting
  FINGERPRINT: {
    ENABLED: true,
    STABILITY_DAYS: 30
  }
};

// 🎨 CONFIGURACIÓN DE UI/UX
const UI_CONFIG = {
  // Configuración de la pantalla de bloqueo
  LOCK_SCREEN: {
    BACKGROUND: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    PRIMARY_COLOR: '#667eea',
    ACCENT_COLOR: '#764ba2',
    TEXT_COLOR: '#333333',
    
    // Animaciones
    ANIMATIONS: {
      ENABLED: true,
      DURATION: 300,
      EASING: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }
  },
  
  // Configuración de modales
  MODALS: {
    BACKDROP_COLOR: 'rgba(0,0,0,0.6)',
    BACKDROP_FILTER: 'blur(5px)',
    Z_INDEX: 9999,
    
    // Responsive breakpoints
    BREAKPOINTS: {
      MOBILE: 768,
      TABLET: 1024,
      DESKTOP: 1200
    }
  },
  
  // Configuración de indicadores de estado
  STATUS_INDICATORS: {
    POSITION: 'bottom-right',
    ANIMATION: 'pulse',
    AUTO_HIDE: false,
    ICONS: {
      ACTIVE: '✅',
      WARNING: '⚠️',
      ERROR: '❌',
      TRIAL: '🧪',
      EXPIRED: '⏰'
    }
  }
};

// 🔒 CONFIGURACIÓN DE SEGURIDAD
const SECURITY_CONFIG = {
  // Configuración de encriptación
  ENCRYPTION: {
    ALGORITHM: 'AES-256-GCM',
    KEY_DERIVATION: 'PBKDF2',
    ITERATIONS: 10000
  },
  
  // Configuración de rate limiting
  RATE_LIMITING: {
    WINDOW_MS: 60000, // 1 minuto
    MAX_REQUESTS: 10,
    SKIP_SUCCESSFUL_REQUESTS: true
  },
  
  // Configuración de auditoría
  AUDIT: {
    ENABLED: true,
    LOG_LEVEL: 'info',
    RETENTION_DAYS: 90,
    INCLUDE_DEVICE_INFO: true
  }
};

// 📊 CONFIGURACIÓN DE ANALYTICS
const ANALYTICS_CONFIG = {
  // Tracking de uso de licencias
  TRACKING: {
    ENABLED: true,
    EVENTS: [
      'license_validation',
      'license_activation',
      'license_expiration',
      'device_change',
      'validation_error'
    ]
  },
  
  // Métricas a收集
  METRICS: {
    VALIDATION_SUCCESS_RATE: true,
    AVERAGE_VALIDATION_TIME: true,
    DEVICE_DISTRIBUTION: true,
    LICENSE_TYPE_DISTRIBUTION: true
  }
};

// 🌍 CONFIGURACIÓN INTERNACIONAL
const I18N_CONFIG = {
  // Idioma por defecto
  DEFAULT_LOCALE: 'es',
  
  // Soporte multiidioma
  SUPPORTED_LOCALES: ['es', 'en', 'pt'],
  
  // Textos por idioma
  STRINGS: {
    es: {
      LICENSE_REQUIRED: '🔒 Se requiere una licencia válida',
      LICENSE_EXPIRED: '🧪 Tu licencia de prueba ha expirado',
      LICENSE_REVOKED: '❌ Tu licencia ha sido revocada',
      VALIDATING: '🔍 Validando licencia...',
      PLEASE_WAIT: '⏳ Por favor espera...',
      ERROR_NETWORK: '🌐 Error de conexión con el servidor',
      ERROR_INVALID: '❌ Código de licencia inválido',
      SUCCESS_ACTIVATED: '✅ Licencia activada exitosamente',
      BUTTON_RETRY: 'Reintentar',
      BUTTON_CANCEL: 'Cancelar',
      BUTTON_HELP: 'Ayuda'
    },
    en: {
      LICENSE_REQUIRED: '🔒 Valid license required',
      LICENSE_EXPIRED: '🧪 Your trial license has expired',
      LICENSE_REVOKED: '❌ Your license has been revoked',
      VALIDATING: '🔍 Validating license...',
      PLEASE_WAIT: '⏳ Please wait...',
      ERROR_NETWORK: '🌐 Network connection error',
      ERROR_INVALID: '❌ Invalid license code',
      SUCCESS_ACTIVATED: '✅ License activated successfully',
      BUTTON_RETRY: 'Retry',
      BUTTON_CANCEL: 'Cancel',
      BUTTON_HELP: 'Help'
    },
    pt: {
      LICENSE_REQUIRED: '🔒 Licença válida necessária',
      LICENSE_EXPIRED: '🧪 Sua licença de teste expirou',
      LICENSE_REVOKED: '❌ Sua licença foi revogada',
      VALIDATING: '🔍 Validando licença...',
      PLEASE_WAIT: '⏳ Por favor aguarde...',
      ERROR_NETWORK: '🌐 Erro de conexão com o servidor',
      ERROR_INVALID: '❌ Código de licença inválido',
      SUCCESS_ACTIVATED: '✅ Licença ativada com sucesso',
      BUTTON_RETRY: 'Tentar novamente',
      BUTTON_CANCEL: 'Cancelar',
      BUTTON_HELP: 'Ajuda'
    }
  }
};

// 🚀 CONFIGURACIÓN DE DESARROLLO
const DEV_CONFIG = {
  // Modo de desarrollo
  DEVELOPMENT_MODE: false,
  
  // Logging detallado
  VERBOSE_LOGGING: false,
  
  // Mock data para pruebas
  USE_MOCK_DATA: false,
  
  // Endpoints de desarrollo
  DEV_ENDPOINTS: {
    FIREBASE: 'https://licencias-dev-default-rtdb.firebaseio.com',
    VALIDATION_API: 'http://localhost:3000/api/validate'
  },
  
  // Configuración de debugging
  DEBUG: {
    BREAKPOINTS: false,
    PERFORMANCE: false,
    NETWORK: false,
    STATE: false
  }
};

// 📋 EXPORTAR CONFIGURACIONES
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LICENSE_CONFIG,
    ADVANCED_CONFIG,
    FIREBASE_CONFIG,
    DEVICE_CONFIG,
    UI_CONFIG,
    SECURITY_CONFIG,
    ANALYTICS_CONFIG,
    I18N_CONFIG,
    DEV_CONFIG
  };
}

// 🌟 CONFIGURACIÓN POR DEFECTO PARA PRODUCCIÓN
const PRODUCTION_CONFIG = {
  // Usar configuración de producción por defecto
  ...LICENSE_CONFIG,
  ...ADVANCED_CONFIG,
  ...FIREBASE_CONFIG,
  ...DEVICE_CONFIG,
  ...UI_CONFIG,
  ...SECURITY_CONFIG,
  ...ANALYTICS_CONFIG,
  ...I18N_CONFIG,
  
  // Sobrescribir con valores de producción
  UI: {
    ...UI_CONFIG,
    DEBUG_MODE: false
  },
  DEV_CONFIG: {
    ...DEV_CONFIG,
    DEVELOPMENT_MODE: false,
    VERBOSE_LOGGING: false,
    USE_MOCK_DATA: false
  }
};

// 🛠️ FUNCIÓN DE CONFIGURACIÓN GLOBAL
function configureLicenseSystem(config = {}) {
  // Aplicar configuración personalizada
  const finalConfig = { ...PRODUCTION_CONFIG, ...config };
  
  // Validar configuración
  validateConfig(finalConfig);
  
  // Aplicar configuración globalmente
  if (typeof window !== 'undefined') {
    window.LICENSE_SYSTEM_CONFIG = finalConfig;
  }
  
  console.log('🔧 Sistema de licencias configurado:', finalConfig);
  return finalConfig;
}

// 🔍 VALIDACIÓN DE CONFIGURACIÓN
function validateConfig(config) {
  const requiredFields = ['FIREBASE_URL'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Configuración incompleta. Campos faltantes: ${missingFields.join(', ')}`);
  }
  
  // Validar URL de Firebase
  try {
    new URL(config.FIREBASE_URL);
  } catch (error) {
    throw new Error('URL de Firebase inválida');
  }
  
  // Validar intervalos de tiempo
  if (config.VALIDATION_INTERVAL < 60000) {
    console.warn('⚠️ Intervalo de validación muy corto. Mínimo recomendado: 1 minuto');
  }
}

// 🎯 CONFIGURACIÓN AUTOMÁTICA
// Si se ejecuta en el navegador, aplicar configuración automáticamente
if (typeof window !== 'undefined') {
  // Configuración automática basada en el entorno
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
  
  if (isDevelopment) {
    // Configuración para desarrollo
    DEV_CONFIG.DEVELOPMENT_MODE = true;
    DEV_CONFIG.VERBOSE_LOGGING = true;
    LICENSE_CONFIG.UI.DEBUG_MODE = true;
  }
  
  // Auto-configurar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      configureLicenseSystem();
    });
  } else {
    configureLicenseSystem();
  }
}

// 📝 EJEMPLO DE USO
/*
Ejemplo de personalización:

// Configuración personalizada
const customConfig = {
  FIREBASE_URL: 'https://mi-proyecto.firebaseio.com',
  VALIDATION_INTERVAL: 600000, // 10 minutos
  UI: {
    DEBUG_MODE: false,
    COLORS: {
      ACTIVE: '#00ff00', // Verde personalizado
      WARNING: '#ffaa00' // Amarillo personalizado
    }
  }
};

// Aplicar configuración
configureLicenseSystem(customConfig);
*/

console.log('📋 Configuración del sistema de licencias cargada');