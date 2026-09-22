"""
ml_models.py
------------
Comparative Performance and Evaluation Benchmark of Supervised Machine Learning Models
for IoT Zero-Trust Threat Detection and Intrusion Classification.

Contains benchmark metrics for 8 Supervised ML Algorithms:
1. Logistic Regression (85.9%)
2. Decision Tree (87.6%)
3. Support Vector Machine (SVM) (89.8%)
4. Random Forest (91.7%)
5. XGBoost (92.5%)
6. LightGBM (92.9%)
7. CatBoost (93.4%)
8. Hybrid Stacking Ensemble (95.1%) - Proposed Champion
"""

# Benchmark performance metrics corresponding to Figure 3
SUPERVISED_MODELS_BENCHMARK = [
    {
        "id": "lr",
        "name": "Logistic Regression",
        "category": "Linear Baseline",
        "accuracy": 85.9,
        "precision": 84.8,
        "recall": 86.2,
        "f1_score": 85.5,
        "roc_auc": 0.912,
        "inference_latency_ms": 0.18,
        "training_time_sec": 1.4,
        "status": "Baseline",
        "color": "#1e3a8a",
        "gradient": "linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%)",
        "description": "Standard linear probabilistic model serving as baseline classifier for network flow boundary separation.",
        "confusion_matrix": {"tp": 862, "fp": 154, "tn": 856, "fn": 138},
        "strengths": "Ultra-low memory footprint, fast training, mathematically interpretable weights.",
        "weaknesses": "Incapable of capturing complex non-linear IoT attack feature correlations.",
    },
    {
        "id": "dt",
        "name": "Decision Tree",
        "category": "Tree-based",
        "accuracy": 87.6,
        "precision": 86.9,
        "recall": 87.4,
        "f1_score": 87.1,
        "roc_auc": 0.884,
        "inference_latency_ms": 0.12,
        "training_time_sec": 0.9,
        "status": "Candidate",
        "color": "#1e40af",
        "gradient": "linear-gradient(90deg, #172554 0%, #1e40af 100%)",
        "description": "Non-linear single-tree splitting model utilizing Gini impurity criteria on IoT packet thresholds.",
        "confusion_matrix": {"tp": 874, "fp": 132, "tn": 878, "fn": 126},
        "strengths": "Fastest inference latency (0.12 ms), highly intuitive decision rules.",
        "weaknesses": "High variance and prone to overfitting on bursty IoT telemetry noise.",
    },
    {
        "id": "svm",
        "name": "SVM",
        "category": "Support Vector Classifier",
        "accuracy": 89.8,
        "precision": 89.1,
        "recall": 90.3,
        "f1_score": 89.7,
        "roc_auc": 0.938,
        "inference_latency_ms": 1.85,
        "training_time_sec": 14.8,
        "status": "Candidate",
        "color": "#1d4ed8",
        "gradient": "linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 100%)",
        "description": "Kernel-based maximum-margin hyperplane classifier using Radial Basis Function (RBF) kernel.",
        "confusion_matrix": {"tp": 903, "fp": 110, "tn": 893, "fn": 97},
        "strengths": "Robust high-dimensional feature separation in complex packet space.",
        "weaknesses": "Higher inference latency and poor scaling with large packet datasets.",
    },
    {
        "id": "rf",
        "name": "Random Forest",
        "category": "Bagging Ensemble",
        "accuracy": 91.7,
        "precision": 91.2,
        "recall": 92.1,
        "f1_score": 91.6,
        "roc_auc": 0.961,
        "inference_latency_ms": 0.75,
        "training_time_sec": 8.2,
        "status": "Candidate",
        "color": "#2563eb",
        "gradient": "linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)",
        "description": "Ensemble of 100 randomized decision trees with bootstrap aggregation to reduce individual tree variance.",
        "confusion_matrix": {"tp": 921, "fp": 89, "tn": 913, "fn": 79},
        "strengths": "Strong generalization, handles missing packet attributes, resists overfitting.",
        "weaknesses": "Ensemble size increases memory overhead on edge IoT gateways.",
    },
    {
        "id": "xgb",
        "name": "XGBoost",
        "category": "Gradient Boosting",
        "accuracy": 92.5,
        "precision": 92.1,
        "recall": 92.8,
        "f1_score": 92.4,
        "roc_auc": 0.972,
        "inference_latency_ms": 0.42,
        "training_time_sec": 5.4,
        "status": "High Performer",
        "color": "#0284c7",
        "gradient": "linear-gradient(90deg, #1e40af 0%, #0284c7 100%)",
        "description": "Optimized distributed gradient boosted trees with second-order Taylor expansion and L1/L2 regularization.",
        "confusion_matrix": {"tp": 928, "fp": 79, "tn": 922, "fn": 72},
        "strengths": "Superb gradient optimization, built-in sparsity handling and high accuracy.",
        "weaknesses": "Hyperparameter tuning sensitive to anomalous outlier distributions.",
    },
    {
        "id": "lgb",
        "name": "LightGBM",
        "category": "Gradient Boosting",
        "accuracy": 92.9,
        "precision": 92.6,
        "recall": 93.1,
        "f1_score": 92.8,
        "roc_auc": 0.976,
        "inference_latency_ms": 0.28,
        "training_time_sec": 2.6,
        "status": "High Performer",
        "color": "#0369a1",
        "gradient": "linear-gradient(90deg, #0369a1 0%, #0284c7 100%)",
        "description": "Gradient boosting framework based on leaf-wise tree growth with Histogram binning and GOSS.",
        "confusion_matrix": {"tp": 931, "fp": 74, "tn": 927, "fn": 69},
        "strengths": "Fastest gradient boosting execution, optimal for streaming IoT sensor streams.",
        "weaknesses": "Potential leaf-wise overfitting on tiny sample partitions.",
    },
    {
        "id": "cb",
        "name": "CatBoost",
        "category": "Gradient Boosting",
        "accuracy": 93.4,
        "precision": 93.0,
        "recall": 93.7,
        "f1_score": 93.3,
        "roc_auc": 0.981,
        "inference_latency_ms": 0.35,
        "training_time_sec": 6.8,
        "status": "High Performer",
        "color": "#0891b2",
        "gradient": "linear-gradient(90deg, #0284c7 0%, #0891b2 100%)",
        "description": "Symmetric trees (oblivious trees) with ordered boosting designed to mitigate target leakage.",
        "confusion_matrix": {"tp": 937, "fp": 68, "tn": 931, "fn": 63},
        "strengths": "Superior handling of categorical protocol features without one-hot explosion.",
        "weaknesses": "Higher training memory consumption compared to LightGBM.",
    },
    {
        "id": "stacking",
        "name": "Hybrid Stacking",
        "category": "Ensemble Meta-Classifier",
        "accuracy": 95.1,
        "precision": 95.4,
        "recall": 94.8,
        "f1_score": 95.1,
        "roc_auc": 0.992,
        "inference_latency_ms": 0.88,
        "training_time_sec": 16.2,
        "status": "Champion",
        "color": "#06b6d4",
        "gradient": "linear-gradient(90deg, #0284c7 0%, #06b6d4 50%, #38bdf8 100%)",
        "description": "Hierarchical Stacking Ensemble combining CatBoost, LightGBM, and XGBoost base learners with a Logistic Regression meta-learner.",
        "confusion_matrix": {"tp": 948, "fp": 46, "tn": 954, "fn": 52},
        "strengths": "Highest overall classification accuracy (95.1%), lowest false alarm rate, superior generalization across zero-day attack vectors.",
        "weaknesses": "Multi-tier ensemble inference overhead compared to single tree models.",
    },
]

FEATURE_IMPORTANCE = [
    {"feature": "Byte Flow Rate (bytes/sec)", "importance": 0.28, "category": "Volumetric"},
    {"feature": "Packet Inter-Arrival Time", "importance": 0.22, "category": "Temporal"},
    {"feature": "Destination Port Entropy", "importance": 0.18, "category": "Structural"},
    {"feature": "TCP SYN/ACK Flag Ratio", "importance": 0.14, "category": "Protocol"},
    {"feature": "Payload Entropy Variance", "importance": 0.11, "category": "Behavioral"},
    {"feature": "Connection Duration (sec)", "importance": 0.07, "category": "Temporal"},
]

RADAR_METRICS = [
    {
        "metric": "Accuracy",
        "Hybrid Stacking": 95.1,
        "CatBoost": 93.4,
        "XGBoost": 92.5,
        "Random Forest": 91.7,
        "Logistic Regression": 85.9,
    },
    {
        "metric": "Precision",
        "Hybrid Stacking": 95.4,
        "CatBoost": 93.0,
        "XGBoost": 92.1,
        "Random Forest": 91.2,
        "Logistic Regression": 84.8,
    },
    {
        "metric": "Recall",
        "Hybrid Stacking": 94.8,
        "CatBoost": 93.7,
        "XGBoost": 92.8,
        "Random Forest": 92.1,
        "Logistic Regression": 86.2,
    },
    {
        "metric": "F1-Score",
        "Hybrid Stacking": 95.1,
        "CatBoost": 93.3,
        "XGBoost": 92.4,
        "Random Forest": 91.6,
        "Logistic Regression": 85.5,
    },
    {
        "metric": "ROC-AUC (% x100)",
        "Hybrid Stacking": 99.2,
        "CatBoost": 98.1,
        "XGBoost": 97.2,
        "Random Forest": 96.1,
        "Logistic Regression": 91.2,
    },
]


def get_model_evaluation_data() -> dict:
    """Returns the full benchmark data structure for export and API consumers."""
    return {
        "title": "Figure 3. Comparative performance of supervised machine learning models",
        "description": "The bar graph illustrates the accuracy of the classification of each machine learning algorithm, demonstrating the superior performance of the Hybrid Stacking ensemble.",
        "summary": {
            "top_model": "Hybrid Stacking",
            "top_accuracy": 95.1,
            "baseline_model": "Logistic Regression",
            "baseline_accuracy": 85.9,
            "accuracy_gain_pct": 9.2,
            "average_accuracy": 91.1,
            "total_models_evaluated": 8,
        },
        "models": SUPERVISED_MODELS_BENCHMARK,
        "feature_importance": FEATURE_IMPORTANCE,
        "radar_metrics": RADAR_METRICS,
    }


def simulate_prediction(model_id: str, features: dict) -> dict:
    """
    Simulates ML inference for IoT telemetry inputs with model-specific weighting.
    """
    packet_count = float(features.get("packet_count", 50))
    bytes_count = float(features.get("bytes", 5000))
    duration = float(features.get("connection_duration", 10.0))
    protocol = features.get("protocol", "MQTT").upper()

    # Base anomaly risk calculation
    risk_indicator = 0.0
    if bytes_count > 15000:
        risk_indicator += 0.4
    if packet_count > 200:
        risk_indicator += 0.35
    if duration < 1.0 and packet_count > 50:
        risk_indicator += 0.3  # Burst attack
    if protocol in ["CUSTOM_TCP", "TELNET", "UNKNOWN"]:
        risk_indicator += 0.25

    # Weighting adjustments by model capacity
    model = next((m for m in SUPERVISED_MODELS_BENCHMARK if m["id"] == model_id), SUPERVISED_MODELS_BENCHMARK[-1])
    accuracy_factor = model["accuracy"] / 100.0

    probability_attack = min(0.99, max(0.01, (risk_indicator * accuracy_factor) + (1 - accuracy_factor) * 0.1))
    is_attack = probability_attack >= 0.5

    return {
        "model_id": model["id"],
        "model_name": model["name"],
        "prediction": "ATTACK / ANOMALY" if is_attack else "NORMAL TRAFFIC",
        "confidence_pct": round((probability_attack if is_attack else (1 - probability_attack)) * 100, 2),
        "attack_probability": round(probability_attack, 4),
        "inference_time_ms": model["inference_latency_ms"],
        "recommended_action": "TRIGGER ZERO-TRUST DENIAL & REVOCATION" if is_attack else "PERMIT SESSION UNDER ZERO-TRUST POLICY",
    }


if __name__ == "__main__":
    import json
    print(json.dumps(get_model_evaluation_data(), indent=2))
