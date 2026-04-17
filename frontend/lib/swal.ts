/**
 * Helper utility para SweetAlert2
 * Proporciona funciones consistentes para alertas y confirmaciones
 */

import Swal from 'sweetalert2';
import { isPermissionDeniedApiMessage } from './parseApiError';

// Configuración por defecto
const defaultConfig = {
  confirmButtonText: 'Confirmar',
  cancelButtonText: 'Cancelar',
  confirmButtonColor: '#2563eb', // primary-600
  cancelButtonColor: '#6b7280', // gray-500
  allowOutsideClick: false,
  allowEscapeKey: true,
};

/**
 * Muestra una alerta de éxito
 */
export const swalSuccess = (message: string, title: string = 'Éxito') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#10b981', // green-500
    timer: 3000,
    timerProgressBar: true,
  });
};

/**
 * Muestra una alerta de error
 */
export const swalError = (message: string, title: string = 'Error') => {
  if (isPermissionDeniedApiMessage(message)) {
    console.warn('[permisos API]', message);
    return Promise.resolve() as unknown as ReturnType<typeof Swal.fire>;
  }
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#ef4444', // red-500
  });
};

/**
 * Muestra una alerta de información
 */
export const swalInfo = (message: string, title: string = 'Información') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: defaultConfig.confirmButtonColor,
  });
};

/**
 * Muestra una alerta de advertencia
 */
export const swalWarning = (message: string, title: string = 'Advertencia') => {
  if (isPermissionDeniedApiMessage(message)) {
    console.warn('[permisos API]', message);
    return Promise.resolve() as unknown as ReturnType<typeof Swal.fire>;
  }
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#f59e0b', // amber-500
  });
};

/**
 * Muestra una confirmación
 * Retorna true si el usuario confirma, false si cancela
 */
export const swalConfirm = async (
  message: string,
  title: string = 'Confirmar',
  confirmText: string = 'Sí, continuar',
  cancelText: string = 'Cancelar'
): Promise<boolean> => {
  const result = await Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: defaultConfig.confirmButtonColor,
    cancelButtonColor: defaultConfig.cancelButtonColor,
    reverseButtons: true,
    focusCancel: true,
  });

  return result.isConfirmed;
};

/**
 * Muestra una confirmación de eliminación
 * Retorna true si el usuario confirma, false si cancela
 */
export const swalConfirmDelete = async (
  message: string = 'Esta acción no se puede deshacer.',
  title: string = '¿Está seguro?'
): Promise<boolean> => {
  return swalConfirm(
    message,
    title,
    'Sí, eliminar',
    'Cancelar'
  );
};

/**
 * Muestra un mensaje de carga
 */
export const swalLoading = (message: string = 'Cargando...') => {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

/**
 * Cierra cualquier alerta activa
 */
export const swalClose = () => {
  Swal.close();
};

// Exportar Swal directamente por si se necesita funcionalidad avanzada
export default Swal;

