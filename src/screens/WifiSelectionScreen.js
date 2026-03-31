import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const ESP8266_IP = 'http://192.168.4.1';

const WifiSelectionScreen = ({ navigation }) => {
  const [checking, setChecking] = useState(false);

  // Simple fetch to verify ESP8266 is reachable
  const verifyAndConnect = async () => {
    setChecking(true);

    try {
      const response = await Promise.race([
        fetch(`${ESP8266_IP}/data`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 3000)
        ),
      ]);

      if (response.ok) {
        const data = await response.json();
        console.log('ESP8266 data:', data);
        await AsyncStorage.setItem('esp8266_ssid', 'ESP8266_PureStream');
        setChecking(false);
        navigation.navigate('Dashboard');
      } else {
        throw new Error('HTTP ' + response.status);
      }
    } catch (error) {
      setChecking(false);
      console.error('Verify failed:', error);
      Alert.alert(
        'Not Connected',
        'Could not reach ESP8266 at 192.168.4.1\n\nMake sure you are connected to "ESP8266_PureStream" WiFi network and mobile data is turned OFF, then try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const openWifiSettings = () => {
    try {
      Linking.sendIntent('android.settings.WIFI_SETTINGS');
    } catch (e) {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PureStream Setup</Text>

      <View style={styles.stepsContainer}>
        <View style={styles.step}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Open WiFi Settings</Text>
            <Text style={styles.stepDesc}>Connect to the network named{'\n'}<Text style={styles.bold}>"ESP8266_PureStream"</Text></Text>
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Turn off Mobile Data</Text>
            <Text style={styles.stepDesc}>This ensures your phone routes traffic through the ESP8266 WiFi</Text>
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Come back here & tap Connect</Text>
            <Text style={styles.stepDesc}>We'll verify the connection and take you to the dashboard</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.settingsButton} onPress={openWifiSettings}>
        <Text style={styles.settingsButtonText}>📶  Open WiFi Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.connectButton, checking && styles.connectButtonDisabled]}
        onPress={verifyAndConnect}
        disabled={checking}
      >
        {checking ? (
          <View style={styles.buttonRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.connectButtonText}>  Checking connection...</Text>
          </View>
        ) : (
          <Text style={styles.connectButtonText}>✓  I'm Connected — Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 40,
  },
  stepsContainer: {
    marginBottom: 40,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  settingsButton: {
    backgroundColor: '#2C3E50',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#27AE60',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    backgroundColor: '#7DCEA0',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default WifiSelectionScreen;