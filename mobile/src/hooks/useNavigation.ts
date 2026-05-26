import { useCallback } from 'react';
import { useNavigationContext } from '../context/NavigationContext';
import { fetchRoute } from '../services/routing';
import { api } from '../services/api';
import { Location } from '../types';

export function useNavigation() {
  const { state, dispatch } = useNavigationContext();

  const setDestination = useCallback(async (location: Location) => {
    dispatch({ type: 'SET_DESTINATION', payload: location });
  }, [dispatch]);

  const startNavigation = useCallback(async () => {
    if (!state.currentLocation || !state.destination) return;

    const route = await fetchRoute(
      state.currentLocation.id,
      state.destination.id,
      state.isAccessibilityMode
    );

    if (route) {
      dispatch({ type: 'SET_ROUTE', payload: route });
      dispatch({ type: 'START_NAVIGATION' });
    }
  }, [state.currentLocation, state.destination, state.isAccessibilityMode, dispatch]);

  const advanceStep = useCallback(() => {
    dispatch({ type: 'ADVANCE_STEP' });
  }, [dispatch]);

  const endNavigation = useCallback(() => {
    dispatch({ type: 'END_NAVIGATION' });
  }, [dispatch]);

  const toggleAccessibility = useCallback(() => {
    dispatch({ type: 'TOGGLE_ACCESSIBILITY' });
  }, [dispatch]);

  const toggleVoice = useCallback(() => {
    dispatch({ type: 'TOGGLE_VOICE' });
  }, [dispatch]);

  const scanQRCode = useCallback(async (codeUuid: string): Promise<Location | null> => {
    try {
      const data = await api.get<{ location: Location }>(`/api/qr-codes/scan/${codeUuid}`);
      dispatch({ type: 'SET_CURRENT_LOCATION', payload: data.location });
      return data.location;
    } catch {
      return null;
    }
  }, [dispatch]);

  return {
    state,
    setDestination,
    startNavigation,
    advanceStep,
    endNavigation,
    toggleAccessibility,
    toggleVoice,
    scanQRCode,
  };
}
