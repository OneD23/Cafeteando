import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { store } from './src/store';
import { fetchIngredients, setIngredients, setMovements } from './src/store/inventorySlice';
import { setTaxEnabled } from './src/store/cartSlice';
import { fetchProducts } from './src/store/recipesSlice';
import { hydrateJournal } from './src/store/accountingSlice';

import LoginScreen from './src/screens/LoginScreen';
import POSScreen from './src/screens/POSScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import UsersScreen from './src/screens/UsersScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/api/client';
import { initLocalDb, syncPendingData } from './src/services/localDb';

const Tab = createBottomTabNavigator();

const INGREDIENTS_KEY = 'cafetrack_inventory_ingredients';
const MOVEMENTS_KEY = 'cafetrack_inventory_movements';
const JOURNAL_KEY = 'cafetrack_accounting_entries';
const TAX_ENABLED_KEY = 'cafetrack_tax_enabled';

const registerWebServiceWorker = () => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('No se pudo registrar el modo offline web:', error);
    });
  });
};

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
          } else if (route.name === 'Contabilidad') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Usuarios') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Ajustes') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#d4a574',
        tabBarInactiveTintColor: '#8b6f4e',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 4,
          marginVertical: 6,
        },
        tabBarStyle: { 
          position: Platform.OS === 'web' ? 'absolute' : 'relative',
          left: Platform.OS === 'web' ? 24 : 0,
          right: Platform.OS === 'web' ? 24 : 0,
          bottom: Platform.OS === 'web' ? 20 : 0,
          height: Platform.OS === 'web' ? 74 : 68,
          backgroundColor: '#2c1810', 
          borderTopColor: 'rgba(212,165,116,0.18)',
          borderTopWidth: 1,
          borderRadius: Platform.OS === 'web' ? 24 : 0,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'web' ? 10 : 8,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 18,
        },
        sceneStyle: { backgroundColor: '#1a0f0a' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="POS" component={POSScreen} />
      <Tab.Screen name="Inventario" component={InventoryScreen} />
      <Tab.Screen name="Contabilidad" component={ReportsScreen} />
      <Tab.Screen name="Usuarios" component={UsersScreen} />
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
    registerWebServiceWorker();
    initLocalDb();
    const syncTimer = setInterval(() => {
      syncPendingData();
    }, 15000);
    return () => clearInterval(syncTimer);
  }, []);

  React.useEffect(() => {
    const restoreSession = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      try {
        const me = await api.me();
        if (me?.user) {
          await AsyncStorage.setItem('cafetrack_last_user', JSON.stringify(me.user));
          store.dispatch({ type: 'auth/setUser', payload: me.user } as any);
        }
      } catch {
        const cachedUser = await AsyncStorage.getItem('cafetrack_last_user');
        if (cachedUser) store.dispatch({ type: 'auth/setUser', payload: JSON.parse(cachedUser) } as any);
      }
    };
    restoreSession();
  }, []);

  React.useEffect(() => {
    const hydrateLocalState = async () => {
      const [ingRaw, movRaw, jnlRaw, taxRaw] = await Promise.all([
        AsyncStorage.getItem(INGREDIENTS_KEY),
        AsyncStorage.getItem(MOVEMENTS_KEY),
        AsyncStorage.getItem(JOURNAL_KEY),
        AsyncStorage.getItem(TAX_ENABLED_KEY),
      ]);
      if (ingRaw) store.dispatch(setIngredients(JSON.parse(ingRaw)) as any);
      if (movRaw) store.dispatch(setMovements(JSON.parse(movRaw)) as any);
      if (jnlRaw) store.dispatch(hydrateJournal(JSON.parse(jnlRaw)) as any);
      if (taxRaw === 'true' || taxRaw === 'false') store.dispatch(setTaxEnabled(taxRaw === 'true') as any);
    };
    hydrateLocalState();

    let persistTimeout: any;
    const unsubscribe = store.subscribe(() => {
      clearTimeout(persistTimeout);
      persistTimeout = setTimeout(async () => {
        const state = store.getState();
        await AsyncStorage.setItem(INGREDIENTS_KEY, JSON.stringify(state.inventory.ingredients || []));
        await AsyncStorage.setItem(MOVEMENTS_KEY, JSON.stringify(state.inventory.movements || []));
        await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(state.accounting.entries || []));
        await AsyncStorage.setItem(TAX_ENABLED_KEY, String(state.cart.taxEnabled));
      }, 250);
    });

    return () => {
      clearTimeout(persistTimeout);
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (user) {
      store.dispatch(fetchIngredients() as any);
      store.dispatch(fetchProducts() as any);
    }
  }, [user]);

  return user ? <MainTabs /> : <LoginScreen />;
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
        <SpeedInsights />
      </SafeAreaProvider>
    </Provider>
  );
}
