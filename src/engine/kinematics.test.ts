import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyScenarioPreset,
  buildConflictsFromCorridor,
  buildOptimizationPlans,
  classifyDeterministicRisk,
  computeCounterfactualNoAI,
  computeEnhancedFeatures,
  createInitialCorridorTrains,
  explainPrediction,
  generateSyntheticScenariosCatalog,
  getThresholds,
  MODEL_BENCHMARK_TABLES,
  predictSyntheticRisk,
  SCENARIO_PRESETS,
  stepCorridorSimulation,
} from './kinematics.ts';

describe('RailRaksha Kinematics & Physics Rules', () => {
  it('applies exact station throat (1.35x) and weather multipliers to TTC thresholds', () => {
    const clearFar = getThresholds(2500, 'clear');
    assert.equal(clearFar.throatAlpha, 1.0);
    assert.equal(clearFar.weatherBeta, 1.0);
    assert.equal(clearFar.dangerTtcS, 3.0);
    assert.equal(clearFar.cautionTtcS, 7.0);

    const stormThroat = getThresholds(300, 'thunderstorm');
    assert.equal(stormThroat.throatAlpha, 1.35);
    assert.equal(stormThroat.weatherBeta, 1.4);
    assert.equal(stormThroat.combinedFactor, 1.89);
    assert.equal(stormThroat.dangerTtcS, 5.67);
    assert.equal(stormThroat.cautionTtcS, 13.23);
  });

  it('classifies DANGER, CAUTION, and CLEAR accurately under deterministic rules', () => {
    assert.equal(classifyDeterministicRisk(35, 12, 2000, 'clear'), 'DANGER');
    assert.equal(classifyDeterministicRisk(90, 2.5, 2000, 'clear'), 'DANGER');
    assert.equal(classifyDeterministicRisk(58, 12, 2000, 'clear'), 'CAUTION');
    assert.equal(classifyDeterministicRisk(180, 6.2, 2000, 'clear'), 'CAUTION');
    assert.equal(classifyDeterministicRisk(220, 25, 2000, 'clear'), 'CLEAR');
  });

  it('computes braking-aware safe gap and counterfactual collision warnings', () => {
    const enh = computeEnhancedFeatures(120, 60, 42, 400, 'rain');
    assert.ok(enh.closingVelocityMps > 16);
    assert.ok(enh.safeGapM > 200);
    assert.equal(enh.adaptiveResolution, 'FINE');

    const cf = computeCounterfactualNoAI(42, enh.closingVelocityMps, 120, 'rain');
    assert.equal(cf.projectedCollision, true);
    assert.equal(cf.projectedMinGapM, 0);
  });

  it('initializes all 8 simulator trains and steps positions cleanly', () => {
    const trains = createInitialCorridorTrains();
    assert.equal(trains.length, 8);
    const t02 = trains.find((t) => t.trainNo === '22416');
    assert.ok(t02);
    const stepped = stepCorridorSimulation(trains, 'clear', 2, true);
    const t02Next = stepped.find((t) => t.trainNo === '22416');
    assert.ok(t02Next && t02Next.positionM > t02.positionM);
  });
});

describe('RailRaksha Synthetic ML, SHAP & LIME Explainability', () => {
  it('returns advisory_only synthetic predictions with valid probability simplex', () => {
    const dangerPred = predictSyntheticRisk(
      {
        leader_speed_kmh: 55,
        follower_speed_kmh: 122,
        closing_velocity_mps: 18.6,
        net_gap_m: 34,
        ttc_s: 1.8,
        distance_station_throat_m: 420,
        weather_safety_multiplier: 1.4,
        priority: 5,
        block_occupancy: 1,
        hold_duration_s: 0,
      },
      'xgboost'
    );
    assert.equal(dangerPred.advisoryOnly, true);
    assert.equal(dangerPred.trainedOn, 'SYNTHETIC');
    assert.equal(dangerPred.predictedClass, 'DANGER');
    const sum =
      dangerPred.probabilities.CLEAR +
      dangerPred.probabilities.CAUTION +
      dangerPred.probabilities.DANGER;
    assert.ok(Math.abs(sum - 1) < 0.01);
  });

  it('produces SHAP + LIME attributions and top-3 plain factors', () => {
    const xai = explainPrediction(
      {
        leader_speed_kmh: 60,
        follower_speed_kmh: 118,
        closing_velocity_mps: 16.1,
        net_gap_m: 38,
        ttc_s: 2.36,
        distance_station_throat_m: 500,
        weather_safety_multiplier: 1.25,
        priority: 5,
        block_occupancy: 1,
        hold_duration_s: 0,
      },
      'catboost'
    );
    assert.equal(xai.shapAttributions.length, 10);
    assert.equal(xai.limeAttributions.length, 10);
    assert.equal(xai.top3Factors.length, 3);
    assert.ok(xai.limeLocalR2 > 0.8);
    assert.ok(xai.limitations.length >= 2);
  });

  it('generates 36 reproducible synthetic scenarios and separates benchmark suites', () => {
    const catalog = generateSyntheticScenariosCatalog();
    assert.equal(catalog.length, 36);
    assert.equal(
      catalog.filter((c) => c.split === 'train').length,
      21
    );
    assert.equal(MODEL_BENCHMARK_TABLES.bundled6480.length, 4);
    assert.equal(MODEL_BENCHMARK_TABLES.researchPaper3600.length, 11);
  });

  it('builds optimization plans when a headway conflict scenario is injected', () => {
    const trains = createInitialCorridorTrains();
    const preset = SCENARIO_PRESETS[0];
    const applied = applyScenarioPreset(trains, preset);
    const conflicts = buildConflictsFromCorridor(applied.trains, applied.weather);
    assert.ok(conflicts.length >= 1);
    assert.equal(conflicts[0].severity, 'DANGER');

    const plans = buildOptimizationPlans(applied.trains, conflicts[0], applied.weather);
    assert.equal(plans.length, 3);
    const baseline = plans.find((p) => p.strategy === 'BASELINE')!;
    const optimized = plans.find((p) => p.strategy === 'RAILRAKSHA_OPTIMIZED')!;
    assert.ok(
      optimized.metrics.predictedTotalDelayMin < baseline.metrics.predictedTotalDelayMin
    );
    assert.ok(
      optimized.metrics.projectedMinGapM > baseline.metrics.projectedMinGapM
    );
  });
});
