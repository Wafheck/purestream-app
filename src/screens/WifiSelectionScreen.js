import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    PermissionsAndroid,
    Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
                }
            } catch (err) {
                console.warn(err);
            }
        }
    };

    const scanWifiNetworks = () => {
        setScanning(true);
        // Simulated WiFi scan - In real app, use expo-network or similar
        setTimeout(() => {
            const networks = [
                { ssid: 'ESP8266_PureStream', level: -45, secured: false },
                { ssid: 'Home_WiFi', level: -60, secured: true },
                { ssid: 'Office_Network', level: -75, secured: true },
            ];
            setWifiList(networks);
            setScanning(false);
        }, 2000);
    };

    const connectToWifi = async (network) => {
        if (network.ssid.includes('ESP8266')) {
            setLoading(true);
            setTimeout(async () => {
                await AsyncStorage.setItem('esp8266_ssid', network.ssid);
                setLoading(false);
                navigation.navigate('Dashboard');
            }, 1500);
        } else {
            Alert.alert('Info', 'Please connect to your ESP8266 network (ESP8266_PureStream)');
        }
    };

    const renderWifiItem = ({ item }) => (
        <TouchableOpacity
            style={styles.wifiItem}
            onPress={() => connectToWifi(item)}
        >
            <View style={styles.wifiInfo}>
                <Text style={styles.ssidText}>{item.ssid}</Text>
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
                    keyExtractor={(item) => item.ssid}
                    style={styles.list}
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
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginBottom: 10,
        marginTop: 40,
    },
    subtitle: {
        fontSize: 16,
        color: '#7F8C8D',
        marginBottom: 30,
    },
    list: {
        flex: 1,
    },
    wifiItem: {
        backgroundColor: '#fff',
        padding: 18,
        marginBottom: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    wifiInfo: {
        flex: 1,
    },
    ssidText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 4,
    },
    levelText: {
        fontSize: 14,
        color: '#95A5A6',
    },
    lockIcon: {
        marginLeft: 10,
    },
    refreshButton: {
        backgroundColor: '#4A90E2',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#7F8C8D',
    },
    connectingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    connectingText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
    },
});

export default WifiSelectionScreen;
