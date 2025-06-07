import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, QrCode, Zap, Clock } from 'lucide-react-native';
import { database } from '@/lib/database';

const { width, height } = Dimensions.get('window');

interface ScanResult {
  data: string;
  location: Location.LocationObject | null;
  timestamp: number;
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [notificationOpacity] = useState(new Animated.Value(0));
  const [isScanning, setIsScanning] = useState<boolean>(true);

  useEffect(() => {
    inicializarApp();
  }, []);

  const inicializarApp = async () => {
    try {
      await database.init();
      await obtenerPermisoUbicacion();
      await obtenerUbicacionActual();
      
      // Cargar conteo de escaneos existentes
      const scans = await database.getScans();
      setScanCount(scans.length);
    } catch (error) {
      console.error('Error al inicializar la app:', error);
    }
  };

  const obtenerPermisoUbicacion = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permisos de Ubicación',
          'Se necesitan permisos de ubicación para registrar dónde fueron escaneados los códigos QR.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error al solicitar permiso de ubicación:', error);
    }
  };

  const obtenerUbicacionActual = async () => {
    try {
      if (locationPermission) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(loc);
      }
    } catch (error) {
      console.error('Error al obtener ubicación:', error);
    }
  };

  const mostrarNotificacion = (message: string) => {
    Animated.sequence([
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(notificationOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const formatearFechaHora = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatearUbicacion = (lat: number | null, lng: number | null): string => {
    if (lat && lng) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    return 'Ubicación no disponible';
  };

  const manejarCodigoEscaneado = async ({ type, data }: { type: string; data: string }) => {
    if (!isScanning) return;
    
    try {
      setIsScanning(false);
      
      // Obtener ubicación actual
      let currentLocation = location;
      if (locationPermission) {
        try {
          currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
        } catch (error) {
          console.error('Error al obtener ubicación actual:', error);
        }
      }

      const scanResult: ScanResult = {
        data,
        location: currentLocation,
        timestamp: Date.now(),
      };

      setLastScan(scanResult);
      
      // Guardar en base de datos
      await guardarEscaneoEnBaseDeDatos(scanResult);
      
      // Actualizar conteo de escaneos
      const scans = await database.getScans();
      setScanCount(scans.length);
      
      mostrarNotificacion('Código QR escaneado correctamente');
      
      // Reactivar el escaneo después de un retraso
      setTimeout(() => {
        setIsScanning(true);
      }, 3000);
      
    } catch (error) {
      console.error('Error al manejar escaneo:', error);
      Alert.alert('Error', 'No se pudo procesar el código QR');
      setIsScanning(true);
    }
  };

  const guardarEscaneoEnBaseDeDatos = async (scanResult: ScanResult) => {
    try {
      const scanData = {
        qr_data: scanResult.data,
        latitude: scanResult.location?.coords.latitude || null,
        longitude: scanResult.location?.coords.longitude || null,
        altitude: scanResult.location?.coords.altitude || null,
        accuracy: scanResult.location?.coords.accuracy || null,
        timestamp: scanResult.timestamp,
      };

      const id = await database.addScan(scanData);
      console.log('Escaneo guardado exitosamente con ID:', id);
    } catch (error) {
      console.error('Error al guardar escaneo:', error);
      throw error;
    }
  };

  if (!permission) {
    return (
      <View style={styles.contenedorPermisos}>
        <Text style={styles.textoPermisos}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.contenedorPermisos}>
        <View style={styles.contenidoPermisos}>
          <QrCode size={80} color="#007AFF" />
          <Text style={styles.tituloPermisos}>Acceso a la Cámara</Text>
          <Text style={styles.mensajePermisos}>
            Necesitamos acceso a tu cámara para escanear códigos QR
          </Text>
          <TouchableOpacity style={styles.botonPermisos} onPress={requestPermission}>
            <Text style={styles.textoBotonPermisos}>Conceder Permisos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.contenedor}>
      {/* Banner de notificación */}
      <Animated.View style={[styles.notificacion, { opacity: notificationOpacity }]}>
        <Zap size={16} color="white" />
        <Text style={styles.textoNotificacion}>Código QR escaneado correctamente</Text>
      </Animated.View>

      {/* Info de GPS */}
      {location && (
        <View style={styles.infoGPS}>
          <MapPin size={12} color="#34C759" />
          <Text style={styles.textoGPS}>
            GPS: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      {/* Vista de la cámara */}
      <View style={styles.contenedorCamara}>
        <CameraView
          style={styles.camara}
          facing="back"
          onBarcodeScanned={isScanning ? manejarCodigoEscaneado : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          {/* Superposición del escáner */}
          <View style={styles.overlay}>
            <View style={styles.areaEscaneo}>
              <View style={styles.esquina} />
              <View style={[styles.esquina, styles.superiorDerecha]} />
              <View style={[styles.esquina, styles.inferiorIzquierda]} />
              <View style={[styles.esquina, styles.inferiorDerecha]} />
              
              {/* Indicador de escaneo */}
              {!isScanning && (
                <View style={styles.indicadorEscaneo}>
                  <Text style={styles.textoEscaneo}>Procesando...</Text>
                </View>
              )}
            </View>
          </View>
        </CameraView>
      </View>

      {/* Panel inferior de información */}
      <View style={styles.panelInferior}>
        <Text style={styles.textoInstruccion}>
          Apunta la cámara hacia un código QR para escanearlo
        </Text>
        
        {scanCount > 0 && (
          <View style={styles.contenedorEstadisticas}>
            <Text style={styles.textoEstadisticas}>Códigos escaneados: {scanCount}</Text>
          </View>
        )}

        {lastScan && (
          <View style={styles.contenedorUltimoEscaneo}>
            <Text style={styles.tituloUltimoEscaneo}>Último escaneo:</Text>
            <Text style={styles.datoUltimoEscaneo} numberOfLines={2}>
              {lastScan.data}
            </Text>
            
            {/* Fecha y Hora */}
            <View style={styles.filaMetaEscaneo}>
              <Clock size={14} color="#666" />
              <Text style={styles.textoMetaEscaneo}>
                {formatearFechaHora(lastScan.timestamp)}
              </Text>
            </View>
            
            {/* Ubicación */}
            <View style={styles.filaMetaEscaneo}>
              <MapPin size={14} color="#007AFF" />
              <Text style={styles.textoUbicacionEscaneo}>
                {formatearUbicacion(
                  lastScan.location?.coords.latitude || null,
                  lastScan.location?.coords.longitude || null
                )}
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#000',
  },
  contenedorPermisos: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contenidoPermisos: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  tituloPermisos: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginTop: 24,
    marginBottom: 12,
  },
  mensajePermisos: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  botonPermisos: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  textoBotonPermisos: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  textoPermisos: {
    fontSize: 16,
    color: '#666',
  },
  notificacion: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  textoNotificacion: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoGPS: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 100,
  },
  textoGPS: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  contenedorCamara: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  camara: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  areaEscaneo: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  esquina: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: '#007AFF',
    top: 0,
    left: 0,
  },
  superiorDerecha: {
    borderLeftWidth: 0,
    borderRightWidth: 4,
    top: 0,
    right: 0,
  },
  inferiorIzquierda: {
    borderTopWidth: 0,
    borderBottomWidth: 4,
    bottom: 0,
    left: 0,
  },
  inferiorDerecha: {
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopWidth: 0,
    borderBottomWidth: 4,
    bottom: 0,
    right: 0,
  },
  indicadorEscaneo: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  textoEscaneo: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  panelInferior: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  textoInstruccion: {
    fontSize: 16,
    color: '#1c1c1e',
    textAlign: 'center',
    fontWeight: '500',
  },
  contenedorEstadisticas: {
    marginTop: 12,
    alignItems: 'center',
  },
  textoEstadisticas: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  contenedorUltimoEscaneo: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  tituloUltimoEscaneo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  datoUltimoEscaneo: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    fontWeight: '500',
  },
  filaMetaEscaneo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  textoMetaEscaneo: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  textoUbicacionEscaneo: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
});