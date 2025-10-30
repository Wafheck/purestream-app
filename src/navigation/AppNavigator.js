import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WifiSelectionScreen from '../screens/WifiSelectionScreen';
import DashboardScreen from '../screens/DashboardScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
    return (
        <Stack.Navigator
            initialRouteName="WifiSelection"
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="WifiSelection" component={WifiSelectionScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
        </Stack.Navigator>
    );
};

export default AppNavigator;
