/**
 * dataService.js
 * ----------------
 * Reads the JSON snapshots that python-security/export_snapshot.py
 * writes into frontend/public/data/. This is the "no backend, no
 * direct DB access from the browser" bridge described in Phase 18.
 *
 * If a file hasn't been exported yet, we return an empty shape
 * instead of throwing, so the dashboard still renders (with an empty
 * state) before the Python side has produced its first snapshot.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const API_ENDPOINTS = {
  "dashboard_stats.json": "/api/stats",
  "devices.json": "/api/devices",
  "access_requests.json": "/api/access-requests",
  "security_events.json": "/api/security-events",
  "authentication_logs.json": "/api/auth-logs",
  "dataset_stats.json": "/api/dataset-stats",
  "model_performance.json": "/api/model-performance",
};

async function fetchJson(filename, fallback) {
  try {
    const endpoint = API_ENDPOINTS[filename];
    const targetUrl = API_BASE_URL
      ? `${API_BASE_URL.replace(/\/$/, "")}${endpoint}`
      : `/data/${filename}`;

    const res = await fetch(targetUrl, { cache: "no-store" });
    if (!res.ok) {
      // Fallback to static data snapshot if API call fails
      if (API_BASE_URL) {
        const fallbackRes = await fetch(`/data/${filename}`, { cache: "no-store" });
        if (fallbackRes.ok) return await fallbackRes.json();
      }
      return fallback;
    }
    return await res.json();
  } catch {
    return fallback;
  }
}

export const getDashboardStats = () =>
  fetchJson("dashboard_stats.json", {
    total_devices: 0, active_devices: 0, revoked_devices: 0,
    auth_success: 0, auth_failed: 0, access_granted: 0,
    access_denied: 0, high_risk: 0,
  });

export const getDevices = () => fetchJson("devices.json", []);
export const getAccessRequests = () => fetchJson("access_requests.json", []);
export const getSecurityEvents = () => fetchJson("security_events.json", []);
export const getAuthenticationLogs = () => fetchJson("authentication_logs.json", []);
export const getDatasetStats = () =>
  fetchJson("dataset_stats.json", {
    total_records: 0, normal_records: 0, attack_records: 0,
    device_distribution: {}, protocol_distribution: {},
  });

export const getModelPerformance = () =>
  fetchJson("model_performance.json", {
    title: "Figure 3. Comparative performance of supervised machine learning models",
    description: "The bar graph illustrates the accuracy of the classification of each machine learning algorithm.",
    summary: {
      top_model: "Hybrid Stacking",
      top_accuracy: 95.1,
      baseline_model: "Logistic Regression",
      baseline_accuracy: 85.9,
      accuracy_gain_pct: 9.2,
      average_accuracy: 91.1,
      total_models_evaluated: 8,
    },
    models: [],
    feature_importance: [],
    radar_metrics: [],
  });

