// Sistema de monitoreo de seguridad en tiempo real
import CryptoJS from 'crypto-js';

class SecurityMonitor {
  constructor() {
    this.threats = new Map();
    this.securityLogs = [];
    this.alertThresholds = {
      devToolsDetection: 3,
      suspiciousRequests: 10,
      codeInjectionAttempts: 1,
      domModificationAttempts: 5
    };
  }

  // Registrar evento de seguridad
  logSecurityEvent(type, details, severity = 'medium') {
    const event = {
      id: CryptoJS.SHA256(`${Date.now()}-${type}`).toString().substring(0, 16),
      timestamp: new Date().toISOString(),
      type,
      details,
      severity,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    };

    this.securityLogs.push(event);

    // Mantener solo los últimos 100 eventos
    if (this.securityLogs.length > 100) {
      this.securityLogs.shift();
    }

    // Verificar si necesita alertas
    this.checkSecurityThresholds(type);

    return event.id;
  }

  // Verificar umbrales de seguridad
  checkSecurityThresholds(type) {
    const recentEvents = this.securityLogs.filter(
      log => log.type === type &&
      (Date.now() - new Date(log.timestamp).getTime()) < 300000 // 5 minutos
    );

    const threshold = this.alertThresholds[type];
    if (threshold && recentEvents.length >= threshold) {
      this.triggerSecurityAlert(type, recentEvents.length);
    }
  }

  // Disparar alerta de seguridad
  triggerSecurityAlert(type, count) {
    const alertId = this.logSecurityEvent('securityAlert', {
      alertType: type,
      eventCount: count,
      action: 'automated_response'
    }, 'high');

    // Respuestas automáticas
    switch (type) {
      case 'devToolsDetection':
        this.handleDevToolsAlert();
        break;
      case 'suspiciousRequests':
        this.handleSuspiciousRequestsAlert();
        break;
      case 'codeInjectionAttempts':
        this.handleCodeInjectionAlert();
        break;
    }

    return alertId;
  }

  // Manejar alerta de DevTools
  handleDevToolsAlert() {
    if (typeof window !== 'undefined') {
      // Limpiar console
      console.clear();

      // Inyectar código anti-debugging
      const script = document.createElement('script');
      script.innerHTML = `
        (function() {
          setInterval(function() {
            if (window.outerWidth - window.innerWidth > 200 ||
                window.outerHeight - window.innerHeight > 200) {
              document.body.style.display = 'none';
              setTimeout(() => window.location.reload(), 2000);
            }
          }, 1000);
        })();
      `;
      document.head.appendChild(script);
    }
  }

  // Manejar alertas de requests sospechosos
  handleSuspiciousRequestsAlert() {
    // Implementar throttling temporal
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            originalFetch.apply(this, args).then(resolve).catch(reject);
          }, Math.random() * 3000 + 1000); // Delay aleatorio 1-4 segundos
        });
      };

      // Restaurar después de 5 minutos
      setTimeout(() => {
        window.fetch = originalFetch;
      }, 300000);
    }
  }

  // Manejar alertas de inyección de código
  handleCodeInjectionAlert() {
    if (typeof window !== 'undefined') {
      // Deshabilitar eval y similares
      window.eval = () => { throw new Error('eval disabled for security'); };
      window.Function = () => { throw new Error('Function constructor disabled'); };

      // Monitorear modificaciones críticas del DOM
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1 &&
                  (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME')) {
                node.remove();
                this.logSecurityEvent('maliciousNodeRemoval', {
                  tagName: node.tagName,
                  innerHTML: node.innerHTML?.substring(0, 100)
                }, 'high');
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'onclick', 'onload']
      });
    }
  }

  // Detectar herramientas de desarrollo
  detectDeveloperTools() {
    if (typeof window === 'undefined') return false;

    const start = performance.now();

    // Método 1: Detección por tamaño de ventana
    const windowSizeDetection = () => {
      return window.outerWidth - window.innerWidth > 200 ||
             window.outerHeight - window.innerHeight > 200;
    };

    // Método 2: Detección por timing de debugger
    const debuggerDetection = () => {
      const before = performance.now();
      debugger; // Será removido por el obfuscator en producción
      const after = performance.now();
      return after - before > 100;
    };

    // Método 3: Detección por console object
    const consoleDetection = () => {
      let detected = false;
      const originalLog = console.log;
      console.log = function() {
        detected = true;
        originalLog.apply(console, arguments);
      };

      console.clear();
      console.log('%c', 'font-size: 1px;');
      console.log = originalLog;

      return detected;
    };

    const isDetected = windowSizeDetection() || debuggerDetection() || consoleDetection();

    if (isDetected) {
      this.logSecurityEvent('devToolsDetection', {
        method: 'multi-detection',
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      }, 'medium');
    }

    return isDetected;
  }

  // Validar integridad del código
  validateCodeIntegrity() {
    if (typeof window === 'undefined') return true;

    const scripts = Array.from(document.scripts);
    let integrityViolations = 0;

    scripts.forEach(script => {
      // Verificar scripts externos no autorizados
      if (script.src && !script.src.includes(window.location.hostname)) {
        if (!script.src.includes('sistemadegestion.net') &&
            !script.src.includes('cdn.') &&
            !script.src.includes('googleapis.com')) {
          integrityViolations++;
          this.logSecurityEvent('unauthorizedScript', {
            src: script.src,
            location: 'external'
          }, 'high');
        }
      }

      // Verificar modificaciones en scripts inline
      if (script.innerHTML && script.innerHTML.includes('eval(')) {
        integrityViolations++;
        this.logSecurityEvent('suspiciousScriptContent', {
          content: script.innerHTML.substring(0, 200)
        }, 'high');
      }
    });

    return integrityViolations === 0;
  }

  // Inicializar monitoreo automático
  startMonitoring() {
    if (typeof window === 'undefined') return;

    // Verificación de DevTools cada 2 segundos
    setInterval(() => {
      this.detectDeveloperTools();
    }, 2000);

    // Verificación de integridad cada 30 segundos
    setInterval(() => {
      this.validateCodeIntegrity();
    }, 30000);

    // Monitoreo de performance para detectar análisis
    setInterval(() => {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const timing = entries[0];
        if (timing.loadEventEnd - timing.loadEventStart > 5000) {
          this.logSecurityEvent('slowPageLoad', {
            loadTime: timing.loadEventEnd - timing.loadEventStart
          }, 'low');
        }
      }
    }, 10000);

    this.logSecurityEvent('monitoringStarted', {
      startTime: new Date().toISOString()
    }, 'info');
  }

  // Obtener resumen de seguridad
  getSecuritySummary() {
    const now = Date.now();
    const last24h = this.securityLogs.filter(
      log => (now - new Date(log.timestamp).getTime()) < 86400000
    );

    const summary = {
      totalEvents: last24h.length,
      highSeverityEvents: last24h.filter(log => log.severity === 'high').length,
      threatTypes: [...new Set(last24h.map(log => log.type))],
      lastAlert: this.securityLogs
        .filter(log => log.type === 'securityAlert')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0],
      systemStatus: this.getSystemStatus()
    };

    return summary;
  }

  // Obtener estado del sistema
  getSystemStatus() {
    const recentThreats = this.securityLogs.filter(
      log => (Date.now() - new Date(log.timestamp).getTime()) < 300000 &&
             log.severity === 'high'
    );

    if (recentThreats.length >= 5) return 'critical';
    if (recentThreats.length >= 2) return 'warning';
    return 'secure';
  }
}

// Instancia global del monitor
const securityMonitor = new SecurityMonitor();

export default securityMonitor;