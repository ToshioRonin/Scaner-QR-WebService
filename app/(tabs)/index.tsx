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
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await database.init();
      await getLocationPermission();
      await getCurrentLocation();
      
      // Load existing scan count
      const scans = await database.getScans();
      setScanCount(scans.length);
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  };

  const getLocationPermission = async () => {
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
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      if (locationPermission) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(loc);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const showNotification = (message: string) => {
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

  const formatDateTime = (timestamp: number): string => {
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

  const formatLocation = (lat: number | null, lng: number | null): string => {
    if (lat && lng) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    return 'Ubicación no disponible';
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (!isScanning) return;
    
    try {
      setIsScanning(false);
      
      // Get current location
      let currentLocation = location;
      if (locationPermission) {
        try {
          currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
        } catch (error) {
          console.error('Error getting current location:', error);
        }
      }

      const scanResult: ScanResult = {
        data,
        location: currentLocation,
        timestamp: Date.now(),
      };

      setLastScan(scanResult);
      
      // Save to database
      await saveScanToDatabase(scanResult);
      
      // Update scan count
      const scans = await database.getScans();
      setScanCount(scans.length);
      
      showNotification('Código QR escaneado correctamente');
      
      // Re-enable scanning after a delay
      setTimeout(() => {
        setIsScanning(true);
      }, 3000);
      
    } catch (error) {
      console.error('Error handling scan:', error);
      Alert.alert('Error', 'No se pudo procesar el código QR');
      setIsScanning(true);
    }
  };

  const saveScanToDatabase = async (scanResult: ScanResult) => {
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
      console.log('Scan saved successfully with ID:', id);
    } catch (error) {
      console.error('Error saving scan:', error);
      throw error;
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <QrCode size={80} color="#007AFF" />
          <Text style={styles.permissionTitle}>Acceso a la Cámara</Text>
          <Text style={styles.permissionMessage}>
            Necesitamos acceso a tu cámara para escanear códigos QR
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Conceder Permisos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Notification Banner */}
      <Animated.View style={[styles.notification, { opacity: notificationOpacity }]}>
        <Zap size={16} color="white" />
        <Text style={styles.notificationText}>Código QR escaneado correctamente</Text>
      </Animated.View>

      {/* GPS Info */}
      {location && (
        <View style={styles.gpsInfo}>
          <MapPin size={12} color="#34C759" />
          <Text style={styles.gpsText}>
            GPS: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={styles.corner} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              {/* Scanning indicator */}
              {!isScanning && (
                <View style={styles.scanningIndicator}>
                  <Text style={styles.scanningText}>Procesando...</Text>
                </View>
              )}
            </View>
          </View>
        </CameraView>
      </View>

      {/* Bottom Info Panel */}
      <View style={styles.bottomPanel}>
        <Text style={styles.instructionText}>
          Apunta la cámara hacia un código QR para escanearlo
        </Text>
        
        {scanCount > 0 && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>Códigos escaneados: {scanCount}</Text>
          </View>
        )}

        {lastScan && (
          <View style={styles.lastScanContainer}>
            <Text style={styles.lastScanTitle}>Último escaneo:</Text>
            <Text style={styles.lastScanData} numberOfLines={2}>
              {lastScan.data}
            </Text>
            
            {/* Date and Time */}
            <View style={styles.scanMetaRow}>
              <Clock size={14} color="#666" />
              <Text style={styles.scanMetaText}>
                {formatDateTime(lastScan.timestamp)}
              </Text>
            </View>
            
            {/* Location */}
            <View style={styles.scanMetaRow}>
              <MapPin size={14} color="#007AFF" />
              <Text style={styles.scanLocationText}>
                {formatLocation(
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionMessage: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
  },
  notification: {
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
  notificationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  gpsInfo: {
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
  gpsText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  cameraContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: '#007AFF',
    top: 0,
    left: 0,
  },
  topRight: {
    borderLeftWidth: 0,
    borderRightWidth: 4,
    top: 0,
    right: 0,
  },
  bottomLeft: {
    borderTopWidth: 0,
    borderBottomWidth: 4,
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopWidth: 0,
    borderBottomWidth: 4,
    bottom: 0,
    right: 0,
  },
  scanningIndicator: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scanningText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPanel: {
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
  instructionText: {
    fontSize: 16,
    color: '#1c1c1e',
    textAlign: 'center',
    fontWeight: '500',
  },
  statsContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  lastScanContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  lastScanTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  lastScanData: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    fontWeight: '500',
  },
  scanMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scanMetaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  scanLocationText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
});