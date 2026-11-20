export type ProvenanceClass =
  | 'THIRD_PARTY_REPORTED'
  | 'SIMULATED'
  | 'ML_PREDICTED_SYNTHETIC'
  | 'CONTROLLER_DECISION'
  | 'DERIVED_ESTIMATE'
  | 'CACHED';

export const PROVENANCE_LABELS: Record<ProvenanceClass, string> = {
  THIRD_PARTY_REPORTED: 'Third-Party Reported',
  SIMULATED: 'Simulated Corridor',
  ML_PREDICTED_SYNTHETIC: 'ML Predicted (Synthetic)',
  CONTROLLER_DECISION: 'Controller Decision',
  DERIVED_ESTIMATE: 'Derived Estimate',
  CACHED: 'Cached Snapshot',
};

export type RiskLevel = 'CLEAR' | 'CAUTION' | 'DANGER';

export type WeatherMode = 'clear' | 'rain' | 'thunderstorm' | 'snow';

export type PrimaryView =
  | 'overview'
  | 'monitor'
  | 'conflicts'
  | 'dispatch'
  | 'twin';

export type SecondaryToolTab =
  | 'timetable'
  | 'scenarios'
  | 'history'
  | 'models'
  | 'health';

export type MLModelKey = 'xgboost' | 'catboost' | 'random_forest';

export interface CorridorTrain {
  id: string;
  trainNo: string;
  name: string;
  category: 'Rajdhani' | 'Vande Bharat' | 'Shatabdi' | 'Freight';
  origin: string;
  destination: string;
  depTime: string;
  arrTime: string;
  line: number; // 0..3 -> X in {-21, -7, +7, +21}
  direction: 1 | -1;
  positionM: number; // 0..12000 m
  lengthM: number;
  speedKmh: number;
  targetSpeedKmh: number;
  scheduledSpeedKmh: number;
  priority: number; // 1..5
  leaderId: string | null;
  blockIndex: number;
  status: 'ON_TIME' | 'DELAYED' | 'HOLDING' | 'CONFLICT_RISK' | 'STOPPED';
  delayMin: number;
  holdDurationS: number;
  signalAspect: 'GREEN' | 'DOUBLE_YELLOW' | 'YELLOW' | 'RED';
  brakeMode: 'CRUISE' | 'NORMAL' | 'PREDICTIVE' | 'DANGER' | 'EMERGENCY';
  riskLevel: RiskLevel;
  netGapM: number;
  ttcS: number;
  closingVelocityMps: number;
  distStationThroatM: number;
  riskProbability: number;
  safeGapM: number;
  brakingDistanceM: number;
  brakingAwareTtcS: number;
  adaptiveResolution: 'FINE' | 'COARSE';
  provenance: ProvenanceClass;
}

export interface FeatureVector10 {
  leader_speed_kmh: number;
  follower_speed_kmh: number;
  closing_velocity_mps: number;
  net_gap_m: number;
  ttc_s: number;
  distance_station_throat_m: number;
  weather_safety_multiplier: number;
  priority: number;
  block_occupancy: number;
  hold_duration_s: number;
}

export interface ConflictIncident {
  id: string;
  followerId: string;
  followerTrainNo: string;
  followerName: string;
  leaderId: string;
  leaderTrainNo: string;
  leaderName: string;
  line: number;
  trackLabel: string;
  blockIndex: number;
  severity: RiskLevel;
  ttcS: number;
  brakingAwareTtcS: number;
  netGapM: number;
  safeGapM: number;
  closingVelocityMps: number;
  weather: WeatherMode;
  weatherMultiplier: number;
  modelRiskClass: RiskLevel;
  modelProbability: number;
  confidence: number;
  explanationAvailable: boolean;
  reviewStatus: 'PENDING' | 'UNDER_REVIEW' | 'MITIGATED' | 'ACCEPTED' | 'REJECTED';
  detectedAt: string;
  features: FeatureVector10;
  counterfactualNoAI: {
    projectedMinGapM: number;
    projectedCollision: boolean;
    projectedDelayMin: number;
    summary: string;
  };
  plainSummary: string;
  topFactors: Array<{
    feature: string;
    label: string;
    valueText: string;
    direction: 'INCREASES_RISK' | 'REDUCES_RISK';
    impact: number;
  }>;
  provenance: ProvenanceClass;
}

export interface FeatureAttribution {
  feature: string;
  label: string;
  value: number;
  displayValue: string;
  contribution: number; // positive pushes toward DANGER/CAUTION, negative toward CLEAR
  direction: 'INCREASES_RISK' | 'REDUCES_RISK';
}

export interface ExplainabilityResponse {
  model: MLModelKey;
  modelDisplayName: string;
  predictedClass: RiskLevel;
  deterministicClass: RiskLevel;
  probabilities: Record<RiskLevel, number>;
  confidence: number;
  advisoryOnly: true;
  trainedOn: 'SYNTHETIC';
  datasetNote: string;
  limitations: string[];
  plainExplanation: string;
  top3Factors: FeatureAttribution[];
  shapAttributions: FeatureAttribution[];
  limeAttributions: FeatureAttribution[];
  limeLocalR2: number;
  physicsThresholds: {
    dangerTtcS: number;
    cautionTtcS: number;
    dangerGapM: number;
    cautionGapM: number;
    throatAlpha: number;
    weatherBeta: number;
    combinedFactor: number;
  };
  provenance: ProvenanceClass;
  generatedAt: string;
}

export interface DispatchAction {
  trainId: string;
  trainNo: string;
  trainName: string;
  actionType: 'HOLD' | 'SPEED_REGULATE' | 'PRECEDENCE_GRANT' | 'LOOP_LINE_NOT_MODELED';
  label: string;
  detail: string;
  targetSpeedKmh?: number;
  holdSeconds?: number;
  estimatedDelayDeltaMin: number;
}

export interface DispatchPlan {
  id: string;
  version: string;
  name: string;
  strategy: 'BASELINE' | 'RAILRAKSHA_OPTIMIZED' | 'SAFETY_HOLD';
  description: string;
  conflictId: string;
  actions: DispatchAction[];
  metrics: {
    predictedTotalDelayMin: number;
    predictedWaitingMin: number;
    projectedConflictsRemaining: number;
    projectedMinGapM: number;
    projectedMinTtcS: number;
    throughputTrainsPerHr: number;
    recoveryTimeMin: number;
  };
  tradeoffs: string[];
  loopLineNote: string;
  provenance: ProvenanceClass;
}

export interface DecisionRecord {
  id: string;
  replayId: string;
  timestamp: string;
  conflictId: string;
  trainPair: string;
  planId: string;
  planVersion: string;
  planName: string;
  decision: 'ACCEPTED_FOR_SIMULATION' | 'MODIFIED_SCENARIO' | 'REJECTED_PROPOSAL';
  controllerNote: string;
  reasonCode: string;
  beforeMetrics: {
    minGapM: number;
    minTtcS: number;
    activeConflicts: number;
    totalDelayMin: number;
  };
  afterMetrics: {
    minGapM: number;
    minTtcS: number;
    activeConflicts: number;
    totalDelayMin: number;
  };
  provenance: 'CONTROLLER_DECISION';
}

export interface StationStop {
  stationCode: string;
  stationName: string;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
  reportedArrival: string | null;
  reportedDeparture: string | null;
  delayMin: number | null;
  distanceKm: number | null;
  status: 'PASSED' | 'CURRENT' | 'UPCOMING' | 'UNKNOWN';
}

export interface LiveObservation {
  observedAt: string;
  stationCode: string;
  stationName: string;
  delayMin: number | null;
  source: ProvenanceClass;
  note: string;
}

export interface LiveTrainSnapshot {
  trainNo: string;
  trainName: string;
  originCode: string;
  originName: string;
  destinationCode: string;
  destinationName: string;
  lastReportedStationCode: string | null;
  lastReportedStationName: string | null;
  nextScheduledStationCode: string | null;
  nextScheduledStationName: string | null;
  scheduledEta: string | null;
  reportedEta: string | null;
  delayMinutes: number | null;
  runningStatus: 'ON_TIME' | 'DELAYED' | 'SCHEDULED' | 'STATUS_UNAVAILABLE';
  lastUpdatedAt: string;
  fetchedFromExternalAt: string | null;
  cacheAgeMinutes: number;
  isStale: boolean;
  provenance: ProvenanceClass;
  sourceLabel: string;
  inWatchlist: boolean;
  corridorTrainId: string | null;
  stationTimeline: StationStop[];
  historicalObservations: LiveObservation[];
  unavailableFieldsNote: string;
}

export interface QuotaStatus {
  railradarKeyConfigured: boolean;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  maxFleetRefreshTrains: number;
  freshCacheMinutes: number;
  staleCacheDays: number;
  cooldownActive: boolean;
  cooldownUntil: string | null;
  lastExternalCallAt: string | null;
  totalCacheHits: number;
  totalSuppressedDuplicates: number;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  category:
    | 'headway_conflict'
    | 'station_throat'
    | 'weather_storm'
    | 'freight_slowdown'
    | 'cascade_delay'
    | 'priority_express'
    | 'fog_snow'
    | 'baseline_clear';
  description: string;
  weather: WeatherMode;
  targetTrainId: string;
  leaderTrainId: string | null;
  injectGapM: number;
  leaderSpeedKmh: number;
  followerSpeedKmh: number;
  injectDelayMin: number;
  expectedSeverity: RiskLevel;
  provenance: 'SIMULATED';
}

export interface BenchmarkModelRow {
  model: string;
  suite: 'BUNDLED_6480' | 'RESEARCH_PAPER_3600';
  accuracy: number;
  macroF1: number;
  precision?: number;
  recall?: number;
  brierScore?: number;
  r2Score?: number;
  missedDanger?: number;
  falseDanger?: number;
  notes: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  provenance?: ProvenanceClass;
  fallbackUsed?: boolean;
}
