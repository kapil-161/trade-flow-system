/**
 * Simple Gradient Boosting Regressor
 * Matches scikit-learn's GradientBoostingRegressor for ensemble stacking
 */

interface DecisionTree {
  feature: number;
  threshold: number;
  left: DecisionTree | number;
  right: DecisionTree | number;
}

export class GradientBoostingRegressor {
  private trees: DecisionTree[] = [];
  private learningRate: number;
  private nEstimators: number;
  private maxDepth: number;
  private minSamplesSplit: number;
  private initialPrediction: number = 0;

  constructor(options: {
    nEstimators?: number;
    learningRate?: number;
    maxDepth?: number;
    minSamplesSplit?: number;
  } = {}) {
    this.nEstimators = options.nEstimators || 100;
    this.learningRate = options.learningRate || 0.1;
    this.maxDepth = options.maxDepth || 3;
    this.minSamplesSplit = options.minSamplesSplit || 2;
  }

  fit(X: number[][], y: number[]): void {
    // Initialize with mean
    this.initialPrediction = y.reduce((a, b) => a + b, 0) / y.length;

    // Current predictions start at mean
    let predictions = new Array(y.length).fill(this.initialPrediction);

    // Build trees sequentially
    for (let i = 0; i < this.nEstimators; i++) {
      // Calculate residuals (negative gradient for squared error)
      const residuals = y.map((target, idx) => target - predictions[idx]);

      // Fit tree to residuals
      const tree = this.buildTree(X, residuals, 0);
      this.trees.push(tree as DecisionTree);

      // Update predictions
      const treePredictions = this.predictTree(tree, X);
      predictions = predictions.map((pred, idx) =>
        pred + this.learningRate * treePredictions[idx]
      );

      // Early stopping check (optional)
      if (i % 10 === 0) {
        const mse = residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length;
        if (mse < 0.001) break; // Good enough
      }
    }
  }

  predict(X: number[][]): number[] {
    if (this.trees.length === 0) {
      throw new Error('Model not fitted yet');
    }

    // Start with initial prediction
    let predictions = new Array(X.length).fill(this.initialPrediction);

    // Add contribution from each tree
    for (const tree of this.trees) {
      const treePreds = this.predictTree(tree, X);
      predictions = predictions.map((pred, idx) =>
        pred + this.learningRate * treePreds[idx]
      );
    }

    return predictions;
  }

  private buildTree(X: number[][], y: number[], depth: number): DecisionTree | number {
    // Stopping conditions
    if (depth >= this.maxDepth || y.length < this.minSamplesSplit || this.allSame(y)) {
      // Leaf node: return mean value
      return y.reduce((a, b) => a + b, 0) / y.length;
    }

    // Find best split
    const bestSplit = this.findBestSplit(X, y);

    if (!bestSplit) {
      // No good split found
      return y.reduce((a, b) => a + b, 0) / y.length;
    }

    const { feature, threshold, leftIndices, rightIndices } = bestSplit;

    // Build child nodes recursively
    const leftX = leftIndices.map(i => X[i]);
    const leftY = leftIndices.map(i => y[i]);
    const rightX = rightIndices.map(i => X[i]);
    const rightY = rightIndices.map(i => y[i]);

    const leftChild = this.buildTree(leftX, leftY, depth + 1);
    const rightChild = this.buildTree(rightX, rightY, depth + 1);

    return {
      feature,
      threshold,
      left: leftChild,
      right: rightChild
    };
  }

  private findBestSplit(X: number[][], y: number[]): {
    feature: number;
    threshold: number;
    leftIndices: number[];
    rightIndices: number[];
  } | null {
    let bestGain = -Infinity;
    let bestSplit: any = null;

    const numFeatures = X[0].length;
    const parentVariance = this.calculateVariance(y);

    // Try each feature
    for (let feature = 0; feature < numFeatures; feature++) {
      // Get unique values for this feature
      const valuesSet = new Set(X.map(row => row[feature]));
      const values = Array.from(valuesSet).sort((a, b) => a - b);

      // Try splits between consecutive values
      for (let i = 0; i < Math.min(values.length - 1, 20); i++) {
        const threshold = (values[i] + values[i + 1]) / 2;

        // Split data
        const leftIndices: number[] = [];
        const rightIndices: number[] = [];

        for (let j = 0; j < X.length; j++) {
          if (X[j][feature] <= threshold) {
            leftIndices.push(j);
          } else {
            rightIndices.push(j);
          }
        }

        // Skip if split is too unbalanced
        if (leftIndices.length === 0 || rightIndices.length === 0) continue;

        // Calculate variance reduction
        const leftY = leftIndices.map(idx => y[idx]);
        const rightY = rightIndices.map(idx => y[idx]);

        const leftVariance = this.calculateVariance(leftY);
        const rightVariance = this.calculateVariance(rightY);

        const weightedVariance =
          (leftY.length * leftVariance + rightY.length * rightVariance) / y.length;

        const gain = parentVariance - weightedVariance;

        if (gain > bestGain) {
          bestGain = gain;
          bestSplit = { feature, threshold, leftIndices, rightIndices };
        }
      }
    }

    return bestSplit;
  }

  private predictTree(tree: DecisionTree | number, X: number[][]): number[] {
    return X.map(row => this.predictSingleTree(tree, row));
  }

  private predictSingleTree(tree: DecisionTree | number, x: number[]): number {
    // Leaf node
    if (typeof tree === 'number') {
      return tree;
    }

    // Internal node
    if (x[tree.feature] <= tree.threshold) {
      return this.predictSingleTree(tree.left, x);
    } else {
      return this.predictSingleTree(tree.right, x);
    }
  }

  private calculateVariance(y: number[]): number {
    if (y.length === 0) return 0;
    const mean = y.reduce((a, b) => a + b, 0) / y.length;
    return y.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / y.length;
  }

  private allSame(y: number[]): boolean {
    return y.every(val => val === y[0]);
  }

  getFeatureImportances(numFeatures: number): number[] {
    const importances = new Array(numFeatures).fill(0);

    for (const tree of this.trees) {
      this.accumulateImportances(tree, importances);
    }

    // Normalize
    const sum = importances.reduce((a, b) => a + b, 0);
    return sum > 0 ? importances.map(imp => imp / sum) : importances;
  }

  private accumulateImportances(tree: DecisionTree | number, importances: number[]): void {
    if (typeof tree === 'number') return;

    importances[tree.feature]++;
    this.accumulateImportances(tree.left, importances);
    this.accumulateImportances(tree.right, importances);
  }
}
