import { readFile, writeFile, mkdir, readdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { StockPredictor } from "./stock-predictor";

interface ModelMetadata {
  symbol: string;
  trainedAt: string;
  metrics?: {
    r2: number;
    rmse: number;
    mae: number;
    mape: number;
    directionAccuracy: number;
    priceDirectionAccuracy: number;
  };
}

/**
 * Persistent model storage - saves models to disk for long-term persistence
 * Models are shared across all users (not user-dependent)
 */
export class ModelStorage {
  private modelsDir: string;
  private metadataFile: string;

  constructor(modelsDir = ".models") {
    this.modelsDir = path.resolve(process.cwd(), modelsDir);
    this.metadataFile = path.join(this.modelsDir, "metadata.json");
  }

  /**
   * Initialize storage - create directory if needed
   */
  async init(): Promise<void> {
    try {
      if (!existsSync(this.modelsDir)) {
        await mkdir(this.modelsDir, { recursive: true });
      }
    } catch (error) {
      console.error("[model-storage] Failed to initialize:", error);
    }
  }

  /**
   * Get metadata for all models
   */
  private async getMetadata(): Promise<Map<string, ModelMetadata>> {
    try {
      if (!existsSync(this.metadataFile)) {
        return new Map();
      }

      const data = await readFile(this.metadataFile, "utf-8");
      const entries: Array<[string, ModelMetadata]> = JSON.parse(data);
      return new Map(entries);
    } catch (error) {
      console.error("[model-storage] Failed to load metadata:", error);
      return new Map();
    }
  }

  /**
   * Save metadata
   */
  private async saveMetadata(metadata: Map<string, ModelMetadata>): Promise<void> {
    try {
      const entries = Array.from(metadata.entries());
      await writeFile(this.metadataFile, JSON.stringify(entries, null, 2));
    } catch (error) {
      console.error("[model-storage] Failed to save metadata:", error);
    }
  }

  /**
   * Get model directory path for a symbol
   */
  private getModelDir(symbol: string): string {
    return path.join(this.modelsDir, symbol.toUpperCase());
  }

  /**
   * Save a trained model
   */
  async saveModel(symbol: string, predictor: StockPredictor, metrics?: ModelMetadata["metrics"]): Promise<void> {
    try {
      const symbolUpper = symbol.toUpperCase();
      const modelDir = this.getModelDir(symbolUpper);

      // Create model directory
      if (!existsSync(modelDir)) {
        await mkdir(modelDir, { recursive: true });
      }

      // Save LSTM models
      if (predictor.priceModel) {
        await predictor.priceModel.save(path.join(modelDir, "price-model"));
      }
      if (predictor.directionModel) {
        await predictor.directionModel.save(path.join(modelDir, "direction-model"));
      }

      // Save scalers, gradient boosting models, and other data
      const modelData = {
        featureScaler: predictor.featureScaler,
        targetScaler: predictor.targetScaler,
        sequenceLength: predictor.sequenceLength,
        priceChangeThreshold: predictor.priceChangeThreshold,
        featureNames: predictor.featureNames,
        lastData: predictor.lastData,
        lastFeatures: predictor.lastFeatures,
        // Save gradient boosting models (they're serializable)
        gbModel: predictor.gbModel ? {
          trees: predictor.gbModel.trees,
          learningRate: predictor.gbModel.learningRate,
          maxDepth: predictor.gbModel.maxDepth,
          nEstimators: predictor.gbModel.nEstimators,
          initialPrediction: predictor.gbModel.initialPrediction
        } : null,
        metaModel: predictor.metaModel ? {
          trees: predictor.metaModel.trees,
          learningRate: predictor.metaModel.learningRate,
          maxDepth: predictor.metaModel.maxDepth,
          nEstimators: predictor.metaModel.nEstimators,
          initialPrediction: predictor.metaModel.initialPrediction
        } : null,
      };

      await writeFile(
        path.join(modelDir, "model-data.json"),
        JSON.stringify(modelData, null, 2)
      );

      // Update metadata
      const metadata = await this.getMetadata();
      metadata.set(symbolUpper, {
        symbol: symbolUpper,
        trainedAt: new Date().toISOString(),
        metrics,
      });
      await this.saveMetadata(metadata);

      console.log(`[model-storage] Saved model for ${symbolUpper}`);
    } catch (error) {
      console.error(`[model-storage] Failed to save model for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Load a trained model
   */
  async loadModel(symbol: string): Promise<StockPredictor | null> {
    try {
      const symbolUpper = symbol.toUpperCase();
      const modelDir = this.getModelDir(symbolUpper);

      if (!existsSync(modelDir)) {
        return null;
      }

      // Load model data
      const modelDataPath = path.join(modelDir, "model-data.json");
      if (!existsSync(modelDataPath)) {
        return null;
      }

      const modelDataStr = await readFile(modelDataPath, "utf-8");
      const modelData = JSON.parse(modelDataStr);

      // Create predictor instance
      const predictor = new StockPredictor({
        sequenceLength: modelData.sequenceLength,
        priceChangeThreshold: modelData.priceChangeThreshold,
      });

      // Restore scalers and data
      predictor.featureScaler = modelData.featureScaler;
      predictor.targetScaler = modelData.targetScaler;
      predictor.featureNames = modelData.featureNames;
      predictor.lastData = modelData.lastData;
      predictor.lastFeatures = modelData.lastFeatures;

      // Load LSTM models
      const { LSTMPriceModel, LSTMDirectionModel } = await import("./ml-predictor");
      
      const priceModelPath = path.join(modelDir, "price-model");
      if (existsSync(priceModelPath)) {
        predictor.priceModel = new LSTMPriceModel(
          modelData.sequenceLength,
          modelData.featureNames.length
        );
        await predictor.priceModel.load(priceModelPath);
      }

      const directionModelPath = path.join(modelDir, "direction-model");
      if (existsSync(directionModelPath)) {
        predictor.directionModel = new LSTMDirectionModel(
          modelData.sequenceLength,
          modelData.featureNames.length
        );
        await predictor.directionModel.load(directionModelPath);
      }

      // Load gradient boosting models (they're stored in model-data.json)
      const { GradientBoostingRegressor } = await import("./gradient-boosting");
      if (modelData.gbModel) {
        const gbModel = new GradientBoostingRegressor({
          learningRate: modelData.gbModel.learningRate,
          maxDepth: modelData.gbModel.maxDepth,
          nEstimators: modelData.gbModel.nEstimators
        });
        gbModel.trees = modelData.gbModel.trees;
        gbModel.initialPrediction = modelData.gbModel.initialPrediction || 0;
        predictor.gbModel = gbModel;
      }
      if (modelData.metaModel) {
        const metaModel = new GradientBoostingRegressor({
          learningRate: modelData.metaModel.learningRate,
          maxDepth: modelData.metaModel.maxDepth,
          nEstimators: modelData.metaModel.nEstimators
        });
        metaModel.trees = modelData.metaModel.trees;
        metaModel.initialPrediction = modelData.metaModel.initialPrediction || 0;
        predictor.metaModel = metaModel;
      }

      console.log(`[model-storage] Loaded model for ${symbolUpper}`);
      return predictor;
    } catch (error) {
      console.error(`[model-storage] Failed to load model for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get list of all available models
   */
  async listModels(): Promise<ModelMetadata[]> {
    const metadata = await this.getMetadata();
    return Array.from(metadata.values());
  }

  /**
   * Delete a model
   */
  async deleteModel(symbol: string): Promise<void> {
    try {
      const symbolUpper = symbol.toUpperCase();
      const modelDir = this.getModelDir(symbolUpper);

      if (existsSync(modelDir)) {
        // Delete directory recursively
        const files = await readdir(modelDir);
        await Promise.all(
          files.map(file => unlink(path.join(modelDir, file)))
        );
        // Note: In production, use rimraf or similar for recursive deletion
        // For now, we'll just delete files
      }

      // Remove from metadata
      const metadata = await this.getMetadata();
      metadata.delete(symbolUpper);
      await this.saveMetadata(metadata);

      console.log(`[model-storage] Deleted model for ${symbolUpper}`);
    } catch (error) {
      console.error(`[model-storage] Failed to delete model for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Check if model exists
   */
  async modelExists(symbol: string): Promise<boolean> {
    const modelDir = this.getModelDir(symbol.toUpperCase());
    return existsSync(modelDir) && existsSync(path.join(modelDir, "model-data.json"));
  }
}

// Export singleton instance
export const modelStorage = new ModelStorage();
