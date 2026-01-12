/**
 * API Configuration and Helper Functions
 * 
 * This file contains the API base URL and helper functions for making requests.
 * Configure your backend URL via environment variables.
 */

// API Base URL - configure via environment variable
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// N8N Webhook URL for reprocessing
export const N8N_REPROCESS_WEBHOOK_URL = import.meta.env.VITE_N8N_REPROCESS_WEBHOOK_URL || '';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Get auth token from storage
  const session = localStorage.getItem('bvg_session');
  const token = session ? JSON.parse(session).token : null;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger order reprocess via N8N webhook
 */
export async function triggerReprocess(orderCode: string, messageId?: string): Promise<boolean> {
  if (!N8N_REPROCESS_WEBHOOK_URL) {
    console.warn('N8N_REPROCESS_WEBHOOK_URL not configured');
    return false;
  }

  try {
    const response = await fetch(N8N_REPROCESS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderCode, messageId }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to trigger reprocess:', error);
    return false;
  }
}

/**
 * Check API health
 */
export async function checkApiHealth(): Promise<{ status: string; timestamp: string; version: string }> {
  return apiRequest('/health');
}

/**
 * Check API readiness
 */
export async function checkApiReady(): Promise<{ ready: boolean; database: boolean; schema: boolean }> {
  return apiRequest('/ready');
}
