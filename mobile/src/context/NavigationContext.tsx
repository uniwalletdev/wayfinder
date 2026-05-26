import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Location, Route, Coordinates } from '../types';

interface NavigationState {
  currentLocation: Location | null;
  destination: Location | null;
  currentRoute: Route | null;
  currentStep: number;
  userPosition: Coordinates | null;
  isAccessibilityMode: boolean;
  isVoiceEnabled: boolean;
  isNavigating: boolean;
}

type NavigationAction =
  | { type: 'SET_CURRENT_LOCATION'; payload: Location }
  | { type: 'SET_DESTINATION'; payload: Location }
  | { type: 'SET_ROUTE'; payload: Route }
  | { type: 'ADVANCE_STEP' }
  | { type: 'SET_USER_POSITION'; payload: Coordinates }
  | { type: 'TOGGLE_ACCESSIBILITY' }
  | { type: 'TOGGLE_VOICE' }
  | { type: 'START_NAVIGATION' }
  | { type: 'END_NAVIGATION' }
  | { type: 'RESET' };

const initialState: NavigationState = {
  currentLocation: null,
  destination: null,
  currentRoute: null,
  currentStep: 0,
  userPosition: null,
  isAccessibilityMode: false,
  isVoiceEnabled: true,
  isNavigating: false,
};

function reducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'SET_CURRENT_LOCATION':
      return { ...state, currentLocation: action.payload };
    case 'SET_DESTINATION':
      return { ...state, destination: action.payload };
    case 'SET_ROUTE':
      return { ...state, currentRoute: action.payload, currentStep: 0 };
    case 'ADVANCE_STEP':
      return { ...state, currentStep: state.currentStep + 1 };
    case 'SET_USER_POSITION':
      return { ...state, userPosition: action.payload };
    case 'TOGGLE_ACCESSIBILITY':
      return { ...state, isAccessibilityMode: !state.isAccessibilityMode };
    case 'TOGGLE_VOICE':
      return { ...state, isVoiceEnabled: !state.isVoiceEnabled };
    case 'START_NAVIGATION':
      return { ...state, isNavigating: true };
    case 'END_NAVIGATION':
      return { ...state, isNavigating: false };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface NavigationContextValue {
  state: NavigationState;
  dispatch: React.Dispatch<NavigationAction>;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <NavigationContext.Provider value={{ state, dispatch }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigationContext must be used within NavigationProvider');
  return ctx;
}
