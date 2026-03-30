import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

// BULLETPROOF TIMEOUT HELPER: Uses Promise.race instead of AbortController to avoid crashes
const fetchWithTimeout = (url, options = {}, timeoutMs = 1500) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: ESP8266 took too long')), timeoutMs)
    )
  ]);
};

const WifiSelectionScreen = ({ navigation }) => {
  const [wifiList, setWifiList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'WiFi scanning requires location permission',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          scanWifiNetworks();
        } else {
          Alert.alert('Permission Denied', 'Cannot scan WiFi without location permission');
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const scanWifiNetworks = async () => {
    setScanning(true);
    try {
      const networks = await WifiManager.reScanAndLoadWifiList();
      console.log('Found networks:', networks);
      
      const formattedNetworks = networks.map(network => ({
        ssid: network.SSID,
        level: network.level,
        secured: network.capabilities.includes('WPA') || network.capabilities.includes('WEP'),
      }));
      
      setWifiList(formattedNetworks);
      setScanning(false);
    } catch (error) {
      console.error('WiFi scan error:', error);
      Alert.alert('Scan Failed', 'Could not scan WiFi networks: ' + error.message);
      setScanning(false);
    }
  };

  const connectToWifi = async (network) => {
    setLoading(true);
    
    try {
      // 1. Connect using your original, working method
      await WifiManager.connectToProtectedSSID(network.ssid, "", false, false);
      
      // 2. Wait 4 seconds for Android to finalize the connection
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // 3. Retry loop (5 attempts)
      let connectionSuccessful = false;
      let lastError = null;

      for (let i = 0; i < 5; i++) {
        try {
          const response = await fetchWithTimeout(
            'http://192.168.4.1/data',
            { method: 'GET', headers: { Accept: 'application/json' } },
            1500 // Wait 1.5 seconds max per attempt
          );

          if (response.ok) {
            connectionSuccessful = true;
            break; 
          } else {
            lastError = new Error('HTTP status ' + response.status);
          }
        } catch (e) {
          lastError = e;
        }
        
        // Wait 300ms before next attempt
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 4. Handle Results
      if (!connectionSuccessful) {
        throw lastError || new Error('ESP8266 not responding after retries');
      }

      console.log('Successfully connected to ESP8266!');
      await AsyncStorage.setItem('esp8266_ssid', network.ssid);
      setLoading(false);
      navigation.navigate('Dashboard');
      
    } catch (error) {
      setLoading(false);
      console.error('WiFi connection error:', error);
      Alert.alert(
        'Connection Failed', 
        `Could not connect to ${network.ssid}\n\nError: ${String(error?.message || error)}`
      );
    }
  };

  const renderWifiItem = ({ item }) => (
    <TouchableOpacity
      style={styles.wifiItem}
      onPress={() => connectToWifi(item)}
    >
      <View style={styles.wifiInfo}>
        <Text style={styles.ssidText}>{item.ssid || 'Hidden Network'}</Text>
        <Text style={styles.levelText}>Signal: {item.level} dBm</Text>
      </View>
      <View style={styles.lockIcon}>
        {item.secured && <Text>🔒</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to PureStream Device</Text>
      <Text style={styles.subtitle}>Select your ESP8266 WiFi network below</Text>

      {scanning ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Scanning for networks...</Text>
        </View>
      ) : (
        <FlatList
          data={wifiList}
          renderItem={renderWifiItem}
          keyExtractor={(item, index) => item.ssid + index}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No networks found. Pull down to refresh.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={scanWifiNetworks}
        disabled={scanning}
      >
        <Text style={styles.refreshButtonText}>
          {scanning ? 'Scanning...' : 'Refresh Networks'}
        </Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.connectingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.connectingText}>Connecting to ESP8266...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50', marginBottom: 10, marginTop: 40 },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginBottom: 30 },
  list: { flex: 1 },
  wifiItem: { backgroundColor: '#fff', padding: 18, marginBottom: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  wifiInfo: { flex: 1 },
  ssidText: { fontSize: 18, fontWeight: '600', color: '#2C3E50', marginBottom: 4 },
  levelText: { fontSize: 14, color: '#95A5A6' },
  lockIcon: { marginLeft: 10 },
  refreshButton: { backgroundColor: '#4A90E2', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  refreshButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#7F8C8D' },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#95A5A6' },
  connectingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  connectingText: { color: '#fff', marginTop: 10, fontSize: 16 },
});

export default WifiSelectionScreen;