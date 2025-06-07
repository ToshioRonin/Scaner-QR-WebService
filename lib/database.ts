import { Platform } from 'react-native';

// Interfaz para el registro de escaneos QR
export interface ScanRecord {
  id: number;
  qr_data: string;       // Datos del código QR escaneado
  latitude: number | null;  // Coordenada de latitud (si está disponible)
  longitude: number | null; // Coordenada de longitud (si está disponible)
  altitude: number | null;  // Altitud (si está disponible)
  accuracy: number | null;  // Precisión de la ubicación (si está disponible)
  timestamp: number;     // Marca de tiempo del escaneo
  created_at: string;    // Fecha de creación en formato ISO
}

// Implementación para almacenamiento web (usando localStorage)
class WebStorage {
  private storageKey = 'qr_scanner_data';
  private scans: ScanRecord[] = [];
  private nextId = 1;

  /**
   * Inicializa el almacenamiento web cargando datos existentes
   * de localStorage o creando una nueva estructura si no existe
   */
  async init(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.scans = data.scans || [];
        this.nextId = data.nextId || 1;
      }
    } catch (error) {
      console.error('Error cargando almacenamiento web:', error);
      this.scans = [];
      this.nextId = 1;
    }
  }

  /**
   * Guarda los escaneos en localStorage
   */
  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        scans: this.scans,
        nextId: this.nextId
      }));
    } catch (error) {
      console.error('Error guardando en almacenamiento web:', error);
    }
  }

  /**
   * Obtiene todos los escaneos ordenados por fecha (más reciente primero)
   */
  async getScans(): Promise<ScanRecord[]> {
    return [...this.scans].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Añade un nuevo escaneo QR al almacenamiento
   * @param scanData Datos del escaneo (sin ID ni fecha de creación)
   * @returns ID del nuevo escaneo
   */
  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    const newScan: ScanRecord = {
      ...scanData,
      id: this.nextId++,
      created_at: new Date().toISOString()
    };
    this.scans.push(newScan);
    this.save();
    return newScan.id;
  }

  /**
   * Elimina un escaneo por su ID
   * @param id ID del escaneo a eliminar
   * @returns Verdadero si se eliminó correctamente
   */
  async deleteScan(id: number): Promise<boolean> {
    const initialLength = this.scans.length;
    this.scans = this.scans.filter(scan => scan.id !== id);
    const deleted = this.scans.length < initialLength;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  /**
   * Busca un escaneo por su ID
   * @param id ID del escaneo a buscar
   * @returns El escaneo encontrado o null si no existe
   */
  async getScanById(id: number): Promise<ScanRecord | null> {
    return this.scans.find(scan => scan.id === id) || null;
  }
}

// Implementación para almacenamiento móvil (usando SQLite)
class MobileStorage {
  private db: any = null;

  /**
   * Inicializa la base de datos SQLite y crea la tabla si no existe
   */
  async init(): Promise<void> {
    if (!this.db) {
      const SQLite = require('expo-sqlite');
      this.db = SQLite.openDatabaseSync('qr_scanner.db');
      
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS scans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          qr_data TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          altitude REAL,
          accuracy REAL,
          timestamp INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  }

  /**
   * Obtiene todos los escaneos ordenados por fecha (más reciente primero)
   */
  async getScans(): Promise<ScanRecord[]> {
    if (!this.db) throw new Error('Base de datos no inicializada');
    const result = await this.db.getAllAsync('SELECT * FROM scans ORDER BY timestamp DESC');
    return result as ScanRecord[];
  }

  /**
   * Añade un nuevo escaneo QR a la base de datos
   * @param scanData Datos del escaneo (sin ID ni fecha de creación)
   * @returns ID del nuevo escaneo
   */
  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Base de datos no inicializada');
    
    const result = await this.db.runAsync(
      `INSERT INTO scans (qr_data, latitude, longitude, altitude, accuracy, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        scanData.qr_data,
        scanData.latitude,
        scanData.longitude,
        scanData.altitude,
        scanData.accuracy,
        scanData.timestamp,
      ]
    );
    
    return result.lastInsertRowId;
  }

  /**
   * Elimina un escaneo por su ID
   * @param id ID del escaneo a eliminar
   * @returns Verdadero si se eliminó correctamente
   */
  async deleteScan(id: number): Promise<boolean> {
    if (!this.db) throw new Error('Base de datos no inicializada');
    const result = await this.db.runAsync('DELETE FROM scans WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Busca un escaneo por su ID
   * @param id ID del escaneo a buscar
   * @returns El escaneo encontrado o null si no existe
   */
  async getScanById(id: number): Promise<ScanRecord | null> {
    if (!this.db) throw new Error('Base de datos no inicializada');
    const result = await this.db.getFirstAsync('SELECT * FROM scans WHERE id = ?', [id]);
    return result as ScanRecord || null;
  }
}

// Gestor principal de base de datos (patrón singleton)
class DatabaseManager {
  private storage: WebStorage | MobileStorage;

  constructor() {
    // Selecciona automáticamente el almacenamiento adecuado según la plataforma
    this.storage = Platform.OS === 'web' ? new WebStorage() : new MobileStorage();
  }

  /**
   * Inicializa el almacenamiento seleccionado
   */
  async init(): Promise<void> {
    await this.storage.init();
  }

  /**
   * Obtiene todos los escaneos ordenados por fecha
   */
  async getScans(): Promise<ScanRecord[]> {
    return this.storage.getScans();
  }

  /**
   * Añade un nuevo escaneo QR
   * @param scanData Datos del escaneo
   */
  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    return this.storage.addScan(scanData);
  }

  /**
   * Elimina un escaneo por su ID
   * @param id ID del escaneo a eliminar
   */
  async deleteScan(id: number): Promise<boolean> {
    return this.storage.deleteScan(id);
  }

  /**
   * Busca un escaneo específico por su ID
   * @param id ID del escaneo a buscar
   */
  async getScanById(id: number): Promise<ScanRecord | null> {
    return this.storage.getScanById(id);
  }
}

// Exporta una instancia única del gestor de base de datos (singleton)
export const database = new DatabaseManager();