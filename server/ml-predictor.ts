import * as tf from '@tensorflow/tfjs-node';
import { Matrix } from 'ml-matrix';
import { marketCache } from './cache';
import { TechnicalIndicators } from './backtest';

// ================== DATA PREPROCESSING ==================

export class RobustScaler {
  private median: number[] = [];
  private iqr: number[] = [];

  fit(data: number[][]): void {
    const numFeatures = data[0].length;
    this.median = [];
    this.iqr = [];

    for (let f = 0; f < numFeatures; f++) {
      const column = data.map(row => row[f]);
      column.sort((a, b) => a - b);

      const q1 = column[Math.floor(column.length * 0.25)];
      const q3 = column[Math.floor(column.length * 0.75)];
      const med = column[Math.floor(column.length * 0.5)];

      this.median.push(med);
      this.iqr.push(q3 - q1 || 1); // Avoid division by zero
    }
  }

  transform(data: number[][]): number[][] {
    return data.map(row =>
      row.map((val, f) => (val - this.median[f]) / this.iqr[f])
    );
  }

  fitTransform(data: number[][]): number[][] {
    this.fit(data);
    return this.transform(data);
  }
}

export class MinMaxScaler {
  private min: number[] = [];
  private max: number[] = [];

  fit(data: number[][]): void {
    const numFeatures = data[0].length;
    this.min = [];
    this.max = [];

    for (let f = 0; f < numFeatures; f++) {
      const column = data.map(row => row[f]);
      this.min.push(Math.min(...column));
      this.max.push(Math.max(...column));
    }
  }

  transform(data: number[][]): number[][] {
    return data.map(row =>
      row.map((val, f) => {
        const range = this.max[f] - this.min[f];
        return range === 0 ? 0 : (val - this.min[f]) / range;
      })
    );
  }

  fitTransform(data: number[][]): number[][] {
    this.fit(data);
    return this.transform(data);
  }

  inverseTransform(data: number[][]): number[][] {
    return data.map(row =>
      row.map((val, f) => val * (this.max[f] - this.min[f]) + this.min[f])
    );
  }

  inverseTransformSingle(value: number, featureIndex: number = 0): number {
    return value * (this.max[featureIndex] - this.min[featureIndex]) + this.min[featureIndex];
  }
}

// ================== FEATURE ENGINEERING ==================

export interface MarketData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class FeatureEngineer {
  /**
   * Create all technical features matching Python implementation
   */
  static createFeatures(data: MarketData[]): {
    features: number[][];
    featureNames: string[];
    targetPrices: number[];
    targetDirections: number[][];
    dates: string[];
  } {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const opens = data.map(d => d.open);
    const volumes = data.map(d => d.volume);

    // Calculate technical indicators
    const returns = this.calculateReturns(closes);
    const logReturns = this.calculateLogReturns(closes);
    const rsi = TechnicalIndicators.rsi(closes, 14);
    const atr = this.calculateATR(highs, lows, closes, 14);
    const stochastic = this.calculateStochastic(highs, lows, closes, 14);
    const macd = this.calculateMACD(closes);
    const ema12 = TechnicalIndicators.ema(closes, 12);
    const ema26 = TechnicalIndicators.ema(closes, 26);
    const ema50 = TechnicalIndicators.ema(closes, 50);

    // Lag features
    const closeLag1 = [NaN, ...closes.slice(0, -1)];
    const closeLag2 = [NaN, NaN, ...closes.slice(0, -2)];
    const volumeLag1 = [NaN, ...volumes.slice(0, -1)];
    const volumeLag2 = [NaN, NaN, ...volumes.slice(0, -2)];

    // Volatility features
    const volatility = this.calculateRollingStd(returns, 20);

    // Volume features
    const volumeMA = TechnicalIndicators.sma(volumes, 20);
    const volumeRatio = volumes.map((v, i) =>
      volumeMA[i] > 0 ? v / volumeMA[i] : 1
    );

    // Combine all features
    const featureNames = [
      'Returns', 'Log_Returns', 'RSI', 'ATR', 'Stochastic',
      'MACD', 'MACD_Signal', 'MACD_Histogram',
      'EMA12', 'EMA26', 'EMA50',
      'Close_Lag_1', 'Close_Lag_2',
      'Volume_Lag_1', 'Volume_Lag_2',
      'Volatility', 'Volume_Ratio',
      'Trading_Day_Gap', 'Holiday_Indicator'
    ];

    const features: number[][] = [];
    const targetPrices: number[] = [];
    const targetDirections: number[][] = [];
    const validDates: string[] = [];

    // Start from index where all indicators are valid
    const startIdx = 50; // Ensure enough data for all indicators

    for (let i = startIdx; i < data.length - 1; i++) {
      // Trading day gap (simplified - assume 1 day gap normally)
      const tradingDayGap = 0; // Would need actual date parsing
      const holidayIndicator = 0; // Placeholder

      const featureRow = [
        returns[i] || 0,
        logReturns[i] || 0,
        rsi[i] || 50,
        atr[i] || 0,
        stochastic[i] || 50,
        macd.macd[i] || 0,
        macd.signal[i] || 0,
        macd.histogram[i] || 0,
        ema12[i] || closes[i],
        ema26[i] || closes[i],
        ema50[i] || closes[i],
        closeLag1[i] || closes[i],
        closeLag2[i] || closes[i],
        volumeLag1[i] || volumes[i],
        volumeLag2[i] || volumes[i],
        volatility[i] || 0,
        volumeRatio[i] || 1,
        tradingDayGap,
        holidayIndicator
      ];

      // Check for NaN and replace with reasonable defaults
      const cleanFeatures = featureRow.map((val, idx) => {
        if (isNaN(val) || !isFinite(val)) {
          // Use median defaults based on feature type
          if (featureNames[idx].includes('RSI') || featureNames[idx].includes('Stochastic')) return 50;
          if (featureNames[idx].includes('Ratio')) return 1;
          return 0;
        }
        return val;
      });

      features.push(cleanFeatures);
      targetPrices.push(data[i + 1].close);

      // Direction classification (0=down, 1=up, 2=hold)
      const priceChangeThreshold = 0.015; // 1.5%
      const futureReturn = (data[i + 1].close - data[i].close) / data[i].close;
      let direction = 2; // hold
      if (futureReturn > priceChangeThreshold) direction = 1; // up
      else if (futureReturn < -priceChangeThreshold) direction = 0; // down

      // One-hot encode direction
      const directionOneHot = [0, 0, 0];
      directionOneHot[direction] = 1;
      targetDirections.push(directionOneHot);

      validDates.push(data[i].date);
    }

    return { features, featureNames, targetPrices, targetDirections, dates: validDates };
  }

  static calculateReturns(prices: number[]): number[] {
    const returns: number[] = [0];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  static calculateLogReturns(prices: number[]): number[] {
    const returns: number[] = [0];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    return returns;
  }

  static calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const tr: number[] = [];
    for (let i = 0; i < highs.length; i++) {
      if (i === 0) {
        tr.push(highs[i] - lows[i]);
      } else {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(tr1, tr2, tr3));
      }
    }
    return TechnicalIndicators.ema(tr, period);
  }

  static calculateStochastic(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const stoch: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        stoch.push(50); // Default
      } else {
        const windowHigh = Math.max(...highs.slice(i - period + 1, i + 1));
        const windowLow = Math.min(...lows.slice(i - period + 1, i + 1));
        const range = windowHigh - windowLow;
        if (range === 0) {
          stoch.push(50);
        } else {
          stoch.push(100 * (closes[i] - windowLow) / range);
        }
      }
    }
    return stoch;
  }

  static calculateMACD(closes: number[], fast = 12, slow = 26, signal = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const emaFast = TechnicalIndicators.ema(closes, fast);
    const emaSlow = TechnicalIndicators.ema(closes, slow);
    const macd = emaFast.map((f, i) => f - emaSlow[i]);
    const validMacd = macd.filter(v => !isNaN(v));
    const signalLine = TechnicalIndicators.ema(validMacd, signal);

    // Align signal line with macd length
    const alignedSignal = new Array(slow - 1).fill(NaN).concat(signalLine);
    const histogram = macd.map((m, i) =>
      !isNaN(m) && !isNaN(alignedSignal[i]) ? m - alignedSignal[i] : NaN
    );

    return { macd, signal: alignedSignal, histogram };
  }

  static calculateRollingStd(data: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < window - 1) {
        result.push(0);
      } else {
        const slice = data.slice(i - window + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slice.length;
        result.push(Math.sqrt(variance));
      }
    }
    return result;
  }
}

// ================== SEQUENCE CREATION ==================

export class SequenceBuilder {
  static createSequences(
    features: number[][],
    targets: number[][],
    sequenceLength: number
  ): {
    X: number[][][];
    y: number[][];
  } {
    const X: number[][][] = [];
    const y: number[][] = [];

    for (let i = sequenceLength; i < features.length; i++) {
      X.push(features.slice(i - sequenceLength, i));
      y.push(targets[i]);
    }

    return { X, y };
  }

  static createPriceSequences(
    features: number[][],
    prices: number[],
    sequenceLength: number
  ): {
    X: number[][][];
    y: number[];
  } {
    const X: number[][][] = [];
    const y: number[] = [];

    for (let i = sequenceLength; i < features.length; i++) {
      X.push(features.slice(i - sequenceLength, i));
      y.push(prices[i]);
    }

    return { X, y };
  }
}

// ================== LSTM MODEL ==================

/**
 * Custom Huber loss function for TensorFlow.js (smooth differentiable version)
 * Huber loss is robust to outliers, combining MSE for small errors and MAE for large errors
 * Uses smooth approximation with only differentiable operations
 * @param delta - Threshold parameter (default: 1.0)
 */
function huberLoss(delta: number = 1.0): (yTrue: tf.Tensor, yPred: tf.Tensor) => tf.Tensor {
  return (yTrue: tf.Tensor, yPred: tf.Tensor): tf.Tensor => {
    const error = tf.sub(yTrue, yPred);
    const absError = tf.abs(error);
    const squaredError = tf.square(error);
    
    // Smooth Huber loss approximation using only differentiable operations
    // Uses smooth transition between MSE and MAE terms
    // Formula: loss = 0.5 * error^2 * smooth_weight + (delta * |error| - 0.5 * delta^2) * (1 - smooth_weight)
    // where smooth_weight smoothly transitions from 1 to 0 as |error| increases
    
    const deltaTensor = tf.scalar(delta);
    const halfDeltaSq = tf.scalar(0.5 * delta * delta);
    
    // Smooth transition factor using sigmoid-like function
    // When |error| << delta: weight ≈ 1 (use MSE)
    // When |error| >> delta: weight ≈ 0 (use MAE)
    const scaledError = tf.div(absError, deltaTensor);
    // Use smooth approximation: weight = exp(-scaledError^2) or similar
    // Using a smooth step: 1 / (1 + scaledError^2) gives good approximation
    const smoothWeight = tf.div(
      tf.scalar(1),
      tf.add(tf.scalar(1), tf.square(scaledError))
    );
    
    // MSE term: 0.5 * error^2
    const mseTerm = tf.mul(tf.scalar(0.5), squaredError);
    
    // MAE term: delta * |error| - 0.5 * delta^2
    const maeTerm = tf.sub(
      tf.mul(deltaTensor, absError),
      halfDeltaSq
    );
    
    // Smooth combination
    const loss = tf.add(
      tf.mul(mseTerm, smoothWeight),
      tf.mul(maeTerm, tf.sub(tf.scalar(1), smoothWeight))
    );
    
    return tf.mean(loss);
  };
}

export class LSTMPriceModel {
  private model: tf.LayersModel | null = null;
  private sequenceLength: number;
  private numFeatures: number;

  constructor(sequenceLength: number, numFeatures: number) {
    this.sequenceLength = sequenceLength;
    this.numFeatures = numFeatures;
  }

  async build(): Promise<void> {
    try {
      // Ensure TensorFlow.js is ready before building
      await tf.ready();
      
      const input = tf.input({ shape: [this.sequenceLength, this.numFeatures] });

      // LSTM layers matching Python architecture
      let x = tf.layers.lstm({
        units: 16,
        returnSequences: true,
        dropout: 0.2,
        recurrentDropout: 0.2
      }).apply(input) as tf.SymbolicTensor;

      x = tf.layers.lstm({
        units: 8,
        dropout: 0.2,
        recurrentDropout: 0.2
      }).apply(x) as tf.SymbolicTensor;

      x = tf.layers.dense({ units: 8, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
      x = tf.layers.dropout({ rate: 0.3 }).apply(x) as tf.SymbolicTensor;
      const output = tf.layers.dense({ units: 1, activation: 'linear' }).apply(x) as tf.SymbolicTensor;

      this.model = tf.model({ inputs: input, outputs: output });

      // Use meanSquaredError as loss (robust and well-supported)
      // Note: Custom Huber loss had compatibility issues with TensorFlow.js validation
      // meanSquaredError works well for regression tasks and is fully supported
      this.model.compile({
        optimizer: tf.train.adamax(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });
    } catch (error: any) {
      console.error('Error building LSTM model:', error);
      throw new Error(`Failed to build model: ${error.message || error}`);
    }
  }

  async train(
    XTrain: number[][][],
    yTrain: number[],
    XVal: number[][][],
    yVal: number[],
    epochs: number = 80
  ): Promise<void> {
    if (!this.model) await this.build();

    const xTrainTensor = tf.tensor3d(XTrain);
    const yTrainTensor = tf.tensor2d(yTrain, [yTrain.length, 1]);
    const xValTensor = tf.tensor3d(XVal);
    const yValTensor = tf.tensor2d(yVal, [yVal.length, 1]);

    await this.model!.fit(xTrainTensor, yTrainTensor, {
      epochs,
      batchSize: 32,
      validationData: [xValTensor, yValTensor],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`);
          }
        }
      },
      verbose: 0
    });

    xTrainTensor.dispose();
    yTrainTensor.dispose();
    xValTensor.dispose();
    yValTensor.dispose();
  }

  predict(X: number[][][]): number[] {
    if (!this.model) throw new Error('Model not trained');

    const xTensor = tf.tensor3d(X);
    const predictions = this.model.predict(xTensor) as tf.Tensor;
    const results = Array.from(predictions.dataSync());

    xTensor.dispose();
    predictions.dispose();

    return results;
  }

  async save(path: string): Promise<void> {
    if (!this.model) throw new Error('Model not trained');
    await this.model.save(`file://${path}`);
  }

  async load(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
  }
}

export class LSTMDirectionModel {
  private model: tf.LayersModel | null = null;
  private sequenceLength: number;
  private numFeatures: number;

  constructor(sequenceLength: number, numFeatures: number) {
    this.sequenceLength = sequenceLength;
    this.numFeatures = numFeatures;
  }

  async build(): Promise<void> {
    try {
      // Ensure TensorFlow.js is ready before building
      await tf.ready();
      
      const input = tf.input({ shape: [this.sequenceLength, this.numFeatures] });

      let x = tf.layers.lstm({
        units: 12,
        returnSequences: true,
        dropout: 0.2,
        recurrentDropout: 0.2
      }).apply(input) as tf.SymbolicTensor;

      x = tf.layers.lstm({
        units: 4,
        dropout: 0.2,
        recurrentDropout: 0.2
      }).apply(x) as tf.SymbolicTensor;

      x = tf.layers.dense({ units: 6, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
      x = tf.layers.dropout({ rate: 0.3 }).apply(x) as tf.SymbolicTensor;
      const output = tf.layers.dense({ units: 3, activation: 'softmax' }).apply(x) as tf.SymbolicTensor;

      this.model = tf.model({ inputs: input, outputs: output });

      // Categorical crossentropy for classification
      this.model.compile({
        optimizer: tf.train.adamax(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
    } catch (error: any) {
      console.error('Error building LSTM direction model:', error);
      throw new Error(`Failed to build direction model: ${error.message || error}`);
    }
  }

  async train(
    XTrain: number[][][],
    yTrain: number[][],
    XVal: number[][][],
    yVal: number[][],
    epochs: number = 40
  ): Promise<void> {
    if (!this.model) await this.build();

    const xTrainTensor = tf.tensor3d(XTrain);
    const yTrainTensor = tf.tensor2d(yTrain);
    const xValTensor = tf.tensor3d(XVal);
    const yValTensor = tf.tensor2d(yVal);

    await this.model!.fit(xTrainTensor, yTrainTensor, {
      epochs,
      batchSize: 32,
      validationData: [xValTensor, yValTensor],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 5 === 0) {
            console.log(`Direction Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, acc = ${logs?.acc?.toFixed(4)}`);
          }
        }
      },
      verbose: 0
    });

    xTrainTensor.dispose();
    yTrainTensor.dispose();
    xValTensor.dispose();
    yValTensor.dispose();
  }

  predict(X: number[][][]): number[][] {
    if (!this.model) throw new Error('Model not trained');

    const xTensor = tf.tensor3d(X);
    const predictions = this.model.predict(xTensor) as tf.Tensor2D;
    const shape = predictions.shape;
    const data = Array.from(predictions.dataSync());

    xTensor.dispose();
    predictions.dispose();

    // Reshape to 2D array
    const result: number[][] = [];
    for (let i = 0; i < shape[0]; i++) {
      result.push(data.slice(i * 3, (i + 1) * 3));
    }
    return result;
  }

  async save(path: string): Promise<void> {
    if (!this.model) throw new Error('Model not trained');
    await this.model.save(`file://${path}`);
  }

  async load(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
  }
}
