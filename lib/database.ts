import { Platform } from 'react-native';

// Interfaz para el registro de escaneos QR
export interface ScanRecord {
  id: number;
  qr_data: string;        // Datos del código QR escaneado
  latitude: number | null;  // Coordenada de latitud (si está disponible)
  longitude: number | null; // Coordenada de longitud (si está disponible)
  altitude: number | null;  // Altitud (si está disponible)
  accuracy: number | null;  // Precisión de la ubicación (si está disponible)
  timestamp: number;      // Marca de tiempo del escaneo (puede ser UNIX timestamp)
  created_at: string;     // Fecha de creación en formato ISO (gestionada por el backend)
}

const API_BASE_URL = 'http://192.168.1.183:3000'; 

// Clase ApiService que se comunica con el backend remoto
class ApiService {
  private initialized: boolean = false;

  async init(): Promise<void> {
    if (!this.initialized) {
      console.log('API Service initialized, connecting to:', API_BASE_URL);
      this.initialized = true;
    }
  }

  /**
   * Obtiene todos los escaneos desde el web service.
   */
  async getScans(): Promise<ScanRecord[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }
      const data: ScanRecord[] = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching scans:', error);
      throw error; 
    }
  }

  /**
   * Añade un nuevo escaneo QR al web service.
   * @param scanData Datos del escaneo (sin ID ni fecha de creación, los asigna el backend)
   * @returns ID del nuevo escaneo asignado por el servidor
   */
  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_data: scanData.qr_data,
          latitude: scanData.latitude,
          longitude: scanData.longitude,
          altitude: scanData.altitude,
          accuracy: scanData.accuracy,
          timestamp: scanData.timestamp, 
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }
      const newScan: ScanRecord = await response.json();
      return newScan.id;
    } catch (error) {
      console.error('Error adding scan:', error);
      throw error;
    }
  }

  /**
   * Elimina un escaneo por su ID del web service.
   * @param id ID del escaneo a eliminar
   * @returns Verdadero si se eliminó correctamente
   */
  async deleteScan(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        if (response.status === 204) {
          return true; 
        }
        throw new Error(`HTTP error! status: ${response.status}, ${response.statusText}`);
      }
      return true; 
    } catch (error) {
      console.error('Error deleting scan:', error);
      throw error;
    }
  }

  /**
   * Busca un escaneo por su ID en el web service.
   * @param id ID del escaneo a buscar
   * @returns 
   */
  async getScanById(id: number): Promise<ScanRecord | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; 
        }
        throw new Error(`HTTP error! status: ${response.status}, ${response.statusText}`);
      }
      const scan: ScanRecord = await response.json();
      return scan;
    } catch (error) {
      console.error('Error fetching scan by ID:', error);
      throw error;
    }
  }
}

export const database = new ApiService();