import {
  FeatureEngineer,
  LSTMPriceModel,
  LSTMDirectionModel,
  MinMaxScaler,
  RobustScaler,
  SequenceBuilder,
  MarketData
} from './ml-predictor';
import { GradientBoostingRegressor } from './gradient-boosting';
import { marketCache } from './cache';

export interface PredictionResult {
  date: string;
  predictedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  direction: 'UP' | 'DOWN' | 'HOLD';
  directionConfidence: number;
  directionProbabilities: {
    DOWN: number;
    UP: number;
    HOLD: number;
  };
}

export interface TrainingMetrics {
  r2: number;
  rmse: number;
  mae: number;
  mape: number;
  directionAccuracy: number;
  priceDirectionAccuracy: number;
}

export class StockPredictor {
  private priceModel: LSTMPriceModel | null = null;
  private directionModel: LSTMDirectionModel | null = null;
  private gbModel: GradientBoostingRegressor | null = null;
  private metaModel: GradientBoostingRegressor | null = null;

  private featureScaler: RobustScaler = new RobustScaler();
  private targetScaler: MinMaxScaler = new MinMaxScaler();

  private sequenceLength: number = 7;
  private priceChangeThreshold: number = 0.015;
  private featureNames: string[] = [];

  private lastData: MarketData[] = [];
  private lastFeatures: number[][] = [];

  constructor(options?: {
    sequenceLength?: number;
    priceChangeThreshold?: number;
  }) {
    if (options?.sequenceLength) this.sequenceLength = options.sequenceLength;
    if (options?.priceChangeThreshold) this.priceChangeThreshold = options.priceChangeThreshold;
  }

  /**
   * Train the complete ensemble model
   */
  async train(
    symbol: string,
    range: string = '1y',
    epochs: number = 80
  ): Promise<TrainingMetrics> {
    console.log(`\n🚀 Training ML Predictor for ${symbol}`);
    console.log('='.repeat(60));

    // Step 1: Fetch historical data
    console.log('📊 Fetching historical data...');
    const history = await marketCache.getHistory(symbol, range, '1d');

    if (history.length < 200) {
      throw new Error(`Insufficient data: ${history.length} days. Need at least 200.`);
    }

    const marketData: MarketData[] = history.map(h => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume
    }));

    // Step 2: Feature engineering
    console.log('🔧 Engineering features...');
    const { features, featureNames, targetPrices, targetDirections, dates } =
      FeatureEngineer.createFeatures(marketData);

    if (!features || features.length === 0) {
      throw new Error('Failed to create features from market data');
    }

    if (!features[0] || features[0].length === 0) {
      throw new Error('Features have invalid structure');
    }

    this.featureNames = featureNames;
    console.log(`   Created ${features.length} samples with ${features[0].length} features`);

    // Store last data for future predictions
    this.lastData = marketData;
    this.lastFeatures = features;

    // Step 3: Train/test split (80/20, no shuffle for time series)
    const splitIdx = Math.floor(features.length * 0.8);
    const XTrainRaw = features.slice(0, splitIdx);
    const XTestRaw = features.slice(splitIdx);
    const yPriceTrain = targetPrices.slice(0, splitIdx);
    const yPriceTest = targetPrices.slice(splitIdx);
    const yDirTrain = targetDirections.slice(0, splitIdx);
    const yDirTest = targetDirections.slice(splitIdx);

    console.log(`   Train: ${XTrainRaw.length}, Test: ${XTestRaw.length}`);

    // Step 4: Scale features
    console.log('⚖️  Scaling features...');
    const XTrainScaled = this.featureScaler.fitTransform(XTrainRaw);
    const XTestScaled = this.featureScaler.transform(XTestRaw);

    // Scale target prices
    const yPriceTrainScaled = this.targetScaler.fitTransform(
      yPriceTrain.map(p => [p])
    ).map(row => row[0]);
    const yPriceTestScaled = this.targetScaler.transform(
      yPriceTest.map(p => [p])
    ).map(row => row[0]);

    // Step 5: Create sequences for LSTM
    console.log('🔄 Creating time sequences...');
    const { X: XTrainSeq, y: yPriceTrainSeq } = SequenceBuilder.createPriceSequences(
      XTrainScaled,
      yPriceTrainScaled,
      this.sequenceLength
    );
    const { X: XTestSeq, y: yPriceTestSeq } = SequenceBuilder.createPriceSequences(
      XTestScaled,
      yPriceTestScaled,
      this.sequenceLength
    );
    const { X: XTrainSeqDir, y: yDirTrainSeq } = SequenceBuilder.createSequences(
      XTrainScaled,
      yDirTrain,
      this.sequenceLength
    );
    const { X: XTestSeqDir, y: yDirTestSeq } = SequenceBuilder.createSequences(
      XTestScaled,
      yDirTest,
      this.sequenceLength
    );

    console.log(`   Sequences created: ${XTrainSeq.length} train, ${XTestSeq.length} test`);

    if (XTrainSeq.length === 0 || XTestSeq.length === 0) {
      throw new Error(`Insufficient sequences: train=${XTrainSeq.length}, test=${XTestSeq.length}. Need more historical data.`);
    }

    // Step 6: Train LSTM price model
    console.log('\n🧠 Training LSTM Price Model...');
    try {
      this.priceModel = new LSTMPriceModel(this.sequenceLength, features[0].length);
      await this.priceModel.train(XTrainSeq, yPriceTrainSeq, XTestSeq, yPriceTestSeq, epochs);
    } catch (error: any) {
      console.error('Error training LSTM price model:', error);
      throw new Error(`LSTM price model training failed: ${error.message || error}`);
    }

    // Step 7: Train LSTM direction model
    console.log('\n🎯 Training LSTM Direction Model...');
    this.directionModel = new LSTMDirectionModel(this.sequenceLength, features[0].length);
    await this.directionModel.train(
      XTrainSeqDir,
      yDirTrainSeq,
      XTestSeqDir,
      yDirTestSeq,
      Math.floor(epochs / 2)
    );

    // Step 8: Train Gradient Boosting model (flattened features)
    console.log('\n🌳 Training Gradient Boosting Model...');
    const XTrainFlat = XTrainScaled.slice(this.sequenceLength); // Match LSTM length
    const yTrainFlat = yPriceTrainScaled.slice(this.sequenceLength);

    this.gbModel = new GradientBoostingRegressor({
      nEstimators: 300,
      learningRate: 0.05,
      maxDepth: 3
    });
    this.gbModel.fit(XTrainFlat, yTrainFlat);

    // Step 9: Train meta-model (stacking ensemble)
    console.log('\n🔗 Training Stacking Ensemble...');
    const lstmPredsTrain = this.priceModel.predict(XTrainSeq);
    const gbPredsTrain = this.gbModel.predict(XTrainFlat);

    const stackedTrain = lstmPredsTrain.map((lstm, i) => [lstm, gbPredsTrain[i]]);
    this.metaModel = new GradientBoostingRegressor({
      nEstimators: 100,
      learningRate: 0.05,
      maxDepth: 3
    });
    this.metaModel.fit(stackedTrain, yTrainFlat);

    // Step 10: Evaluate on test set
    console.log('\n📈 Evaluating Model Performance...');
    const metrics = this.evaluate(XTestSeq, XTestSeqDir, yPriceTestSeq, yDirTestSeq, yPriceTest);

    console.log('\n✅ Training Complete!');
    console.log('='.repeat(60));

    return metrics;
  }

  /**
   * Evaluate model performance
   */
  private evaluate(
    XTest: number[][][],
    XTestDir: number[][][],
    yPriceTestScaled: number[],
    yDirTest: number[][],
    yPriceTestActual: number[]
  ): TrainingMetrics {
    // Get LSTM predictions
    const lstmPreds = this.priceModel!.predict(XTest);

    // Get GB predictions
    const XTestFlat = XTest.map(seq => seq[seq.length - 1]); // Last timestep
    const gbPreds = this.gbModel!.predict(XTestFlat);

    // Get ensemble predictions
    const stacked = lstmPreds.map((lstm, i) => [lstm, gbPreds[i]]);
    const ensemblePreds = this.metaModel!.predict(stacked);

    // Inverse transform
    const predictedPrices = this.targetScaler.inverseTransform(
      ensemblePreds.map(p => [p])
    ).map(row => row[0]);

    const actualPrices = yPriceTestActual.slice(yPriceTestActual.length - predictedPrices.length);

    // Calculate regression metrics
    const n = predictedPrices.length;
    const meanActual = actualPrices.reduce((a, b) => a + b, 0) / n;

    const ssTot = actualPrices.reduce((sum, y) => sum + Math.pow(y - meanActual, 2), 0);
    const ssRes = predictedPrices.reduce(
      (sum, yPred, i) => sum + Math.pow(actualPrices[i] - yPred, 2),
      0
    );
    const r2 = 1 - ssRes / ssTot;

    const rmse = Math.sqrt(ssRes / n);
    const mae = predictedPrices.reduce((sum, yPred, i) => sum + Math.abs(actualPrices[i] - yPred), 0) / n;
    const mape = (predictedPrices.reduce((sum, yPred, i) =>
      sum + Math.abs((actualPrices[i] - yPred) / actualPrices[i]), 0) / n) * 100;

    // Direction accuracy
    const dirPreds = this.directionModel!.predict(XTestDir);
    const dirPredLabels = dirPreds.map(probs => probs.indexOf(Math.max(...probs)));
    const dirTrueLabels = yDirTest.map(probs => probs.indexOf(Math.max(...probs)));
    const dirAccuracy = (dirPredLabels.filter((pred, i) => pred === dirTrueLabels[i]).length / n) * 100;

    // Price-based direction accuracy
    const priceDirections = predictedPrices.slice(1).map((p, i) =>
      p > predictedPrices[i] ? 1 : -1
    );
    const actualDirections = actualPrices.slice(1).map((p, i) =>
      p > actualPrices[i] ? 1 : -1
    );
    const priceDirectionAccuracy =
      (priceDirections.filter((pred, i) => pred === actualDirections[i]).length /
        priceDirections.length) * 100;

    console.log('\n📊 Performance Metrics:');
    console.log(`   R² Score: ${r2.toFixed(4)}`);
    console.log(`   RMSE: $${rmse.toFixed(2)}`);
    console.log(`   MAE: $${mae.toFixed(2)}`);
    console.log(`   MAPE: ${mape.toFixed(2)}%`);
    console.log(`   Direction Accuracy: ${dirAccuracy.toFixed(2)}%`);
    console.log(`   Price Direction Accuracy: ${priceDirectionAccuracy.toFixed(2)}%`);

    return { r2, rmse, mae, mape, directionAccuracy: dirAccuracy, priceDirectionAccuracy };
  }

  /**
   * Predict next N days
   */
  async predictNextDays(symbol: string, days: number = 3): Promise<PredictionResult[]> {
    if (!this.priceModel || !this.directionModel || !this.gbModel || !this.metaModel) {
      throw new Error('Model not trained. Call train() first.');
    }

    console.log(`\n🔮 Predicting next ${days} days for ${symbol}`);

    // Get recent data
    let recentData = this.lastData.slice(-this.sequenceLength - 50); // Extra buffer for feature calc

    const predictions: PredictionResult[] = [];
    const currentDate = new Date(recentData[recentData.length - 1].date);

    for (let day = 0; day < days; day++) {
      // Calculate next trading day (skip weekends)
      let nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      // Prepare features for prediction
      const { features } = FeatureEngineer.createFeatures(recentData);
      const scaledFeatures = this.featureScaler.transform(features);

      // Create sequence
      const sequence = scaledFeatures.slice(-this.sequenceLength);
      const XSeq = [sequence];

      // Get LSTM prediction
      const lstmPred = this.priceModel.predict(XSeq)[0];

      // Get GB prediction
      const XFlat = [sequence[sequence.length - 1]];
      const gbPred = this.gbModel.predict(XFlat)[0];

      // Get ensemble prediction
      const stacked = [[lstmPred, gbPred]];
      const ensemblePred = this.metaModel.predict(stacked)[0];

      // Inverse transform
      const predictedPrice = this.targetScaler.inverseTransformSingle(ensemblePred, 0);

      // Get direction prediction
      const dirProbs = this.directionModel.predict(XSeq)[0];
      const dirClass = dirProbs.indexOf(Math.max(...dirProbs));
      const dirConfidence = Math.max(...dirProbs) * 100;

      const directionLabels = ['DOWN', 'UP', 'HOLD'] as const;
      const direction = directionLabels[dirClass];

      const lastPrice = recentData[recentData.length - 1].close;
      const priceChange = predictedPrice - lastPrice;
      const priceChangePercent = (priceChange / lastPrice) * 100;

      predictions.push({
        date: nextDate.toISOString().split('T')[0],
        predictedPrice,
        priceChange,
        priceChangePercent,
        direction,
        directionConfidence: dirConfidence,
        directionProbabilities: {
          DOWN: dirProbs[0] * 100,
          UP: dirProbs[1] * 100,
          HOLD: dirProbs[2] * 100
        }
      });

      // Create synthetic next day data for iterative prediction
      const nextDayData: MarketData = {
        date: nextDate.toISOString(),
        open: predictedPrice,
        high: predictedPrice * 1.02,
        low: predictedPrice * 0.98,
        close: predictedPrice,
        volume: recentData[recentData.length - 1].volume // Assume same volume
      };

      recentData.push(nextDayData);
      recentData = recentData.slice(-this.sequenceLength - 50); // Keep window
      currentDate.setTime(nextDate.getTime());
    }

    return predictions;
  }

  /**
   * Make a single prediction for today
   */
  async predictToday(symbol: string): Promise<PredictionResult> {
    const predictions = await this.predictNextDays(symbol, 1);
    return predictions[0];
  }
}
