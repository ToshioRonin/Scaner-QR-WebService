import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Calendar, Share2, ExternalLink, Trash2, RefreshCw, QrCode, Clock } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { database, ScanRecord } from '@/lib/database';

export default function HistoryScreen() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cargar escaneos cuando la pantalla está enfocada
  useFocusEffect(
    useCallback(() => {
      loadScans();
    }, [])
  );

  const loadScans = async () => {
    try {
      setRefreshing(true);
      await database.init();
      const data = await database.getScans();
      setScans(data);
    } catch (error) {
      console.error('Failed to load scans:', error);
      Alert.alert('Error', 'No se pudieron cargar los escaneos');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadScans();
  };

  const handleDeleteScan = (id: number) => {
    Alert.alert(
      'Eliminar Escaneo',
      '¿Estás seguro de que quieres eliminar este escaneo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await database.deleteScan(id);
              if (success) {
                setScans(prev => prev.filter(scan => scan.id !== id));
                Alert.alert('Éxito', 'Escaneo eliminado correctamente');
              } else {
                Alert.alert('Error', 'No se pudo eliminar el escaneo');
              }
            } catch (error) {
              console.error('Error deleting scan:', error);
              Alert.alert('Error', 'No se pudo eliminar el escaneo');
            }
          },
        },
      ]
    );
  };

  const shareQR = async (qrData: string) => {
    try {
      await Share.share({
        message: `Código QR escaneado: ${qrData}`,
        title: 'Compartir Código QR',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const openURL = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se puede abrir este enlace');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const isURL = (text: string): boolean => {
    const urlPattern = /^(https?:\/\/)|(www\.)/i;
    return urlPattern.test(text);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', {
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

  const renderScanItem = ({ item }: { item: ScanRecord }) => (
    <View style={styles.tarjetaEscaneo}>
      <View style={styles.encabezadoEscaneo}>
        <View style={styles.infoEscaneo}>
          <Text style={styles.datoEscaneo} numberOfLines={2}>{item.qr_data}</Text>
          
          {/* Fecha */}
          <View style={styles.metaEscaneo}>
            <Calendar size={14} color="#666" />
            <Text style={styles.fechaEscaneo}>{formatDate(item.timestamp)}</Text>
          </View>
          
          {/* Hora */}
          <View style={styles.metaEscaneo}>
            <Clock size={14} color="#666" />
            <Text style={styles.horaEscaneo}>{formatTime(item.timestamp)}</Text>
          </View>
          
          {/* Ubicación */}
          {(item.latitude && item.longitude) && (
            <View style={styles.metaEscaneo}>
              <MapPin size={14} color="#007AFF" />
              <Text style={styles.ubicacionEscaneo}>
                {formatLocation(item.latitude, item.longitude)}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.botonesAccion}>
          <TouchableOpacity style={styles.botonAccion} onPress={() => shareQR(item.qr_data)}>
            <Share2 size={18} color="#007AFF" />
          </TouchableOpacity>
          {isURL(item.qr_data) && (
            <TouchableOpacity style={styles.botonAccion} onPress={() => openURL(item.qr_data)}>
              <ExternalLink size={18} color="#34C759" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.botonAccion} onPress={() => handleDeleteScan(item.id)}>
            <Trash2 size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.contenedorVacio}>
      <QrCode size={80} color="#C7C7CC" />
      <Text style={styles.tituloVacio}>No hay escaneos</Text>
      <Text style={styles.mensajeVacio}>
        Los códigos QR que escanees aparecerán aquí con fecha, hora y ubicación
      </Text>
      <TouchableOpacity style={styles.botonActualizar} onPress={loadScans}>
        <RefreshCw size={20} color="white" />
        <Text style={styles.textoBotonActualizar}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.contenedor}>
        <View style={styles.contenedorCarga}>
          <QrCode size={60} color="#007AFF" />
          <Text style={styles.textoCarga}>Cargando escaneos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.tituloEncabezado}>Historial de Escaneos</Text>
        <Text style={styles.subtituloEncabezado}>
          {scans.length} código{scans.length !== 1 ? 's' : ''} QR escaneado{scans.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={scans}
        renderItem={renderScanItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.contenedorLista}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#007AFF" 
            colors={['#007AFF']} 
          />
        }
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contenedorCarga: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoCarga: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    fontWeight: '500',
  },
  encabezado: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tituloEncabezado: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  subtituloEncabezado: {
    fontSize: 16,
    color: '#8e8e93',
    marginTop: 4,
  },
  contenedorLista: {
    padding: 16,
    flexGrow: 1,
  },
  tarjetaEscaneo: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  encabezadoEscaneo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoEscaneo: {
    flex: 1,
    marginRight: 12,
  },
  datoEscaneo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 12,
    lineHeight: 22,
  },
  metaEscaneo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fechaEscaneo: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  horaEscaneo: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  ubicacionEscaneo: {
    fontSize: 13,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  botonesAccion: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  botonAccion: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  contenedorVacio: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  tituloVacio: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginTop: 24,
    marginBottom: 12,
  },
  mensajeVacio: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  botonActualizar: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  textoBotonActualizar: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});