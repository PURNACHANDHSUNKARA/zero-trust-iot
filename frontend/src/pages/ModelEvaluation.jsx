import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  CartesianGrid, LabelList
} from "recharts";
import { Panel, EmptyState } from "../components/Panel.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import { getModelPerformance } from "../services/dataService.js";

// Custom horizontal bar with gradient & glow
const MODEL_COLORS = {
  "Logistic Regression": "#1e3a8a",
  "Decision Tree": "#1e40af",
  "SVM": "#1d4ed8",
  "Random Forest": "#2563eb",
  "XGBoost": "#0284c7",
  "LightGBM": "#0369a1",
  "CatBoost": "#0891b2",
  "Hybrid Stacking": "#06b6d4",
};

export default function ModelEvaluation() {
  const [data, setData] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState("stacking");
  const [comparisonMode, setComparisonMode] = useState("all");
  
  // Simulator State
  const [simForm, setSimForm] = useState({
    modelId: "stacking",
    protocol: "MQTT",
    packetCount: 120,
    byteVolume: 8500,
    duration: 5.2,
    portEntropy: 0.45,
  });
  const [simResult, setSimResult] = useState(null);

  useEffect(() => {
    getModelPerformance().then((res) => {
      setData(res);
      if (res.models && res.models.length > 0) {
        setSelectedModelId(res.models[res.models.length - 1].id);
      }
    });
  }, []);

  // Filtered / Ordered Models for Figure 3 (Top to bottom: Logistic Regression -> Hybrid Stacking)
  const chartData = useMemo(() => {
    if (!data?.models) return [];
    return [...data.models];
  }, [data]);

  const selectedModel = useMemo(() => {
    if (!data?.models) return null;
    return data.models.find((m) => m.id === selectedModelId) || data.models[data.models.length - 1];
  }, [data, selectedModelId]);

  // Run live simulation
  function handleSimulate(e) {
    if (e) e.preventDefault();
    const model = data?.models?.find((m) => m.id === simForm.modelId) || selectedModel;
    if (!model) return;

    const packets = Number(simForm.packetCount);
    const bytes = Number(simForm.byteVolume);
    const dur = Number(simForm.duration);
    const entropy = Number(simForm.portEntropy);
    const proto = simForm.protocol;

    // Calculate synthetic anomaly risk weight
    let riskFactor = 0.0;
    if (bytes > 12000) riskFactor += 0.35;
    if (packets > 180) riskFactor += 0.30;
    if (dur < 1.0 && packets > 50) riskFactor += 0.25; // Burst attack
    if (entropy > 0.7) riskFactor += 0.25; // Port scanning
    if (proto === "TELNET" || proto === "RAW_TCP") riskFactor += 0.20;

    const acc = model.accuracy / 100;
    const probability = Math.min(0.98, Math.max(0.02, (riskFactor * acc) + ((1 - acc) * 0.1)));
    const isAnomaly = probability >= 0.5;

    setSimResult({
      modelName: model.name,
      prediction: isAnomaly ? "ATTACK / ANOMALY" : "NORMAL TRAFFIC",
      isAnomaly,
      confidence: ((isAnomaly ? probability : (1 - probability)) * 100).toFixed(1),
      probability: (probability * 100).toFixed(1),
      latency: model.inference_latency_ms,
      ztDecision: isAnomaly ? "DENY (BLOCK & LOG TO AUDIT)" : "ALLOW (VALIDATED SESSION)",
      riskScore: Math.round(probability * 100),
    });
  }

  // Initial simulation run on load
  useEffect(() => {
    if (data?.models?.length && !simResult) {
      handleSimulate();
    }
  }, [data]);

  if (!data) return null;

  const summary = data.summary || {
    top_model: "Hybrid Stacking",
    top_accuracy: 95.1,
    baseline_model: "Logistic Regression",
    baseline_accuracy: 85.9,
    accuracy_gain_pct: 9.2,
    average_accuracy: 91.1,
  };

  return (
    <div className="model-eval-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <div className="model-badge-row">
            <span className="research-chip">Figure 3 Analysis</span>
            <span className="research-chip-accent">Supervised ML Benchmark</span>
          </div>
          <h1 className="page-title">Comparative Performance of Supervised ML Models</h1>
          <p className="page-subtitle">
            Rigorous classification evaluation of 8 supervised machine learning algorithms on IoT cybersecurity telemetry (CICIoT2023 / ToN_IoT datasets) demonstrating the optimal accuracy of the Hybrid Stacking ensemble.
          </p>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid">
        <StatCard
          label="Proposed Champion Model"
          value={`${summary.top_model} (${summary.top_accuracy}%)`}
          tone="allow"
          trend={<span>Highest overall intrusion detection accuracy</span>}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
          )}
        />
        <StatCard
          label="Accuracy Gain (vs Baseline)"
          value={`+${summary.accuracy_gain_pct}%`}
          tone="brand"
          trend={<span>Lift over Logistic Regression (85.9%)</span>}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          )}
        />
        <StatCard
          label="Mean Classifier Accuracy"
          value={`${summary.average_accuracy}%`}
          tone="purple"
          trend={<span>Averaged across 8 supervised models</span>}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          )}
        />
        <StatCard
          label="Benchmarked Algorithms"
          value="8 Models"
          tone="info"
          trend={<span>Linear, Trees, SVM, Boosting & Stacking</span>}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          )}
        />
      </div>

      {/* Main Research Figure 3 Section */}
      <Panel
        title="Figure 3. Comparative performance of supervised machine learning models"
        badge="Horizontal Accuracy Benchmark (%)"
      >
        <div className="figure-paper-card">
          <div className="figure-chart-wrapper">
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 60, left: 40, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[80, 96]}
                  ticks={[80, 82, 84, 86, 88, 90, 92, 94, 96]}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={true}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#f1f5f9"
                  fontSize={13}
                  tickLine={false}
                  width={140}
                  tick={{ fill: "#e2e8f0", fontWeight: 500 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(56, 189, 248, 0.08)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="custom-chart-tooltip">
                          <div className="tooltip-title">{item.name}</div>
                          <div className="tooltip-row">
                            <span>Accuracy:</span>
                            <strong>{item.accuracy}%</strong>
                          </div>
                          <div className="tooltip-row">
                            <span>Precision:</span>
                            <span>{item.precision}%</span>
                          </div>
                          <div className="tooltip-row">
                            <span>Recall:</span>
                            <span>{item.recall}%</span>
                          </div>
                          <div className="tooltip-row">
                            <span>F1-Score:</span>
                            <span>{item.f1_score}%</span>
                          </div>
                          <div className="tooltip-row">
                            <span>Latency:</span>
                            <span>{item.inference_latency_ms} ms</span>
                          </div>
                          <div className="tooltip-tag">{item.category}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="accuracy"
                  name="Accuracy (%)"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                  onClick={(entry) => setSelectedModelId(entry.id)}
                  style={{ cursor: "pointer" }}
                >
                  <LabelList
                    dataKey="accuracy"
                    position="right"
                    formatter={(val) => `${val}%`}
                    fill="#f8fafc"
                    style={{ fontWeight: 600, fontSize: "12px" }}
                  />
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.id}`}
                      fill={entry.color || MODEL_COLORS[entry.name] || "#0284c7"}
                      stroke={selectedModelId === entry.id ? "#ffffff" : "none"}
                      strokeWidth={selectedModelId === entry.id ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="figure-caption">
            <strong>Figure 3. Comparative performance of supervised machine learning models.</strong>
            <p>
              The bar graph illustrates the accuracy of the classification of each machine learning algorithm.
              As seen from the statistics, standard single linear models such as Logistic Regression achieve a baseline accuracy of 85.9%,
              while gradient boosting frameworks (XGBoost 92.5%, LightGBM 92.9%, CatBoost 93.4%) yield superior non-linear boundary resolution.
              The proposed <strong>Hybrid Stacking</strong> meta-ensemble achieves the highest accuracy of <strong>95.1%</strong> by synthesizing diverse base learner decision planes into a robust zero-trust threat detection layer.
            </p>
          </div>
        </div>
      </Panel>

      {/* Model Deep-Dive & Multi-Metric Radar */}
      <div className="charts-grid-2">
        {/* Model Details Inspector */}
        <Panel
          title={`Algorithm Profile: ${selectedModel?.name}`}
          badge={selectedModel?.status || "Candidate"}
        >
          {selectedModel ? (
            <div className="model-profile-card">
              <div className="model-profile-header">
                <div>
                  <h3 className="model-profile-name">{selectedModel.name}</h3>
                  <span className="model-profile-cat">{selectedModel.category}</span>
                </div>
                <div className="model-profile-acc">
                  <div className="acc-val">{selectedModel.accuracy}%</div>
                  <div className="acc-lbl">Test Accuracy</div>
                </div>
              </div>

              <p className="model-profile-desc">{selectedModel.description}</p>

              {/* Metrics Grid */}
              <div className="model-metrics-matrix">
                <div className="metric-box">
                  <span className="m-lbl">Precision</span>
                  <strong className="m-val">{selectedModel.precision}%</strong>
                </div>
                <div className="metric-box">
                  <span className="m-lbl">Recall</span>
                  <strong className="m-val">{selectedModel.recall}%</strong>
                </div>
                <div className="metric-box">
                  <span className="m-lbl">F1-Score</span>
                  <strong className="m-val">{selectedModel.f1_score}%</strong>
                </div>
                <div className="metric-box">
                  <span className="m-lbl">ROC-AUC</span>
                  <strong className="m-val">{selectedModel.roc_auc}</strong>
                </div>
                <div className="metric-box">
                  <span className="m-lbl">Inference Time</span>
                  <strong className="m-val">{selectedModel.inference_latency_ms} ms</strong>
                </div>
                <div className="metric-box">
                  <span className="m-lbl">Train Time</span>
                  <strong className="m-val">{selectedModel.training_time_sec} s</strong>
                </div>
              </div>

              {/* Confusion Matrix Visual */}
              <div className="confusion-matrix-wrapper">
                <div className="cm-title">Validation Confusion Matrix (2,000 Sample Cohort)</div>
                <div className="cm-grid">
                  <div className="cm-cell cm-tp">
                    <span className="cm-lbl">True Positive (TP)</span>
                    <span className="cm-num">{selectedModel.confusion_matrix.tp}</span>
                  </div>
                  <div className="cm-cell cm-fp">
                    <span className="cm-lbl">False Positive (FP)</span>
                    <span className="cm-num">{selectedModel.confusion_matrix.fp}</span>
                  </div>
                  <div className="cm-cell cm-fn">
                    <span className="cm-lbl">False Negative (FN)</span>
                    <span className="cm-num">{selectedModel.confusion_matrix.fn}</span>
                  </div>
                  <div className="cm-cell cm-tn">
                    <span className="cm-lbl">True Negative (TN)</span>
                    <span className="cm-num">{selectedModel.confusion_matrix.tn}</span>
                  </div>
                </div>
              </div>

              {/* Architecture Details */}
              <div className="model-strengths-box">
                <div><strong>Key Strengths:</strong> {selectedModel.strengths}</div>
                <div style={{ marginTop: 6 }}><strong>Operational Limitation:</strong> {selectedModel.weaknesses}</div>
              </div>
            </div>
          ) : (
            <EmptyState>Select a model to view details.</EmptyState>
          )}
        </Panel>

        {/* Multi-Metric Radar Comparison */}
        <Panel title="Multi-Metric Performance Radar" badge="Top 5 Supervised Models">
          <div className="chart-container" style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data.radar_metrics || []}>
                <PolarGrid stroke="rgba(255, 255, 255, 0.12)" />
                <PolarAngleAxis dataKey="metric" stroke="#cbd5e1" fontSize={12} />
                <PolarRadiusAxis angle={30} domain={[80, 100]} stroke="#64748b" fontSize={10} />
                <Radar name="Hybrid Stacking" dataKey="Hybrid Stacking" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
                <Radar name="CatBoost" dataKey="CatBoost" stroke="#0891b2" fill="#0891b2" fillOpacity={0.2} />
                <Radar name="XGBoost" dataKey="XGBoost" stroke="#0284c7" fill="#0284c7" fillOpacity={0.15} />
                <Radar name="Random Forest" dataKey="Random Forest" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} />
                <Radar name="Logistic Regression" dataKey="Logistic Regression" stroke="#64748b" fill="#64748b" fillOpacity={0.05} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Interactive Live Threat Prediction Simulator */}
      <Panel
        title="Interactive Zero-Trust ML Threat Classifier Simulator"
        badge="Live Policy Sandbox"
      >
        <div className="simulator-grid">
          {/* Simulator Inputs Form */}
          <form className="sim-form" onSubmit={handleSimulate}>
            <div className="sim-form-row">
              <label>
                Evaluation Classifier Model
                <select
                  value={simForm.modelId}
                  onChange={(e) => setSimForm({ ...simForm, modelId: e.target.value })}
                >
                  {data.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.accuracy}%)
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Network Protocol
                <select
                  value={simForm.protocol}
                  onChange={(e) => setSimForm({ ...simForm, protocol: e.target.value })}
                >
                  <option value="MQTT">MQTT (Standard IoT)</option>
                  <option value="CoAP">CoAP (Constrained)</option>
                  <option value="HTTP">HTTP/REST</option>
                  <option value="RAW_TCP">RAW TCP Stream</option>
                  <option value="TELNET">TELNET (Legacy Unencrypted)</option>
                </select>
              </label>
            </div>

            <div className="sim-form-row">
              <label>
                Packet Count: <strong>{simForm.packetCount} pkts</strong>
                <input
                  type="range"
                  min="10"
                  max="400"
                  value={simForm.packetCount}
                  onChange={(e) => setSimForm({ ...simForm, packetCount: e.target.value })}
                />
              </label>

              <label>
                Byte Volume: <strong>{(simForm.byteVolume / 1024).toFixed(1)} KB</strong>
                <input
                  type="range"
                  min="500"
                  max="30000"
                  step="500"
                  value={simForm.byteVolume}
                  onChange={(e) => setSimForm({ ...simForm, byteVolume: e.target.value })}
                />
              </label>
            </div>

            <div className="sim-form-row">
              <label>
                Connection Duration: <strong>{simForm.duration}s</strong>
                <input
                  type="range"
                  min="0.2"
                  max="30"
                  step="0.2"
                  value={simForm.duration}
                  onChange={(e) => setSimForm({ ...simForm, duration: e.target.value })}
                />
              </label>

              <label>
                Port Entropy Factor: <strong>{simForm.portEntropy}</strong>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={simForm.portEntropy}
                  onChange={(e) => setSimForm({ ...simForm, portEntropy: e.target.value })}
                />
              </label>
            </div>

            <button className="btn-primary" type="submit" style={{ marginTop: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Execute ML Classifier Inference
            </button>
          </form>

          {/* Simulator Output Display */}
          {simResult && (
            <div className={`sim-output-card ${simResult.isAnomaly ? "anomaly" : "normal"}`}>
              <div className="sim-output-header">
                <span className="sim-evaluated-by">Evaluated by: {simResult.modelName}</span>
                <Badge tone={simResult.isAnomaly ? "deny" : "allow"}>
                  {simResult.isAnomaly ? "THREAT DETECTED" : "HEALTHY TELEMETRY"}
                </Badge>
              </div>

              <div className="sim-prediction-title">
                {simResult.prediction}
              </div>

              <div className="sim-confidence-meter">
                <div className="meter-label">
                  <span>Confidence Level</span>
                  <strong>{simResult.confidence}%</strong>
                </div>
                <div className="meter-bar">
                  <div
                    className={`meter-fill ${simResult.isAnomaly ? "deny" : "allow"}`}
                    style={{ width: `${simResult.confidence}%` }}
                  />
                </div>
              </div>

              <div className="sim-decision-box">
                <div className="decision-row">
                  <span>Zero-Trust Policy Reaction:</span>
                  <strong>{simResult.ztDecision}</strong>
                </div>
                <div className="decision-row">
                  <span>Anomaly Risk Weight:</span>
                  <span>{simResult.riskScore} / 100</span>
                </div>
                <div className="decision-row">
                  <span>Model Inference Latency:</span>
                  <span>{simResult.latency} ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Feature Importance & Comparison Table */}
      <div className="charts-grid-2">
        <Panel title="IoT Cyber Feature Importance" badge="Information Gain Weight">
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.feature_importance || []}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
              >
                <XAxis type="number" domain={[0, 0.35]} stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="feature" stroke="#94a3b8" fontSize={11} width={130} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="importance" name="Importance Score" fill="#38bdf8" radius={[0, 4, 4, 0]}>
                  {data.feature_importance?.map((entry, index) => (
                    <Cell
                      key={`feat-${index}`}
                      fill={index === 0 ? "#06b6d4" : index === 1 ? "#0284c7" : "#2563eb"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Hybrid Stacking Architecture" badge="Meta-Ensemble Synthesis">
          <div className="stacking-arch-card">
            <div className="stacking-step">
              <div className="step-badge">Tier 1: Base Learners</div>
              <div className="step-models">
                <div className="pill-model">CatBoost (93.4%)</div>
                <div className="pill-model">LightGBM (92.9%)</div>
                <div className="pill-model">XGBoost (92.5%)</div>
              </div>
              <p className="step-desc">
                High-capacity gradient boosting decision trees extract orthogonal decision representations from continuous and categorical IoT packet headers.
              </p>
            </div>

            <div className="stacking-arrow">↓ Meta-Feature Probability Vector</div>

            <div className="stacking-step champion">
              <div className="step-badge">Tier 2: Meta-Learner</div>
              <div className="step-models">
                <div className="pill-model meta">Logistic Regression Regularized Meta-Classifier</div>
              </div>
              <p className="step-desc">
                Synthesizes base classifier confidence distributions to produce an optimal calibrated probability with <strong>95.1% test accuracy</strong> and minimal false positive rate.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Comprehensive Benchmark Table */}
      <Panel title="Supervised Machine Learning Comparison Matrix" badge="8 Algorithms">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Model Name</th>
                <th>Category</th>
                <th>Accuracy</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>ROC-AUC</th>
                <th>Latency</th>
                <th>Train Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr
                  key={m.id}
                  className={selectedModelId === m.id ? "table-row-active" : ""}
                  onClick={() => setSelectedModelId(m.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <strong>{m.name}</strong>
                  </td>
                  <td className="muted">{m.category}</td>
                  <td>
                    <div className="table-acc-cell">
                      <span className="acc-text">{m.accuracy}%</span>
                      <div className="table-bar-bg">
                        <div
                          className="table-bar-fill"
                          style={{
                            width: `${Math.max(0, ((m.accuracy - 80) / 16) * 100)}%`,
                            backgroundColor: m.color || "#0284c7",
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>{m.precision}%</td>
                  <td>{m.recall}%</td>
                  <td>{m.f1_score}%</td>
                  <td>{m.roc_auc}</td>
                  <td>{m.inference_latency_ms} ms</td>
                  <td>{m.training_time_sec} s</td>
                  <td>
                    <Badge
                      tone={
                        m.status === "Champion"
                          ? "allow"
                          : m.status === "High Performer"
                          ? "brand"
                          : m.status === "Baseline"
                          ? "deny"
                          : "warn"
                      }
                    >
                      {m.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
