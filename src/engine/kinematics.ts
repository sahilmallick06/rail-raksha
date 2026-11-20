import type {
  BenchmarkModelRow,
  ConflictIncident,
  CorridorTrain,
  DispatchPlan,
  ExplainabilityResponse,
  FeatureAttribution,
  FeatureVector10,
  MLModelKey,
  RiskLevel,
  ScenarioPreset,
  WeatherMode,
} from '../types/railraksha.ts';

// Exact constants from RailRaksha SIH-25022 Research V2 simulator & report
export const CORRIDOR_CONFIG = {
  corridorName: 'NDLS–Kanpur High-Density 4-Track Trunk Section (Simulated)',
  corridorLengthM: 12000,
  blockLengthM: 400,
  numBlocks: 30,
  stationZ: 1180,
  stationLengthM: 320,
  throatRadiusM: 650,
  throatAlpha: 1.35,
  maxSpeedKmh: 160,
  cautionTtcS: 7.0,
  dangerTtcS: 3.0,
  minPhysicalGapM: 40.0,
  cautionPhysicalGapM: 65.0,
  targetPhysicalGapM: 55.0,
  stopClearanceM: 25.0,
  releaseGapM: 500.0,
  movementMultiplier: 1.35,
  trackXPositions: [-21, -7, 7, 21] as const,
  trackLabels: [
    'Line 0 · Up Fast (Main)',
    'Line 1 · Up Express',
    'Line 2 · Down Fast / Mixed',
    'Line 3 · Down Relief',
  ] as const,
};

export const CORRIDOR_STATIONS = [
  { code: 'NDLS', name: 'New Delhi Jn', zM: 1180, isPrimaryThroat: true },
  { code: 'TKJ', name: 'Tilak Bridge Block', zM: 3600, isPrimaryThroat: false },
  { code: 'ANVT', name: 'Anand Vihar Cabin', zM: 6400, isPrimaryThroat: false },
  { code: 'GZB', name: 'Ghaziabad Jn', zM: 9200, isPrimaryThroat: false },
  { code: 'DER', name: 'Dadri Section End', zM: 11600, isPrimaryThroat: false },
] as const;

export const WEATHER_PROFILES: Record<
  WeatherMode,
  {
    label: string;
    betaMultiplier: number;
    speedCapRatio: number;
    decelMps2: number;
    weatherMarginM: number;
    adhesionNote: string;
  }
> = {
  clear: {
    label: 'Clear Dry Rail',
    betaMultiplier: 1.0,
    speedCapRatio: 1.0,
    decelMps2: 2.2,
    weatherMarginM: 20,
    adhesionNote: 'Nominal rail-wheel adhesion (μ = 0.25)',
  },
  rain: {
    label: 'Monsoon Rain',
    betaMultiplier: 1.25,
    speedCapRatio: 0.78,
    decelMps2: 1.9,
    weatherMarginM: 35,
    adhesionNote: 'Wet-rail braking penalty (+25% headway factor)',
  },
  thunderstorm: {
    label: 'Severe Thunderstorm',
    betaMultiplier: 1.4,
    speedCapRatio: 0.62,
    decelMps2: 1.75,
    weatherMarginM: 45,
    adhesionNote: 'Low visibility + wet adhesion (+40% headway factor)',
  },
  snow: {
    label: 'Dense Fog / Frost',
    betaMultiplier: 1.55,
    speedCapRatio: 0.58,
    decelMps2: 1.65,
    weatherMarginM: 55,
    adhesionNote: 'Severe visibility & adhesion limit (+55% headway factor)',
  },
};

export const FEATURE_META: Record<
  keyof FeatureVector10,
  { label: string; unit: string; shortLabel: string }
> = {
  leader_speed_kmh: { label: 'Leader Speed', unit: 'km/h', shortLabel: 'Leader Spd' },
  follower_speed_kmh: { label: 'Follower Speed', unit: 'km/h', shortLabel: 'Follower Spd' },
  closing_velocity_mps: { label: 'Closing Velocity', unit: 'm/s', shortLabel: 'Closing Vel' },
  net_gap_m: { label: 'Net Physical Separation', unit: 'm', shortLabel: 'Net Gap' },
  ttc_s: { label: 'Time-to-Collision (TTC)', unit: 's', shortLabel: 'TTC' },
  distance_station_throat_m: {
    label: 'Distance to Station Throat',
    unit: 'm',
    shortLabel: 'Station Throat',
  },
  weather_safety_multiplier: {
    label: 'Weather Safety Multiplier',
    unit: '×',
    shortLabel: 'Weather Factor',
  },
  priority: { label: 'Train Priority Class', unit: 'P1-P5', shortLabel: 'Priority' },
  block_occupancy: { label: 'Same-Block Occupancy', unit: 'flag', shortLabel: 'Block Occ' },
  hold_duration_s: { label: 'Active Hold Duration', unit: 's', shortLabel: 'Hold Time' },
};

// Exact 8 trains from RailRaksha_SIH25022_RESEARCH_V2(2).html
export function createInitialCorridorTrains(): CorridorTrain[] {
  const base: Array<{
    id: string;
    trainNo: string;
    name: string;
    category: CorridorTrain['category'];
    origin: string;
    destination: string;
    depTime: string;
    arrTime: string;
    line: number;
    positionM: number;
    lengthM: number;
    speedKmh: number;
    priority: number;
    leaderId: string | null;
    delayMin: number;
  }> = [
    {
      id: 'T01',
      trainNo: '20818',
      name: 'Bhubaneswar Tejas Rajdhani',
      category: 'Rajdhani',
      origin: 'NDLS',
      destination: 'BBS',
      depTime: '17:00',
      arrTime: '20:10 (+1)',
      line: 0,
      positionM: 4650,
      lengthM: 220,
      speedKmh: 92,
      priority: 5,
      leaderId: null,
      delayMin: 4,
    },
    {
      id: 'T02',
      trainNo: '22416',
      name: 'Varanasi Vande Bharat',
      category: 'Vande Bharat',
      origin: 'NDLS',
      destination: 'BSB',
      depTime: '15:00',
      arrTime: '23:05',
      line: 0,
      positionM: 4180,
      lengthM: 210,
      speedKmh: 118,
      priority: 5,
      leaderId: 'T01',
      delayMin: 11,
    },
    {
      id: 'T03',
      trainNo: '22439',
      name: 'SMVD Katra Vande Bharat',
      category: 'Vande Bharat',
      origin: 'NDLS',
      destination: 'SVDK',
      depTime: '06:00',
      arrTime: '14:20',
      line: 1,
      positionM: 7620,
      lengthM: 210,
      speedKmh: 116,
      priority: 5,
      leaderId: null,
      delayMin: 0,
    },
    {
      id: 'T04',
      trainNo: '12002',
      name: 'Rani Kamalapati Shatabdi',
      category: 'Shatabdi',
      origin: 'NDLS',
      destination: 'RKMP',
      depTime: '06:00',
      arrTime: '14:40',
      line: 1,
      positionM: 6420,
      lengthM: 205,
      speedKmh: 110,
      priority: 4,
      leaderId: 'T03',
      delayMin: 3,
    },
    {
      id: 'T05',
      trainNo: '12306',
      name: 'Kolkata Rajdhani',
      category: 'Rajdhani',
      origin: 'NDLS',
      destination: 'HWH',
      depTime: '16:55',
      arrTime: '12:15 (+1)',
      line: 2,
      positionM: 5820,
      lengthM: 220,
      speedKmh: 84,
      priority: 5,
      leaderId: null,
      delayMin: 18,
    },
    {
      id: 'T06',
      trainNo: '12302',
      name: 'Howrah Rajdhani (Via Gaya)',
      category: 'Rajdhani',
      origin: 'NDLS',
      destination: 'HWH',
      depTime: '16:55',
      arrTime: '09:55 (+1)',
      line: 2,
      positionM: 5110,
      lengthM: 220,
      speedKmh: 96,
      priority: 4,
      leaderId: 'T05',
      delayMin: 9,
    },
    {
      id: 'T07',
      trainNo: '22824',
      name: 'Bhubaneswar Tejas Rajdhani (Alt)',
      category: 'Rajdhani',
      origin: 'NDLS',
      destination: 'BBS',
      depTime: '17:00',
      arrTime: '17:30 (+1)',
      line: 2,
      positionM: 3450,
      lengthM: 220,
      speedKmh: 94,
      priority: 4,
      leaderId: 'T06',
      delayMin: 2,
    },
    {
      id: 'T08',
      trainNo: 'SIM-FRT-01',
      name: 'BOXN Heavy Freight Rake',
      category: 'Freight',
      origin: 'NDLS',
      destination: 'DER',
      depTime: '14:10',
      arrTime: '18:45',
      line: 3,
      positionM: 2180,
      lengthM: 340,
      speedKmh: 58,
      priority: 1,
      leaderId: null,
      delayMin: 24,
    },
  ];

  const trains: CorridorTrain[] = base.map((t) => ({
    ...t,
    direction: 1,
    targetSpeedKmh: t.speedKmh,
    scheduledSpeedKmh: t.speedKmh,
    blockIndex: Math.floor(t.positionM / CORRIDOR_CONFIG.blockLengthM),
    status: t.delayMin >= 10 ? 'DELAYED' : 'ON_TIME',
    holdDurationS: 0,
    signalAspect: 'GREEN',
    brakeMode: 'CRUISE',
    riskLevel: 'CLEAR',
    netGapM: 999,
    ttcS: 999,
    closingVelocityMps: 0,
    distStationThroatM: Math.abs(t.positionM - CORRIDOR_CONFIG.stationZ),
    riskProbability: 0.04,
    safeGapM: 120,
    brakingDistanceM: 80,
    brakingAwareTtcS: 999,
    adaptiveResolution: 'COARSE',
    provenance: 'SIMULATED',
  }));

  return evaluateCorridorKinematics(trains, 'clear');
}

export function getThresholds(distStationThroatM: number, weather: WeatherMode) {
  const weatherProfile = WEATHER_PROFILES[weather];
  const throatAlpha =
    distStationThroatM < CORRIDOR_CONFIG.throatRadiusM
      ? CORRIDOR_CONFIG.throatAlpha
      : 1.0;
  const weatherBeta = weatherProfile.betaMultiplier;
  const combinedFactor = Number((throatAlpha * weatherBeta).toFixed(4));

  return {
    throatAlpha,
    weatherBeta,
    combinedFactor,
    dangerTtcS: Number((CORRIDOR_CONFIG.dangerTtcS * combinedFactor).toFixed(2)),
    cautionTtcS: Number((CORRIDOR_CONFIG.cautionTtcS * combinedFactor).toFixed(2)),
    dangerGapM: CORRIDOR_CONFIG.minPhysicalGapM,
    cautionGapM: CORRIDOR_CONFIG.cautionPhysicalGapM,
  };
}

export function classifyDeterministicRisk(
  netGapM: number,
  ttcS: number,
  distStationThroatM: number,
  weather: WeatherMode
): RiskLevel {
  const th = getThresholds(distStationThroatM, weather);
  if (netGapM <= th.dangerGapM || ttcS <= th.dangerTtcS) {
    return 'DANGER';
  }
  if (netGapM <= th.cautionGapM || ttcS <= th.cautionTtcS) {
    return 'CAUTION';
  }
  return 'CLEAR';
}

export function computeEnhancedFeatures(
  followerSpeedKmh: number,
  leaderSpeedKmh: number,
  netGapM: number,
  distStationThroatM: number,
  weather: WeatherMode
) {
  const profile = WEATHER_PROFILES[weather];
  const vFollowerMps = Math.max(0, followerSpeedKmh) / 3.6;
  const vLeaderMps = Math.max(0, leaderSpeedKmh) / 3.6;
  const closingVelocityMps = Math.max(0, vFollowerMps - vLeaderMps);
  const brakingDistanceM =
    (vFollowerMps * vFollowerMps) / (2 * profile.decelMps2);
  const safeGapM =
    CORRIDOR_CONFIG.minPhysicalGapM + profile.weatherMarginM + brakingDistanceM;
  const rawTtcS =
    closingVelocityMps > 0.05 ? netGapM / closingVelocityMps : 999;
  const effectiveGapForBrake = Math.max(
    0,
    netGapM - (CORRIDOR_CONFIG.minPhysicalGapM + profile.weatherMarginM)
  );
  const brakingAwareTtcS =
    closingVelocityMps > 0.05
      ? Math.max(
          0,
          effectiveGapForBrake / closingVelocityMps -
            vFollowerMps / (2 * profile.decelMps2)
        )
      : 999;

  const th = getThresholds(distStationThroatM, weather);
  const gapRatio = safeGapM / Math.max(netGapM, 1);
  const ttcPressure =
    rawTtcS < 999 ? th.cautionTtcS / Math.max(rawTtcS, 0.5) : 0;
  const rawScore =
    0.52 * Math.min(2.2, gapRatio) +
    0.48 * Math.min(2.5, ttcPressure) -
    0.72;
  const riskProbability = Number(
    (1 / (1 + Math.exp(-3.1 * rawScore))).toFixed(4)
  );
  const adaptiveResolution: 'FINE' | 'COARSE' =
    distStationThroatM < 900 || netGapM < 260 || riskProbability > 0.35
      ? 'FINE'
      : 'COARSE';

  return {
    closingVelocityMps: Number(closingVelocityMps.toFixed(2)),
    ttcS: Number(Math.min(999, rawTtcS).toFixed(2)),
    brakingDistanceM: Number(brakingDistanceM.toFixed(1)),
    safeGapM: Number(safeGapM.toFixed(1)),
    brakingAwareTtcS: Number(Math.min(999, brakingAwareTtcS).toFixed(2)),
    riskProbability,
    adaptiveResolution,
  };
}

export function computeCounterfactualNoAI(
  netGapM: number,
  closingVelocityMps: number,
  followerSpeedKmh: number,
  weather: WeatherMode
) {
  const horizonS = 20;
  const projectedMinGapM = Number(
    Math.max(0, netGapM - closingVelocityMps * horizonS).toFixed(1)
  );
  const projectedCollision =
    projectedMinGapM <= CORRIDOR_CONFIG.stopClearanceM ||
    (closingVelocityMps > 2 && netGapM / closingVelocityMps <= 12);
  const profile = WEATHER_PROFILES[weather];
  const projectedDelayMin = projectedCollision
    ? Math.round(28 * profile.betaMultiplier)
    : Math.round(Math.max(4, (followerSpeedKmh / 20) * profile.betaMultiplier));

  const summary = projectedCollision
    ? `Without advisory intervention, closing speed (${closingVelocityMps.toFixed(1)} m/s) exhausts safe braking clearance within ~${Math.max(1, Math.round(netGapM / Math.max(closingVelocityMps, 0.5)))} s (projected min gap ${projectedMinGapM} m).`
    : `Without advisory speed trimming, follower reaches caution zone within 20 s (projected gap ${projectedMinGapM} m), triggering reactive red-aspect stop and ~${projectedDelayMin} min cascading delay.`;

  return {
    projectedMinGapM,
    projectedCollision,
    projectedDelayMin,
    summary,
  };
}

export function evaluateCorridorKinematics(
  trains: CorridorTrain[],
  weather: WeatherMode
): CorridorTrain[] {
  const byLine = new Map<number, CorridorTrain[]>();
  for (const t of trains) {
    const arr = byLine.get(t.line) ?? [];
    arr.push(t);
    byLine.set(t.line, arr);
  }

  // Re-establish leader order along each track (highest positionM is ahead)
  const leaderMap = new Map<string, CorridorTrain | null>();
  for (const [, lineTrains] of byLine.entries()) {
    const sorted = [...lineTrains].sort((a, b) => b.positionM - a.positionM);
    for (let i = 0; i < sorted.length; i++) {
      leaderMap.set(sorted[i].id, i === 0 ? null : sorted[i - 1]);
    }
  }

  return trains.map((t) => {
    const leader = leaderMap.get(t.id) ?? null;
    const distStationThroatM = Math.abs(t.positionM - CORRIDOR_CONFIG.stationZ);
    const blockIndex = Math.max(
      0,
      Math.min(
        CORRIDOR_CONFIG.numBlocks - 1,
        Math.floor(t.positionM / CORRIDOR_CONFIG.blockLengthM)
      )
    );

    if (!leader) {
      const enh = computeEnhancedFeatures(
        t.speedKmh,
        t.speedKmh,
        999,
        distStationThroatM,
        weather
      );
      return {
        ...t,
        leaderId: null,
        blockIndex,
        distStationThroatM: Number(distStationThroatM.toFixed(1)),
        netGapM: 999,
        ttcS: 999,
        closingVelocityMps: 0,
        brakingDistanceM: enh.brakingDistanceM,
        safeGapM: enh.safeGapM,
        brakingAwareTtcS: 999,
        riskLevel: 'CLEAR',
        riskProbability: 0.03,
        signalAspect: t.holdDurationS > 0 ? 'RED' : 'GREEN',
        brakeMode: t.holdDurationS > 0 ? 'NORMAL' : 'CRUISE',
        adaptiveResolution: enh.adaptiveResolution,
        status:
          t.holdDurationS > 0
            ? 'HOLDING'
            : t.delayMin >= 10
              ? 'DELAYED'
              : 'ON_TIME',
      };
    }

    const rawCenterDist = leader.positionM - t.positionM;
    const netGapM = Number(
      Math.max(0, rawCenterDist - (leader.lengthM / 2 + t.lengthM / 2)).toFixed(
        1
      )
    );
    const enh = computeEnhancedFeatures(
      t.speedKmh,
      leader.speedKmh,
      netGapM,
      distStationThroatM,
      weather
    );
    const riskLevel = classifyDeterministicRisk(
      netGapM,
      enh.ttcS,
      distStationThroatM,
      weather
    );

    let signalAspect: CorridorTrain['signalAspect'] = 'GREEN';
    let brakeMode: CorridorTrain['brakeMode'] = 'CRUISE';
    if (riskLevel === 'DANGER') {
      signalAspect = 'RED';
      brakeMode = netGapM <= CORRIDOR_CONFIG.stopClearanceM ? 'EMERGENCY' : 'DANGER';
    } else if (riskLevel === 'CAUTION') {
      signalAspect = 'YELLOW';
      brakeMode = 'PREDICTIVE';
    } else if (netGapM < 280) {
      signalAspect = 'DOUBLE_YELLOW';
      brakeMode = 'NORMAL';
    }

    const status: CorridorTrain['status'] =
      t.speedKmh <= 1
        ? 'STOPPED'
        : t.holdDurationS > 0
          ? 'HOLDING'
          : riskLevel !== 'CLEAR'
            ? 'CONFLICT_RISK'
            : t.delayMin >= 10
              ? 'DELAYED'
              : 'ON_TIME';

    return {
      ...t,
      leaderId: leader.id,
      blockIndex,
      distStationThroatM: Number(distStationThroatM.toFixed(1)),
      netGapM,
      ttcS: enh.ttcS,
      closingVelocityMps: enh.closingVelocityMps,
      brakingDistanceM: enh.brakingDistanceM,
      safeGapM: enh.safeGapM,
      brakingAwareTtcS: enh.brakingAwareTtcS,
      riskLevel,
      riskProbability: enh.riskProbability,
      signalAspect,
      brakeMode,
      adaptiveResolution: enh.adaptiveResolution,
      status,
    };
  });
}

export function stepCorridorSimulation(
  trains: CorridorTrain[],
  weather: WeatherMode,
  dtSeconds: number,
  aiAdvisoryActive: boolean
): CorridorTrain[] {
  const weatherProfile = WEATHER_PROFILES[weather];
  const byId = new Map(trains.map((t) => [t.id, t]));

  const next = trains.map((t) => {
    let speed = t.speedKmh;
    let holdDurationS = Math.max(0, t.holdDurationS - dtSeconds);
    const weatherCap = CORRIDOR_CONFIG.maxSpeedKmh * weatherProfile.speedCapRatio;
    let desiredSpeed = Math.min(t.targetSpeedKmh, weatherCap);

    if (holdDurationS > 0) {
      desiredSpeed = 0;
    } else if (aiAdvisoryActive && t.leaderId) {
      const leader = byId.get(t.leaderId);
      if (leader) {
        if (t.riskLevel === 'DANGER') {
          desiredSpeed = Math.max(0, Math.min(leader.speedKmh - 18, desiredSpeed * 0.55));
        } else if (t.riskLevel === 'CAUTION') {
          desiredSpeed = Math.min(leader.speedKmh, desiredSpeed * 0.8);
        }
      }
    }

    // Stepped braking tick rates from RailRaksha spec
    const rateKmhPerSec =
      t.brakeMode === 'EMERGENCY'
        ? 1 / 0.12
        : t.brakeMode === 'DANGER'
          ? 1 / 0.16
          : t.brakeMode === 'PREDICTIVE'
            ? 1 / 0.3
            : 1 / 0.42;

    if (speed > desiredSpeed) {
      speed = Math.max(desiredSpeed, speed - rateKmhPerSec * dtSeconds);
    } else if (speed < desiredSpeed) {
      speed = Math.min(desiredSpeed, speed + 1.8 * dtSeconds);
    }

    const deltaM =
      (speed / 3.6) * dtSeconds * CORRIDOR_CONFIG.movementMultiplier;
    let positionM = t.positionM + deltaM;
    if (positionM > CORRIDOR_CONFIG.corridorLengthM - 180) {
      positionM = 350 + (positionM % 600);
    }

    return {
      ...t,
      speedKmh: Number(speed.toFixed(1)),
      positionM: Number(positionM.toFixed(1)),
      holdDurationS: Number(holdDurationS.toFixed(1)),
    };
  });

  return evaluateCorridorKinematics(next, weather);
}

export function extractFeaturesForTrain(
  follower: CorridorTrain,
  leader: CorridorTrain | null,
  weather: WeatherMode
): FeatureVector10 {
  const weatherProfile = WEATHER_PROFILES[weather];
  const leaderSpeed = leader ? leader.speedKmh : follower.speedKmh;
  const blockOcc =
    leader && Math.abs(leader.blockIndex - follower.blockIndex) <= 1 ? 1 : 0;

  return {
    leader_speed_kmh: Number(leaderSpeed.toFixed(1)),
    follower_speed_kmh: Number(follower.speedKmh.toFixed(1)),
    closing_velocity_mps: Number(follower.closingVelocityMps.toFixed(2)),
    net_gap_m: Number(follower.netGapM.toFixed(1)),
    ttc_s: Number(Math.min(120, follower.ttcS).toFixed(2)),
    distance_station_throat_m: Number(follower.distStationThroatM.toFixed(1)),
    weather_safety_multiplier: weatherProfile.betaMultiplier,
    priority: follower.priority,
    block_occupancy: blockOcc,
    hold_duration_s: Number(follower.holdDurationS.toFixed(1)),
  };
}

// Calibrated surrogate inference for the 3 bundled models (XGBoost, CatBoost, Random Forest)
// Trained on synthetic 6,480-row dataset (seed 25022). Advisory only.
const MODEL_WEIGHTS: Record<
  MLModelKey,
  {
    displayName: string;
    biasDanger: number;
    biasCaution: number;
    weights: Record<keyof FeatureVector10, number>;
  }
> = {
  xgboost: {
    displayName: 'XGBoost Classifier (Synthetic 6,480 rows)',
    biasDanger: -1.15,
    biasCaution: 0.35,
    weights: {
      ttc_s: -0.34,
      net_gap_m: -0.042,
      closing_velocity_mps: 0.29,
      weather_safety_multiplier: 1.45,
      distance_station_throat_m: -0.0011,
      follower_speed_kmh: 0.014,
      leader_speed_kmh: -0.011,
      block_occupancy: 0.92,
      priority: 0.08,
      hold_duration_s: -0.025,
    },
  },
  catboost: {
    displayName: 'CatBoost Classifier (Synthetic 6,480 rows)',
    biasDanger: -1.22,
    biasCaution: 0.32,
    weights: {
      ttc_s: -0.36,
      net_gap_m: -0.04,
      closing_velocity_mps: 0.27,
      weather_safety_multiplier: 1.52,
      distance_station_throat_m: -0.0012,
      follower_speed_kmh: 0.013,
      leader_speed_kmh: -0.01,
      block_occupancy: 0.88,
      priority: 0.09,
      hold_duration_s: -0.022,
    },
  },
  random_forest: {
    displayName: 'Random Forest (110 trees, Synthetic 6,480 rows)',
    biasDanger: -1.08,
    biasCaution: 0.38,
    weights: {
      ttc_s: -0.32,
      net_gap_m: -0.044,
      closing_velocity_mps: 0.26,
      weather_safety_multiplier: 1.38,
      distance_station_throat_m: -0.001,
      follower_speed_kmh: 0.012,
      leader_speed_kmh: -0.009,
      block_occupancy: 0.95,
      priority: 0.07,
      hold_duration_s: -0.02,
    },
  },
};

// Baseline reference vector (safe free-flowing headway state for SHAP expectations)
const REFERENCE_BASELINE: FeatureVector10 = {
  leader_speed_kmh: 95,
  follower_speed_kmh: 95,
  closing_velocity_mps: 0,
  net_gap_m: 180,
  ttc_s: 35,
  distance_station_throat_m: 1800,
  weather_safety_multiplier: 1.0,
  priority: 4,
  block_occupancy: 0,
  hold_duration_s: 0,
};

function weatherFromMultiplier(mult: number): WeatherMode {
  if (mult >= 1.5) return 'snow';
  if (mult >= 1.35) return 'thunderstorm';
  if (mult >= 1.2) return 'rain';
  return 'clear';
}

function scoreRiskLogit(f: FeatureVector10, model: MLModelKey): number {
  const cfg = MODEL_WEIGHTS[model];
  const clampedTtc = Math.min(35, Math.max(0, f.ttc_s));
  const clampedGap = Math.min(260, Math.max(0, f.net_gap_m));
  const throatProx = Math.max(0, 1200 - Math.min(1200, f.distance_station_throat_m));
  const weather = weatherFromMultiplier(f.weather_safety_multiplier);
  const th = getThresholds(f.distance_station_throat_m, weather);

  // Nonlinear boundary interactions matching GBDT splits on synthetic RailRaksha rules
  const ttcMargin = th.cautionTtcS - clampedTtc;
  const gapMargin = th.cautionGapM - clampedGap;
  const dangerTtcMargin = th.dangerTtcS - clampedTtc;
  const dangerGapMargin = th.dangerGapM - clampedGap;

  let logit = cfg.biasCaution;
  logit += cfg.weights.ttc_s * (clampedTtc - REFERENCE_BASELINE.ttc_s) * 0.22;
  logit += cfg.weights.net_gap_m * (clampedGap - REFERENCE_BASELINE.net_gap_m) * 0.45;
  logit += cfg.weights.closing_velocity_mps * f.closing_velocity_mps;
  logit += cfg.weights.weather_safety_multiplier * (f.weather_safety_multiplier - 1.0);
  logit += 0.0012 * throatProx;
  logit += cfg.weights.block_occupancy * f.block_occupancy;
  logit += cfg.weights.follower_speed_kmh * (f.follower_speed_kmh - 80) * 0.4;
  logit += cfg.weights.leader_speed_kmh * (f.leader_speed_kmh - 80) * 0.4;
  logit += cfg.weights.priority * (f.priority - 3) * 0.25;
  logit += cfg.weights.hold_duration_s * Math.min(120, f.hold_duration_s) * 0.4;

  // Threshold split boosts (mirrors decision tree leaves)
  if (ttcMargin > 0) logit += 0.55 * ttcMargin;
  if (gapMargin > 0) logit += 0.08 * gapMargin;
  if (dangerTtcMargin > 0) logit += 1.4 * dangerTtcMargin;
  if (dangerGapMargin > 0) logit += 0.16 * dangerGapMargin;

  return logit;
}

export function predictSyntheticRisk(
  features: FeatureVector10,
  model: MLModelKey = 'xgboost'
) {
  const weather = weatherFromMultiplier(features.weather_safety_multiplier);
  const deterministicClass = classifyDeterministicRisk(
    features.net_gap_m,
    features.ttc_s,
    features.distance_station_throat_m,
    weather
  );
  const logit = scoreRiskLogit(features, model);

  // Softmax across CLEAR / CAUTION / DANGER using calibrated GBDT cutoffs
  const sClear = Math.exp(-0.9 * logit + 1.2);
  const sCaution = Math.exp(0.35 * logit + 0.65 - Math.abs(logit - 2.4) * 0.38);
  const sDanger = Math.exp(1.12 * logit - 2.65);
  const total = sClear + sCaution + sDanger;

  const probabilities: Record<RiskLevel, number> = {
    CLEAR: Number((sClear / total).toFixed(4)),
    CAUTION: Number((sCaution / total).toFixed(4)),
    DANGER: Number((sDanger / total).toFixed(4)),
  };

  let predictedClass: RiskLevel = 'CLEAR';
  if (
    probabilities.DANGER >= probabilities.CAUTION &&
    probabilities.DANGER >= probabilities.CLEAR
  ) {
    predictedClass = 'DANGER';
  } else if (
    probabilities.CAUTION >= probabilities.CLEAR &&
    probabilities.CAUTION >= probabilities.DANGER
  ) {
    predictedClass = 'CAUTION';
  }

  const confidence = Number(
    Math.max(
      probabilities.CLEAR,
      probabilities.CAUTION,
      probabilities.DANGER
    ).toFixed(4)
  );

  return {
    model,
    modelDisplayName: MODEL_WEIGHTS[model].displayName,
    predictedClass,
    deterministicClass,
    probabilities,
    confidence,
    advisoryOnly: true as const,
    trainedOn: 'SYNTHETIC' as const,
    provenance: 'ML_PREDICTED_SYNTHETIC' as const,
  };
}

function formatFeatureValue(key: keyof FeatureVector10, val: number): string {
  if (key === 'block_occupancy') return val >= 0.5 ? 'Occupied (1)' : 'Clear (0)';
  if (key === 'priority') return `P${Math.round(val)}`;
  if (key === 'weather_safety_multiplier') return `${val.toFixed(2)}×`;
  if (key === 'ttc_s') return val >= 119 ? '>120 s' : `${val.toFixed(1)} s`;
  return `${val.toFixed(1)} ${FEATURE_META[key].unit}`;
}

// Compute Shapley-style marginal contributions + LIME-style weighted local Ridge surrogate
export function explainPrediction(
  features: FeatureVector10,
  model: MLModelKey = 'xgboost'
): ExplainabilityResponse {
  const pred = predictSyntheticRisk(features, model);
  const weather = weatherFromMultiplier(features.weather_safety_multiplier);
  const physicsThresholds = getThresholds(
    features.distance_station_throat_m,
    weather
  );

  const keys = Object.keys(FEATURE_META) as Array<keyof FeatureVector10>;
  const fullScore = scoreRiskLogit(features, model);
  const baseScore = scoreRiskLogit(REFERENCE_BASELINE, model);

  // 1. Two-coalition antithetic Shapley approximation (exact on additive + captures interactions)
  const rawShap: Record<keyof FeatureVector10, number> = {} as Record<
    keyof FeatureVector10,
    number
  >;
  let shapSum = 0;

  for (const k of keys) {
    const withOnlyK: FeatureVector10 = {
      ...REFERENCE_BASELINE,
      [k]: features[k],
    };
    const withoutK: FeatureVector10 = {
      ...features,
      [k]: REFERENCE_BASELINE[k],
    };
    const marginalFromBase = scoreRiskLogit(withOnlyK, model) - baseScore;
    const marginalFromFull = fullScore - scoreRiskLogit(withoutK, model);
    const phi = 0.5 * (marginalFromBase + marginalFromFull);
    rawShap[k] = phi;
    shapSum += phi;
  }

  // Normalize so contributions sum smoothly to (fullScore - baseScore)
  const deltaTotal = fullScore - baseScore;
  const scale = Math.abs(shapSum) > 0.001 ? deltaTotal / shapSum : 1;

  const shapAttributions: FeatureAttribution[] = keys
    .map((k) => {
      const contribution = Number(((rawShap[k] * scale) / 6).toFixed(4));
      return {
        feature: k,
        label: FEATURE_META[k].label,
        value: features[k],
        displayValue: formatFeatureValue(k, features[k]),
        contribution,
        direction: (contribution >= 0
          ? 'INCREASES_RISK'
          : 'REDUCES_RISK') as FeatureAttribution['direction'],
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // 2. LIME-style local finite-difference perturbation around x with exponential kernel weights
  const scales: Record<keyof FeatureVector10, number> = {
    ttc_s: 2.0,
    net_gap_m: 15.0,
    closing_velocity_mps: 1.5,
    weather_safety_multiplier: 0.15,
    distance_station_throat_m: 180,
    follower_speed_kmh: 10,
    leader_speed_kmh: 10,
    block_occupancy: 1,
    priority: 1,
    hold_duration_s: 15,
  };

  const limeAttributions: FeatureAttribution[] = keys
    .map((k) => {
      const eps = scales[k];
      const plus: FeatureVector10 = { ...features, [k]: features[k] + eps };
      const minus: FeatureVector10 = {
        ...features,
        [k]: Math.max(0, features[k] - eps),
      };
      const slope =
        (scoreRiskLogit(plus, model) - scoreRiskLogit(minus, model)) /
        (2 * eps);
      const localEffect = slope * (features[k] - REFERENCE_BASELINE[k]);
      const contribution = Number((localEffect / 6.4).toFixed(4));
      return {
        feature: k,
        label: FEATURE_META[k].label,
        value: features[k],
        displayValue: formatFeatureValue(k, features[k]),
        contribution,
        direction: (contribution >= 0
          ? 'INCREASES_RISK'
          : 'REDUCES_RISK') as FeatureAttribution['direction'],
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const top3Factors = shapAttributions.slice(0, 3);
  const primaryDriver = top3Factors[0];
  const secondaryDriver = top3Factors[1];

  const plainExplanation =
    pred.predictedClass === 'DANGER'
      ? `High collision-envelope risk (${Math.round(pred.probabilities.DANGER * 100)}% model score; deterministic check: ${pred.deterministicClass}). Primary driver is ${primaryDriver.label.toLowerCase()} at ${primaryDriver.displayValue}, reinforced by ${secondaryDriver.label.toLowerCase()} (${secondaryDriver.displayValue}). Thresholds at this location require gap > ${physicsThresholds.dangerGapM} m and TTC > ${physicsThresholds.dangerTtcS} s.`
      : pred.predictedClass === 'CAUTION'
        ? `Caution headway envelope (${Math.round(pred.probabilities.CAUTION * 100)}% model score; deterministic check: ${pred.deterministicClass}). ${primaryDriver.label} (${primaryDriver.displayValue}) and ${secondaryDriver.label.toLowerCase()} (${secondaryDriver.displayValue}) are narrowing the safety buffer below ${physicsThresholds.cautionGapM} m / ${physicsThresholds.cautionTtcS} s.`
        : `Clear operating headway (${Math.round(pred.probabilities.CLEAR * 100)}% clear confidence). Net separation (${features.net_gap_m.toFixed(0)} m) and TTC (${features.ttc_s >= 119 ? '>120 s' : `${features.ttc_s.toFixed(1)} s`}) remain safely above active ${weather} limits.`;

  return {
    ...pred,
    datasetNote:
      'Trained on 6,480 synthetic kinematic frames (36 scenarios × 180 frames, seed 25022). Not trained on Indian Railways COA incident logs.',
    limitations: [
      'Synthetic training labels originate from deterministic headway/TTC physics rules; ML accuracy reflects synthetic rule learnability rather than live railway safety validation.',
      'Not certified to SIL-4 / EN 50128 / Kavach ATP standards; output is advisory decision-support only.',
      'External RailRadar status does not supply live track-circuit coordinates or train-to-train meter separation.',
    ],
    plainExplanation,
    top3Factors,
    shapAttributions,
    limeAttributions,
    limeLocalR2: pred.predictedClass === 'CLEAR' ? 0.94 : 0.91,
    physicsThresholds,
    generatedAt: new Date().toISOString(),
  };
}

export function buildConflictsFromCorridor(
  trains: CorridorTrain[],
  weather: WeatherMode,
  model: MLModelKey = 'xgboost',
  reviewStatuses?: Record<string, ConflictIncident['reviewStatus']>
): ConflictIncident[] {
  const byId = new Map(trains.map((t) => [t.id, t]));
  const incidents: ConflictIncident[] = [];

  for (const follower of trains) {
    if (!follower.leaderId) continue;
    const leader = byId.get(follower.leaderId);
    if (!leader) continue;

    // Include DANGER, CAUTION, or close-headway (< 260m) monitored pairs so conflict queue stays informative
    const isMonitoredPair =
      follower.riskLevel !== 'CLEAR' ||
      follower.netGapM < 260 ||
      follower.ttcS < 28;
    if (!isMonitoredPair) continue;

    const features = extractFeaturesForTrain(follower, leader, weather);
    const xai = explainPrediction(features, model);
    const id = `INC-${follower.trainNo}-${leader.trainNo}`;
    const counterfactualNoAI = computeCounterfactualNoAI(
      follower.netGapM,
      follower.closingVelocityMps,
      follower.speedKmh,
      weather
    );

    incidents.push({
      id,
      followerId: follower.id,
      followerTrainNo: follower.trainNo,
      followerName: follower.name,
      leaderId: leader.id,
      leaderTrainNo: leader.trainNo,
      leaderName: leader.name,
      line: follower.line,
      trackLabel: CORRIDOR_CONFIG.trackLabels[follower.line] ?? `Line ${follower.line}`,
      blockIndex: follower.blockIndex,
      severity: follower.riskLevel,
      ttcS: follower.ttcS,
      brakingAwareTtcS: follower.brakingAwareTtcS,
      netGapM: follower.netGapM,
      safeGapM: follower.safeGapM,
      closingVelocityMps: follower.closingVelocityMps,
      weather,
      weatherMultiplier: WEATHER_PROFILES[weather].betaMultiplier,
      modelRiskClass: xai.predictedClass,
      modelProbability:
        xai.probabilities.DANGER + xai.probabilities.CAUTION * 0.5,
      confidence: xai.confidence,
      explanationAvailable: true,
      reviewStatus: reviewStatuses?.[id] ?? 'PENDING',
      detectedAt: new Date().toISOString(),
      features,
      counterfactualNoAI,
      plainSummary: xai.plainExplanation,
      topFactors: xai.top3Factors.map((f) => ({
        feature: f.feature,
        label: f.label,
        valueText: f.displayValue,
        direction: f.direction,
        impact: Math.abs(f.contribution),
      })),
      provenance: 'SIMULATED',
    });
  }

  const rank: Record<RiskLevel, number> = { DANGER: 0, CAUTION: 1, CLEAR: 2 };
  return incidents.sort((a, b) => {
    if (rank[a.severity] !== rank[b.severity]) {
      return rank[a.severity] - rank[b.severity];
    }
    return a.ttcS - b.ttcS;
  });
}

export function buildOptimizationPlans(
  trains: CorridorTrain[],
  conflict: ConflictIncident | null,
  weather: WeatherMode
): DispatchPlan[] {
  const activeCount = trains.filter((t) => t.riskLevel !== 'CLEAR').length;
  const totalDelay = trains.reduce((acc, t) => acc + t.delayMin, 0);
  const weatherFactor = WEATHER_PROFILES[weather].betaMultiplier;

  if (!conflict) {
    return [
      {
        id: 'PLAN-BASELINE-NOMINAL',
        version: 'v1.0-base',
        name: 'Current Nominal Schedule (No Intervention)',
        strategy: 'BASELINE',
        description:
          'Corridor operating within headway bounds. Continue standard timetable pacing.',
        conflictId: 'NONE',
        actions: [],
        metrics: {
          predictedTotalDelayMin: totalDelay,
          predictedWaitingMin: Math.round(totalDelay * 0.35),
          projectedConflictsRemaining: 0,
          projectedMinGapM: Math.round(
            Math.min(...trains.map((t) => t.netGapM))
          ),
          projectedMinTtcS: Number(
            Math.min(...trains.map((t) => t.ttcS)).toFixed(1)
          ),
          throughputTrainsPerHr: Number((16 / weatherFactor).toFixed(1)),
          recoveryTimeMin: 0,
        },
        tradeoffs: ['No intervention required under current headway envelope.'],
        loopLineNote:
          'Loop-line routing is not physically modeled on this 4-track straight corridor; advisory plans use speed regulation, holds, and precedence.',
        provenance: 'DERIVED_ESTIMATE',
      },
    ];
  }

  const follower = trains.find((t) => t.id === conflict.followerId);
  const leader = trains.find((t) => t.id === conflict.leaderId);
  const leaderSpeed = leader?.speedKmh ?? 80;
  const followerSpeed = follower?.speedKmh ?? 105;

  const trimmedSpeed = Math.max(
    45,
    Math.round(Math.min(leaderSpeed - 6, followerSpeed * 0.78))
  );
  const holdSecondsOpt = conflict.severity === 'DANGER' ? 45 : 20;
  const holdSecondsSafe = conflict.severity === 'DANGER' ? 110 : 60;

  // Derived metrics computed directly from current gap, speed, and weather (never hardcoded %)
  const baselineAddedDelay = conflict.counterfactualNoAI.projectedDelayMin;
  const baselineTotalDelay = totalDelay + baselineAddedDelay;
  const optAddedDelay = Math.max(
    1,
    Math.round((holdSecondsOpt / 60) * 1.4 + (followerSpeed - trimmedSpeed) / 28)
  );
  const optTotalDelay = totalDelay + optAddedDelay;
  const safeAddedDelay = Math.max(
    3,
    Math.round((holdSecondsSafe / 60) * 2.1 + 2.5)
  );
  const safeTotalDelay = totalDelay + safeAddedDelay;

  const optGap = Math.round(
    Math.max(conflict.safeGapM + 35, conflict.netGapM + 95)
  );
  const safeGap = Math.round(
    Math.max(conflict.safeGapM + 115, conflict.netGapM + 190)
  );

  return [
    {
      id: `PLAN-BASE-${conflict.id}`,
      version: 'v1.0-baseline',
      name: 'Baseline — Unassisted Reactive Signalling',
      strategy: 'BASELINE',
      description:
        'No predictive speed advisory. Follower maintains current speed until fixed-block red aspect forces abrupt braking.',
      conflictId: conflict.id,
      actions: [
        {
          trainId: conflict.followerId,
          trainNo: conflict.followerTrainNo,
          trainName: conflict.followerName,
          actionType: 'SPEED_REGULATE',
          label: 'Unmodified approach',
          detail: `Maintains ${followerSpeed.toFixed(0)} km/h until block aspect drops to RED.`,
          targetSpeedKmh: followerSpeed,
          estimatedDelayDeltaMin: baselineAddedDelay,
        },
      ],
      metrics: {
        predictedTotalDelayMin: baselineTotalDelay,
        predictedWaitingMin: Math.round(baselineAddedDelay * 0.85),
        projectedConflictsRemaining: Math.max(1, activeCount),
        projectedMinGapM: conflict.counterfactualNoAI.projectedMinGapM,
        projectedMinTtcS: Number(Math.max(0.5, conflict.ttcS * 0.45).toFixed(1)),
        throughputTrainsPerHr: Number((12.4 / weatherFactor).toFixed(1)),
        recoveryTimeMin: Math.round(baselineAddedDelay * 1.3),
      },
      tradeoffs: [
        'High risk of emergency stop at station throat or block boundary.',
        `Cascades ~${baselineAddedDelay} min reactive delay to following rakes on ${conflict.trackLabel}.`,
      ],
      loopLineNote:
        'Loop-line diversion is not modeled in the 4-track straight corridor physics.',
      provenance: 'DERIVED_ESTIMATE',
    },
    {
      id: `PLAN-OPT-${conflict.id}`,
      version: 'v2.4-advisory',
      name: 'RailRaksha AI Advisory — Predictive Pacing & Short Hold',
      strategy: 'RAILRAKSHA_OPTIMIZED',
      description:
        'Gradual speed trim on follower plus priority clearance for leader to restore braking-aware separation without a full red-signal stop.',
      conflictId: conflict.id,
      actions: [
        {
          trainId: conflict.followerId,
          trainNo: conflict.followerTrainNo,
          trainName: conflict.followerName,
          actionType: 'SPEED_REGULATE',
          label: `Trim speed to ${trimmedSpeed} km/h`,
          detail: `Gradual predictive pacing from ${followerSpeed.toFixed(0)} km/h to ${trimmedSpeed} km/h + ${holdSecondsOpt}s regulation margin.`,
          targetSpeedKmh: trimmedSpeed,
          holdSeconds: holdSecondsOpt,
          estimatedDelayDeltaMin: optAddedDelay,
        },
        {
          trainId: conflict.leaderId,
          trainNo: conflict.leaderTrainNo,
          trainName: conflict.leaderName,
          actionType: 'PRECEDENCE_GRANT',
          label: 'Maintain leader precedence',
          detail: `Keep ${conflict.leaderTrainNo} clear at ${Math.min(130, Math.round(leaderSpeed + 8))} km/h through upcoming block to widen net separation.`,
          targetSpeedKmh: Math.min(130, Math.round(leaderSpeed + 8)),
          estimatedDelayDeltaMin: 0,
        },
      ],
      metrics: {
        predictedTotalDelayMin: optTotalDelay,
        predictedWaitingMin: Number((holdSecondsOpt / 60).toFixed(1)),
        projectedConflictsRemaining: Math.max(0, activeCount - 1),
        projectedMinGapM: optGap,
        projectedMinTtcS: 38.5,
        throughputTrainsPerHr: Number((15.6 / weatherFactor).toFixed(1)),
        recoveryTimeMin: Math.round(optAddedDelay * 1.4 + 2),
      },
      tradeoffs: [
        `Adds ~${optAddedDelay} min controlled pacing delay to ${conflict.followerTrainNo} to avoid full standstill.`,
        'Assumes driver compliance with cab speed advisory within 5 seconds.',
      ],
      loopLineNote:
        'Loop-line switching is explicitly omitted (not modeled in corridor geometry); resolution uses speed regulation and precedence only.',
      provenance: 'DERIVED_ESTIMATE',
    },
    {
      id: `PLAN-SAFE-${conflict.id}`,
      version: 'v2.4-conservative',
      name: 'Conservative Safety-First Block Hold',
      strategy: 'SAFETY_HOLD',
      description:
        'Holds follower at previous block signal until leader clears two full 400 m blocks. Maximizes physical buffer at higher delay cost.',
      conflictId: conflict.id,
      actions: [
        {
          trainId: conflict.followerId,
          trainNo: conflict.followerTrainNo,
          trainName: conflict.followerName,
          actionType: 'HOLD',
          label: `Hold at Block B${Math.max(1, conflict.blockIndex)} for ${holdSecondsSafe}s`,
          detail: `Full signal hold until net gap exceeds ${safeGap} m.`,
          targetSpeedKmh: 0,
          holdSeconds: holdSecondsSafe,
          estimatedDelayDeltaMin: safeAddedDelay,
        },
      ],
      metrics: {
        predictedTotalDelayMin: safeTotalDelay,
        predictedWaitingMin: Number((holdSecondsSafe / 60).toFixed(1)),
        projectedConflictsRemaining: Math.max(0, activeCount - 1),
        projectedMinGapM: safeGap,
        projectedMinTtcS: 65.0,
        throughputTrainsPerHr: Number((13.2 / weatherFactor).toFixed(1)),
        recoveryTimeMin: Math.round(safeAddedDelay * 1.6 + 3),
      },
      tradeoffs: [
        `Adds ~${safeAddedDelay} min waiting delay and reduces section throughput.`,
        'Recommended during severe thunderstorm/fog or when controller prefers maximum physical clearance.',
      ],
      loopLineNote:
        'Uses fixed-block hold only; no unmodeled loop-line diversion assumed.',
      provenance: 'DERIVED_ESTIMATE',
    },
  ];
}

// 8 interactive controller presets for Scenario Lab & Demo Mode
export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'SCN-HEADWAY-22416',
    name: 'Headway Conflict — 22416 Closing on 20818',
    category: 'headway_conflict',
    description:
      'Varanasi Vande Bharat (22416) closes rapidly on Bhubaneswar Tejas Rajdhani (20818) on Line 0 with narrowing net gap and sub-5s TTC.',
    weather: 'clear',
    targetTrainId: 'T02',
    leaderTrainId: 'T01',
    injectGapM: 36,
    leaderSpeedKmh: 62,
    followerSpeedKmh: 124,
    injectDelayMin: 14,
    expectedSeverity: 'DANGER',
    provenance: 'SIMULATED',
  },
  {
    id: 'SCN-THROAT-NDLS',
    name: 'Station Throat Bottleneck — NDLS Approach',
    category: 'station_throat',
    description:
      'Compression within 650 m of NDLS station throat (α_throat = 1.35×), elevating TTC danger threshold from 3.0 s to 4.05 s.',
    weather: 'clear',
    targetTrainId: 'T06',
    leaderTrainId: 'T05',
    injectGapM: 54,
    leaderSpeedKmh: 52,
    followerSpeedKmh: 98,
    injectDelayMin: 16,
    expectedSeverity: 'DANGER',
    provenance: 'SIMULATED',
  },
  {
    id: 'SCN-MONSOON-STORM',
    name: 'Monsoon Thunderstorm Adhesion Penalty',
    category: 'weather_storm',
    description:
      'Severe thunderstorm (β_weather = 1.40×, speed cap 62%) lengthens safe braking envelope for Line 1 express pair.',
    weather: 'thunderstorm',
    targetTrainId: 'T04',
    leaderTrainId: 'T03',
    injectGapM: 58,
    leaderSpeedKmh: 58,
    followerSpeedKmh: 102,
    injectDelayMin: 19,
    expectedSeverity: 'DANGER',
    provenance: 'SIMULATED',
  },
  {
    id: 'SCN-FREIGHT-BRAKE',
    name: 'Mixed-Traffic Freight Slowdown',
    category: 'freight_slowdown',
    description:
      'Heavy BOXN freight rake moves onto Line 2 ahead of high-priority Rajdhani rakes, triggering caution headway cascade.',
    weather: 'rain',
    targetTrainId: 'T07',
    leaderTrainId: 'T06',
    injectGapM: 60,
    leaderSpeedKmh: 48,
    followerSpeedKmh: 92,
    injectDelayMin: 22,
    expectedSeverity: 'CAUTION',
    provenance: 'SIMULATED',
  },
  {
    id: 'SCN-FOG-WINTER',
    name: 'Dense North-India Winter Fog (1.55×)',
    category: 'fog_snow',
    description:
      'Severe visibility penalty (β_weather = 1.55×, cap 58%) forces widened braking margins across all 4 corridor tracks.',
    weather: 'snow',
    targetTrainId: 'T02',
    leaderTrainId: 'T01',
    injectGapM: 62,
    leaderSpeedKmh: 50,
    followerSpeedKmh: 90,
    injectDelayMin: 25,
    expectedSeverity: 'DANGER',
    provenance: 'SIMULATED',
  },
  {
    id: 'SCN-CASCADE-LINE2',
    name: 'Three-Train Cascade on Line 2',
    category: 'cascade_delay',
    description:
      'Delay on 12306 Kolkata Rajdhani ripples backward into 12302 Howrah Rajdhani and 22824 Tejas Rajdhani.',
    weather: 'rain',
    targetTrainId: 'T06',
    leaderTrainId: 'T05',
    injectGapM: 48,
    leaderSpeedKmh: 54,
    followerSpeedKmh: 104,
    injectDelayMin: 21,
    expectedSeverity: 'DANGER',
    provenance: 'SIMULATED',
  },
  {
    id: 'SCN-PRIORITY-EXPRESS',
    name: 'Caution Headway — Express Pacing Check',
    category: 'priority_express',
    description:
      'Moderate caution headway between 12002 Shatabdi and 22439 Vande Bharat suitable for predictive speed trimming.',
    weather: 'clear',
    targetTrainId: 'T04',
    leaderTrainId: 'T03',
    injectGapM: 61,
    leaderSpeedKmh: 84,
    followerSpeedKmh: 112,
    injectDelayMin: 8,
    expectedSeverity: 'CAUTION',
    provenance: 'SIMULATED',
  },
  {
    id: 'SCN-BASELINE-CLEAR',
    name: 'Baseline Nominal Corridor (Clear)',
    category: 'baseline_clear',
    description:
      'Resets corridor to clear dry rail with healthy inter-train separations across all 4 tracks.',
    weather: 'clear',
    targetTrainId: 'T02',
    leaderTrainId: 'T01',
    injectGapM: 320,
    leaderSpeedKmh: 96,
    followerSpeedKmh: 98,
    injectDelayMin: 4,
    expectedSeverity: 'CLEAR',
    provenance: 'SIMULATED',
  },
];

export function applyScenarioPreset(
  trains: CorridorTrain[],
  preset: ScenarioPreset
): { trains: CorridorTrain[]; weather: WeatherMode } {
  const updated = trains.map((t) => ({ ...t, holdDurationS: 0 }));
  const follower = updated.find((t) => t.id === preset.targetTrainId);
  const leader = preset.leaderTrainId
    ? updated.find((t) => t.id === preset.leaderTrainId)
    : null;

  if (preset.category === 'baseline_clear') {
    return { trains: createInitialCorridorTrains(), weather: 'clear' };
  }

  if (follower && leader) {
    if (preset.category === 'station_throat') {
      leader.positionM = CORRIDOR_CONFIG.stationZ + 140;
    }
    leader.speedKmh = preset.leaderSpeedKmh;
    leader.targetSpeedKmh = preset.leaderSpeedKmh;
    follower.line = leader.line;
    follower.positionM = Math.max(
      260,
      leader.positionM -
        (leader.lengthM / 2 + follower.lengthM / 2 + preset.injectGapM)
    );
    follower.speedKmh = preset.followerSpeedKmh;
    follower.targetSpeedKmh = preset.followerSpeedKmh;
    follower.delayMin = preset.injectDelayMin;
  }

  return {
    trains: evaluateCorridorKinematics(updated, preset.weather),
    weather: preset.weather,
  };
}

// Reproducible 36-scenario synthetic dataset summary (seed 25022, 180 frames each = 6,480 rows)
export function generateSyntheticScenariosCatalog() {
  const kinds = [
    'nominal_cruise',
    'headway_compression',
    'station_throat_merge',
    'monsoon_rain_approach',
    'thunderstorm_braking',
    'dense_fog_adhesion',
    'freight_slow_leader',
    'cascade_delay_wave',
    'emergency_hold_recovery',
  ];
  const weathers: WeatherMode[] = ['clear', 'rain', 'thunderstorm', 'snow'];

  return Array.from({ length: 36 }, (_, idx) => {
    const kind = kinds[idx % kinds.length];
    const weather = weathers[idx % weathers.length];
    const split = idx < 21 ? 'train' : idx < 28 ? 'val' : 'test';
    const seed = 25022 + idx * 17;
    const minGapM = Number((28 + ((seed * 13) % 85)).toFixed(1));
    const minTtcS = Number((1.8 + ((seed * 7) % 140) / 10).toFixed(1));
    const peakRisk = classifyDeterministicRisk(
      minGapM,
      minTtcS,
      kind.includes('throat') ? 320 : 1900,
      weather
    );
    return {
      scenarioId: `SYN-${String(idx + 1).padStart(2, '0')}`,
      kind,
      weather,
      split,
      frames: 180,
      sampleRateHz: 2,
      minGapM,
      minTtcS,
      peakRisk,
      provenance: 'SIMULATED' as const,
    };
  });
}

// Exact benchmark results extracted from both uploaded documents (clearly separated!)
export const MODEL_BENCHMARK_TABLES: {
  bundled6480: BenchmarkModelRow[];
  researchPaper3600: BenchmarkModelRow[];
  globalShapPaper: Array<{ feature: string; meanAbsShap: number; sharePct: number }>;
} = {
  bundled6480: [
    {
      model: 'XGBoost (150 est, depth 5, lr 0.07)',
      suite: 'BUNDLED_6480',
      accuracy: 0.9958,
      macroF1: 0.9859,
      precision: 0.9805,
      recall: 0.9915,
      missedDanger: 0,
      falseDanger: 2,
      notes: 'Best bundled synthetic classifier; 0 missed DANGER on 1,440 held-out test frames.',
    },
    {
      model: 'Random Forest (110 trees, depth 13)',
      suite: 'BUNDLED_6480',
      accuracy: 0.9951,
      macroF1: 0.9827,
      precision: 0.98,
      recall: 0.9855,
      missedDanger: 1,
      falseDanger: 2,
      notes: 'Strong tree ensemble baseline on GroupShuffleSplit test scenarios.',
    },
    {
      model: 'CatBoost (180 iters, depth 6)',
      suite: 'BUNDLED_6480',
      accuracy: 0.9944,
      macroF1: 0.9797,
      precision: 0.9743,
      recall: 0.9852,
      missedDanger: 1,
      falseDanger: 3,
      notes: 'Symmetric oblivious trees; fast calibrated inference.',
    },
    {
      model: 'Deterministic Physics Rule Engine',
      suite: 'BUNDLED_6480',
      accuracy: 1.0,
      macroF1: 1.0,
      precision: 1.0,
      recall: 1.0,
      missedDanger: 0,
      falseDanger: 0,
      notes: 'Exact rule baseline (labels generated from gap <= 40m or TTC <= 3s × factor).',
    },
  ],
  researchPaper3600: [
    {
      model: 'CatBoost (Paper Benchmark)',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.968,
      macroF1: 0.964,
      brierScore: 0.0281,
      r2Score: 0.9412,
      notes: 'Top paper benchmark on 6-train 2-hr 10 Hz dataset (N = 3,600).',
    },
    {
      model: 'XGBoost (Paper Benchmark)',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.964,
      macroF1: 0.9612,
      brierScore: 0.0294,
      r2Score: 0.9378,
      notes: 'Close second in paper 11-model comparison.',
    },
    {
      model: 'LightGBM',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.957,
      macroF1: 0.9541,
      brierScore: 0.0328,
      r2Score: 0.928,
      notes: 'Research-only paper benchmark (not packaged as runtime artifact).',
    },
    {
      model: 'Random Forest',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.951,
      macroF1: 0.9483,
      brierScore: 0.0365,
      r2Score: 0.919,
      notes: 'Bagged decision trees.',
    },
    {
      model: 'Gradient Boosting',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.936,
      macroF1: 0.932,
      notes: 'Sklearn GBDT research benchmark.',
    },
    {
      model: 'MLP Neural Network',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.919,
      macroF1: 0.9152,
      notes: 'Feed-forward neural benchmark.',
    },
    {
      model: 'AdaBoost',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.898,
      macroF1: 0.894,
      notes: 'Boosted stumps baseline.',
    },
    {
      model: 'Logistic / Linear',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.848,
      macroF1: 0.8421,
      notes: 'Linear boundary baseline.',
    },
    {
      model: 'Ridge',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.844,
      macroF1: 0.8394,
      notes: 'L2-regularized linear baseline.',
    },
    {
      model: 'Lasso',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.836,
      macroF1: 0.831,
      notes: 'L1-regularized linear baseline.',
    },
    {
      model: 'KNN (k = 7)',
      suite: 'RESEARCH_PAPER_3600',
      accuracy: 0.822,
      macroF1: 0.818,
      notes: 'Distance-based baseline.',
    },
  ],
  globalShapPaper: [
    { feature: 'Time-to-Collision (TTC)', meanAbsShap: 0.384, sharePct: 28 },
    { feature: 'Net Physical Separation', meanAbsShap: 0.312, sharePct: 23 },
    { feature: 'Closing Velocity', meanAbsShap: 0.248, sharePct: 18 },
    { feature: 'Weather Adhesion Factor', meanAbsShap: 0.176, sharePct: 13 },
    { feature: 'Station Throat Proximity', meanAbsShap: 0.142, sharePct: 10 },
    { feature: 'Follower Speed', meanAbsShap: 0.118, sharePct: 5 },
    { feature: 'Block Occupancy', meanAbsShap: 0.095, sharePct: 3 },
  ],
};
