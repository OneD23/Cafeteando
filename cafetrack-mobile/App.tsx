import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { store } from './src/store';
import { fetchIngredients } from './src/store/inventorySlice';

import LoginScreen from './src/screens/LoginScreen';
import POSScreen from './src/screens/POSScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          
          if (route.name === 'POS') {
            iconName = focused ? 'cafe' : 'cafe-outline';
          } else if (route.name === 'Inventario') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Reportes') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Ajustes') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#d4a574',
        tabBarInactiveTintColor: '#8b6f4e',
        tabBarStyle: { 
          backgroundColor: '#1a0f0a', 
          borderTopColor: '#4a3428',
          paddingBottom: 5,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="POS" component={POSScreen} />
      <Tab.Screen name="Inventario" component={InventoryScreen} />
      <Tab.Screen name="Reportes" component={ReportsScreen} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const [user, setUser] = React.useState(store.getState().auth.user);
  
  React.useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setUser(store.getState().auth.user);
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (user) {
      store.dispatch(fetchIngredients() as any);
    }
  }, [user]);

  return user ? <MainTabs /> : <LoginScreen />;
}

export default function App() {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </Provider>
  );
}
