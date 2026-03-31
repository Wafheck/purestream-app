import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

const ESP8266_IP = 'http://192.168.4.1';

// Timeout helper using Promise.race
const fetchWithTimeout = (url, options = {}, timeoutMs = 2000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
};

const WifiSelectionScreen = ({ navigation }) => {
  const [wifiList, setWifiList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [waitingForManual, setWaitingForManual] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      // Cleanup poll on unmount
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  // Try to reach the ESP8266 API
  const verifyESP8266Connection = async () => {
    try {
      const response = await fetchWithTimeout(
        `${ESP8266_IP}/data`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        2000
      );
      return response.ok;
    } catch (e) {
      return false;
    }
  };

  // Attempt programmatic connection first, then fall back to manual
  const connectToWifi = async (network) => {
    setLoading(true);

    try {
      // 1. Force WiFi usage BEFORE connecting (some Android versions need this order)
      try {
        await WifiManager.forceWifiUsage(true);
      } catch (e) {
        console.log('forceWifiUsage pre-connect failed (non-fatal):', e);
      }

      // 2. Connect to the ESP8266 WiFi network
      await WifiManager.connectToProtectedSSID(network.ssid, "", false, false);

      // 3. Force WiFi usage AFTER connecting too
      try {
        await WifiManager.forceWifiUsage(true);
      } catch (e) {
        console.log('forceWifiUsage post-connect failed (non-fatal):', e);
      }

      // 4. Wait for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 4000));

      // 5. Try to reach ESP8266 (8 attempts with increasing delays)
      let connectionSuccessful = false;

      for (let i = 0; i < 8; i++) {
        console.log(`ESP8266 connection attempt ${i + 1}/8...`);
        if (await verifyESP8266Connection()) {
          connectionSuccessful = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (connectionSuccessful) {
        console.log('Successfully connected to ESP8266!');
        await AsyncStorage.setItem('esp8266_ssid', network.ssid);
        setLoading(false);
        navigation.navigate('Dashboard');
        return;
      }

      // 6. Programmatic connection didn't route traffic — offer manual connect
      setLoading(false);
      try { await WifiManager.forceWifiUsage(false); } catch (_) {}

      Alert.alert(
        'Manual Connection Needed',
        `Your phone connected to ${network.ssid} but Android is blocking the app's network access.\n\nPlease tap "Connect Manually" below to open WiFi Settings and connect to "${network.ssid}" from there.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      setLoading(false);
      try { await WifiManager.forceWifiUsage(false); } catch (_) {}
      console.error('WiFi connection error:', error);
      Alert.alert(
        'Connection Failed',
        `Could not connect to ${network.ssid}\n\nTap "Connect Manually" below to connect from WiFi Settings instead.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Open WiFi Settings and poll for ESP8266 connectivity
  const connectManually = async () => {
    setWaitingForManual(true);

    // Open Android WiFi Settings
    try {
      await Linking.sendIntent('android.settings.WIFI_SETTINGS');
    } catch (e) {
      // Fallback
      Linking.openSettings();
    }

    // Poll every 2 seconds to detect when user has connected
    pollRef.current = setInterval(async () => {
      console.log('Polling for ESP8266 connection...');
      const reachable = await verifyESP8266Connection();
      if (reachable) {
        console.log('ESP8266 reachable! Navigating to Dashboard.');
        clearInterval(pollRef.current);
        pollRef.current = null;
        setWaitingForManual(false);
        await AsyncStorage.setItem('esp8266_ssid', 'ESP8266_PureStream');
        navigation.navigate('Dashboard');
      }
    }, 2000);
  };

  const cancelManualConnect = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWaitingForManual(false);
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
            <Text style={styles.emptyText}>No networks found. Tap Refresh below.</Text>
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

      <TouchableOpacity
        style={styles.manualButton}
        onPress={connectManually}
        disabled={waitingForManual}
      >
        <Text style={styles.manualButtonText}>
          {waitingForManual ? '⏳ Waiting for connection...' : '⚙️ Connect Manually (WiFi Settings)'}
        </Text>
      </TouchableOpacity>

      {waitingForManual && (
        <TouchableOpacity style={styles.cancelButton} onPress={cancelManualConnect}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}

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
  manualButton: { backgroundColor: '#2C3E50', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  manualButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: '#E74C3C', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#7F8C8D' },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#95A5A6' },
  connectingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  connectingText: { color: '#fff', marginTop: 10, fontSize: 16 },
});

export default WifiSelectionScreen;