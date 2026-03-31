import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const ESP8266_IP = 'http://192.168.4.1';  // Default ESP8266 AP IP

const DashboardScreen = ({ navigation }) => {
    const [sensorData, setSensorData] = useState({
        tds: 0,
        temperature: 0,
        turbidity: 0,
        relayHeater: false,
        relayUVC: false,
    });

    const [tdsHistory, setTdsHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [tempHistory, setTempHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Fetch data every 2 seconds
        const interval = setInterval(() => {
            fetchSensorData();
        }, 2000);
        
        // Initial fetch
        fetchSensorData();
        
        return () => clearInterval(interval);
    }, []);

    const fetchSensorData = async () => {
        try {
            const response = await fetch(`${ESP8266_IP}/data`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                timeout: 5000,
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Received data:', data);
                
                setSensorData({
                    tds: data.tds || 0,
                    temperature: data.temperature || 0,
                    turbidity: data.turbidity || 0,
                    relayHeater: data.heaterState || false,
                    relayUVC: data.uvcState || false,
                });
                
                // Update history
                setTdsHistory(prev => [...prev.slice(1), data.tds || 0]);
                setTempHistory(prev => [...prev.slice(1), data.temperature || 0]);
                
                setConnected(true);
            } else {
                console.error('Failed to fetch data:', response.status);
                setConnected(false);
            }
        } catch (error) {
            console.error('Error fetching sensor data:', error);
            setConnected(false);
        }
    };

    const toggleHeater = async () => {
        const newState = !sensorData.relayHeater;
        
        try {
            const response = await fetch(`${ESP8266_IP}/heater?state=${newState ? 'on' : 'off'}`, {
                method: 'POST',
            });
            
            if (response.ok) {
                setSensorData(prev => ({
                    ...prev,
                    relayHeater: newState,
                }));
                Alert.alert('Heater Toggled', `Heater is now ${newState ? 'ON' : 'OFF'}`);
            } else {
                Alert.alert('Error', 'Failed to toggle heater');
            }
        } catch (error) {
            console.error('Error toggling heater:', error);
            Alert.alert('Connection Error', 'Could not communicate with ESP8266');
        }
    };

    const toggleUVC = async () => {
        const newState = !sensorData.relayUVC;
        
        try {
            const response = await fetch(`${ESP8266_IP}/uvc?state=${newState ? 'on' : 'off'}`, {
                method: 'POST',
            });
            
            if (response.ok) {
                setSensorData(prev => ({
                    ...prev,
                    relayUVC: newState,
                }));
                Alert.alert('UV-C LED Toggled', `UVC is now ${newState ? 'ON' : 'OFF'}`);
            } else {
                Alert.alert('Error', 'Failed to toggle UVC');
            }
        } catch (error) {
            console.error('Error toggling UVC:', error);
            Alert.alert('Connection Error', 'Could not communicate with ESP8266');
        }
    };

    const getTDSStatus = (tds) => {
        if (tds < 100) return { text: 'Excellent', color: '#27AE60' };
        if (tds < 300) return { text: 'Good', color: '#F39C12' };
        if (tds < 500) return { text: 'Fair', color: '#E67E22' };
        return { text: 'Poor', color: '#E74C3C' };
    };

    const tdsStatus = getTDSStatus(sensorData.tds);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>PureStream Dashboard</Text>
                    <Text style={styles.connectionStatus}>
                        {connected ? '🟢 Connected' : '🔴 Disconnected'}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.disconnectButton}>
                    <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.cardsContainer}>
                <View style={[styles.card, { backgroundColor: '#8BC462' }]}>
                    <Text style={styles.cardLabel}>TDS Level</Text>
                    <Text style={styles.cardValue}>{sensorData.tds}</Text>
                    <Text style={styles.cardUnit}>ppm</Text>
                    <View style={[styles.statusBadge, { backgroundColor: tdsStatus.color }]}>
                        <Text style={styles.statusText}>{tdsStatus.text}</Text>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: '#E74C3C' }]}>
                    <Text style={styles.cardLabel}>Temperature</Text>
                    <Text style={styles.cardValue}>{sensorData.temperature.toFixed(1)}</Text>
                    <Text style={styles.cardUnit}>°C</Text>
                </View>

                <View style={[styles.card, { backgroundColor: '#3498DB' }]}>
                    <Text style={styles.cardLabel}>Turbidity</Text>
                    <Text style={styles.cardValue}>{sensorData.turbidity.toFixed(1)}</Text>
                    <Text style={styles.cardUnit}>NTU</Text>
                </View>
            </View>

            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Total Dissolved Solids History (Last 6 readings)</Text>
                <LineChart
                    data={{
                        labels: ['', '', '', '', '', ''],
                        datasets: [{ data: tdsHistory.length > 0 ? tdsHistory : [0] }],
                    }}
                    width={Dimensions.get('window').width - 70}
                    height={220}
                    chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(0, 252, 119, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        propsForDots: {
                            r: '3',
                            strokeWidth: '1',
                            stroke: '#8BC462',
                        },
                    }}
                    bezier
                    style={styles.chart}
                />
            </View>

            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Temperature History</Text>
                <LineChart
                    data={{
                        labels: ['', '', '', '', '', ''],
                        datasets: [{ data: tempHistory.length > 0 ? tempHistory : [0] }],
                    }}
                    width={Dimensions.get('window').width - 70}
                    height={220}
                    chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        propsForDots: {
                            r: '3',
                            strokeWidth: '1',
                            stroke: '#E70C3C',
                        },
                    }}
                    bezier
                    style={styles.chart}
                />
            </View>

            <View style={styles.relayContainer}>
                <Text style={styles.relayTitle}>Heater Control</Text>
                <TouchableOpacity
                    style={[styles.relayButton, { backgroundColor: sensorData.relayHeater ? '#27AE60' : '#95A5A6' }]}
                    onPress={toggleHeater}
                >
                    <Text style={styles.relayButtonText}>{sensorData.relayHeater ? 'Heater ON' : 'Heater OFF'}</Text>
                </TouchableOpacity>
                <Text style={styles.relayStatus}>Status: {sensorData.relayHeater ? 'Running' : 'Stopped'}</Text>
            </View>
            
            <View style={styles.relayContainer}>
                <Text style={styles.relayTitle}>UVC LED Control</Text>
                <TouchableOpacity
                    style={[styles.relayButton, { backgroundColor: sensorData.relayUVC ? '#27AE60' : '#95A5A6' }]}
                    onPress={toggleUVC}
                >
                    <Text style={styles.relayButtonText}>{sensorData.relayUVC ? 'UVC ON' : 'UVC OFF'}</Text>
                </TouchableOpacity>
                <Text style={styles.relayStatus}>Status: {sensorData.relayUVC ? 'Running' : 'Stopped'}</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#2C3E50',
        paddingTop: 40,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    connectionStatus: {
        fontSize: 12,
        color: '#fff',
        marginTop: 5,
    },
    disconnectButton: {
        backgroundColor: '#E74C3C',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    },
    disconnectText: {
        color: '#fff',
        fontWeight: '600',
    },
    cardsContainer: {
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 40,
    },
    card: {
        flex: 1,
        padding: 20,
        borderStyle: 'solid',
        borderWidth: 2,
        borderRadius: 20,
        margin: 10,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    cardLabel: {
        color: '#fff',
        fontSize: 14,
        marginBottom: 5,
        opacity: 0.9,
        fontWeight: 'bold',
    },
    cardValue: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
    },
    cardUnit: {
        color: '#fff',
        fontSize: 16,
        marginTop: 5,
        opacity: 0.8,
        fontWeight: 'bold'
    },
    statusBadge: {
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    chartContainer: {
        backgroundColor: '#fff',
        margin: 20,
        marginTop: 10,
        padding: 15,
        fontWeight: 'bold',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 3,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 15,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    relayContainer: {
        backgroundColor: '#fff',
        margin: 20,
        marginTop: 0,
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 40,
    },
    relayTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 15,
    },
    relayButton: {
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    relayButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    relayStatus: {
        marginTop: 10,
        fontSize: 14,
        color: '#7F8C8D',
    },
});

export default DashboardScreen;