// components/DashboardLoaderContext.js - Global context for persistent dashboard loading
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';

const DashboardLoaderContext = createContext();

// Action types
const ACTIONS = {
  START_LOADING: 'START_LOADING',
  LOAD_BATCH_SUCCESS: 'LOAD_BATCH_SUCCESS',
  LOADING_COMPLETE: 'LOADING_COMPLETE',
  PAUSE_LOADING: 'PAUSE_LOADING',
  RESUME_LOADING: 'RESUME_LOADING',
  RESET_LOADING: 'RESET_LOADING'
};

// Initial state
const initialState = {
  isLoading: false,
  isPaused: false,
  totalProducts: 0,
  loadedProducts: 0,
  currentOffset: 0,
  products: [],
  lastLoadTime: null,
  loadingSpeed: 0, // products per second
  estimatedTimeRemaining: 0
};

// Reducer
function dashboardLoaderReducer(state, action) {
  switch (action.type) {
    case ACTIONS.START_LOADING:
      return {
        ...state,
        isLoading: true,
        isPaused: false,
        totalProducts: action.totalProducts || state.totalProducts,
        currentOffset: action.offset || 0,
        lastLoadTime: Date.now()
      };

    case ACTIONS.LOAD_BATCH_SUCCESS:
      const newProducts = [...state.products, ...action.products];
      const newLoadedProducts = newProducts.length;
      const now = Date.now();
      const timeDiff = (now - state.lastLoadTime) / 1000; // seconds
      const newSpeed = timeDiff > 0 ? action.products.length / timeDiff : 0;
      const remainingProducts = state.totalProducts - newLoadedProducts;
      const estimatedTime = newSpeed > 0 ? remainingProducts / newSpeed : 0;

      return {
        ...state,
        products: newProducts,
        loadedProducts: newLoadedProducts,
        currentOffset: action.newOffset,
        loadingSpeed: newSpeed,
        estimatedTimeRemaining: estimatedTime,
        lastLoadTime: now
      };

    case ACTIONS.LOADING_COMPLETE:
      return {
        ...state,
        isLoading: false,
        isPaused: false,
        loadedProducts: state.totalProducts,
        estimatedTimeRemaining: 0
      };

    case ACTIONS.PAUSE_LOADING:
      return {
        ...state,
        isPaused: true
      };

    case ACTIONS.RESUME_LOADING:
      return {
        ...state,
        isPaused: false,
        lastLoadTime: Date.now()
      };

    case ACTIONS.RESET_LOADING:
      return {
        ...initialState
      };

    default:
      return state;
  }
}

// Custom hook for using the dashboard loader
export function useDashboardLoader() {
  const context = useContext(DashboardLoaderContext);
  if (!context) {
    throw new Error('useDashboardLoader must be used within a DashboardLoaderProvider');
  }
  return context;
}

// Provider component
export function DashboardLoaderProvider({ children }) {
  const [state, dispatch] = useReducer(dashboardLoaderReducer, initialState);
  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Background loading function
  const loadNextBatch = async () => {
    if (state.isPaused || !state.isLoading) return;

    console.log(`🔄 BACKGROUND LOADER: Loading batch at offset ${state.currentOffset}, total loaded: ${state.loadedProducts}/${state.totalProducts}`);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const limit = 100; // Load 100 products per batch
      const response = await fetch(`/api/analysis-cached?limit=${limit}&offset=${state.currentOffset}&v=${Date.now()}`, {
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        console.error('Failed to load batch:', response.statusText);
        return;
      }

      const data = await response.json();

      if (data.success && data.results?.length > 0) {
        console.log(`✅ BACKGROUND LOADER: Loaded ${data.results.length} products successfully`);

        dispatch({
          type: ACTIONS.LOAD_BATCH_SUCCESS,
          products: data.results,
          newOffset: state.currentOffset + data.results.length
        });

        // Update total products count from metadata if available
        if (data.metadata?.totalProducts && data.metadata.totalProducts !== state.totalProducts) {
          dispatch({
            type: ACTIONS.START_LOADING,
            totalProducts: data.metadata.totalProducts,
            offset: state.currentOffset
          });
        }

        // Check if we're done loading
        if (data.results.length < limit || state.currentOffset + data.results.length >= state.totalProducts) {
          console.log(`🎉 BACKGROUND LOADER: Loading complete! Total products loaded: ${state.currentOffset + data.results.length}`);
          dispatch({ type: ACTIONS.LOADING_COMPLETE });
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      } else {
        console.log(`⚠️ BACKGROUND LOADER: No products returned from API`);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading dashboard batch:', error);
      }
    }
  };

  // Start background loading
  const startBackgroundLoading = (totalProducts = 3000) => {
    console.log(`🚀 BACKGROUND LOADER: Starting background loading with estimated ${totalProducts} products`);

    // Stop any existing loading
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    dispatch({
      type: ACTIONS.START_LOADING,
      totalProducts,
      offset: state.products.length
    });

    console.log(`📊 BACKGROUND LOADER: Starting from offset ${state.products.length}, will load in batches of 100 every 3 seconds`);

    // Load batches every 3 seconds
    intervalRef.current = setInterval(loadNextBatch, 3000);

    // Load first batch immediately
    setTimeout(loadNextBatch, 100);
  };

  const pauseLoading = () => {
    dispatch({ type: ACTIONS.PAUSE_LOADING });
  };

  const resumeLoading = () => {
    dispatch({ type: ACTIONS.RESUME_LOADING });
    if (!intervalRef.current && state.loadedProducts < state.totalProducts) {
      intervalRef.current = setInterval(loadNextBatch, 3000);
    }
  };

  const resetLoading = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    dispatch({ type: ACTIONS.RESET_LOADING });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Save state to localStorage for persistence across page reloads
  useEffect(() => {
    if (state.products.length > 0) {
      localStorage.setItem('dashboardLoaderState', JSON.stringify({
        totalProducts: state.totalProducts,
        loadedProducts: state.loadedProducts,
        currentOffset: state.currentOffset,
        products: state.products.slice(0, 500), // Only save first 500 to avoid localStorage limits
        lastLoadTime: state.lastLoadTime
      }));
    }
  }, [state.products.length, state.totalProducts, state.loadedProducts]);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('dashboardLoaderState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Restore state if it's recent (less than 30 minutes old)
        if (Date.now() - parsed.lastLoadTime < 30 * 60 * 1000) {
          dispatch({
            type: ACTIONS.LOAD_BATCH_SUCCESS,
            products: parsed.products,
            newOffset: parsed.currentOffset
          });
        }
      } catch (error) {
        console.error('Error loading saved dashboard state:', error);
      }
    }
  }, []);

  const contextValue = {
    ...state,
    startBackgroundLoading,
    pauseLoading,
    resumeLoading,
    resetLoading,

    // Computed properties
    progressPercentage: state.totalProducts > 0 ? (state.loadedProducts / state.totalProducts) * 100 : 0,
    isComplete: state.loadedProducts >= state.totalProducts && state.totalProducts > 0,
    formattedTimeRemaining: state.estimatedTimeRemaining > 0
      ? `${Math.ceil(state.estimatedTimeRemaining / 60)}m ${Math.ceil(state.estimatedTimeRemaining % 60)}s`
      : null
  };

  return (
    <DashboardLoaderContext.Provider value={contextValue}>
      {children}
    </DashboardLoaderContext.Provider>
  );
}

export default DashboardLoaderContext;