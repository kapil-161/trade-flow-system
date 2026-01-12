// import { Quote, HistoricalDataPoint } from "./yahoo-finance";
import type { RiskAnalytics, PortfolioRiskMetrics, AssetRiskMetrics, CorrelationMatrix } from "../shared/schema";

// Type definitions for data structures
interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Risk-free rate (10-year US Treasury, ~4.5% annual)
const RISK_FREE_RATE = 0.045;
const TRADING_DAYS_PER_YEAR = 252;

interface PortfolioPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  returns: number[]; // Daily returns
  historicalPrices: number[];
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate daily returns from price series
 */
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/**
 * Calculate Value at Risk (VaR) using historical simulation
 */
function calculateVaR(returns: number[], portfolioValue: number, confidence: number): number {
  if (returns.length === 0) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  const varReturn = sortedReturns[index] || 0;

  return Math.abs(varReturn * portfolioValue);
}

/**
 * Calculate Conditional VaR (CVaR / Expected Shortfall)
 */
function calculateCVaR(returns: number[], portfolioValue: number, confidence: number): number {
  if (returns.length === 0) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);

  // Average of all returns worse than VaR
  const tailReturns = sortedReturns.slice(0, index + 1);
  if (tailReturns.length === 0) return 0;

  const avgTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  return Math.abs(avgTailReturn * portfolioValue);
}

/**
 * Calculate downside deviation (semi-deviation)
 */
function calculateDownsideDeviation(returns: number[]): number {
  const negativeReturns = returns.filter(r => r < 0);
  if (negativeReturns.length === 0) return 0;
  return standardDeviation(negativeReturns);
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(prices: number[]): { maxDrawdown: number; currentDrawdown: number; maxDrawdownDuration: number } {
  if (prices.length === 0) {
    return { maxDrawdown: 0, currentDrawdown: 0, maxDrawdownDuration: 0 };
  }

  let maxPrice = prices[0];
  let maxDrawdown = 0;
  let maxDrawdownDuration = 0;
  let currentDrawdownDuration = 0;
  let drawdownStart = 0;

  for (let i = 0; i < prices.length; i++) {
    if (prices[i] > maxPrice) {
      maxPrice = prices[i];
      drawdownStart = i;
      currentDrawdownDuration = 0;
    } else {
      const drawdown = (maxPrice - prices[i]) / maxPrice;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDuration = i - drawdownStart;
      }
      currentDrawdownDuration = i - drawdownStart;
    }
  }

  const currentPrice = prices[prices.length - 1];
  const currentDrawdown = (maxPrice - currentPrice) / maxPrice;

  return {
    maxDrawdown,
    currentDrawdown: currentDrawdown > 0 ? currentDrawdown : 0,
    maxDrawdownDuration,
  };
}

/**
 * Calculate correlation between two return series
 */
function calculateCorrelation(returns1: number[], returns2: number[]): number {
  if (returns1.length === 0 || returns2.length === 0 || returns1.length !== returns2.length) {
    return 0;
  }

  const n = returns1.length;
  const mean1 = returns1.reduce((sum, val) => sum + val, 0) / n;
  const mean2 = returns2.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(sumSq1 * sumSq2);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate beta (sensitivity to market/portfolio)
 */
function calculateBeta(assetReturns: number[], marketReturns: number[]): number {
  if (assetReturns.length === 0 || marketReturns.length === 0 || assetReturns.length !== marketReturns.length) {
    return 1.0;
  }

  const n = assetReturns.length;
  const meanAsset = assetReturns.reduce((sum, val) => sum + val, 0) / n;
  const meanMarket = marketReturns.reduce((sum, val) => sum + val, 0) / n;

  let covariance = 0;
  let marketVariance = 0;

  for (let i = 0; i < n; i++) {
    const assetDiff = assetReturns[i] - meanAsset;
    const marketDiff = marketReturns[i] - meanMarket;
    covariance += assetDiff * marketDiff;
    marketVariance += marketDiff * marketDiff;
  }

  return marketVariance === 0 ? 1.0 : covariance / marketVariance;
}

/**
 * Calculate Sharpe Ratio
 */
function calculateSharpeRatio(returns: number[], volatility: number): number {
  if (volatility === 0) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const annualizedReturn = avgReturn * TRADING_DAYS_PER_YEAR;

  return (annualizedReturn - RISK_FREE_RATE) / volatility;
}

/**
 * Calculate Sortino Ratio (uses downside deviation instead of total volatility)
 */
function calculateSortinoRatio(returns: number[], downsideDeviation: number): number {
  if (downsideDeviation === 0) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const annualizedReturn = avgReturn * TRADING_DAYS_PER_YEAR;
  const annualizedDownsideDeviation = downsideDeviation * Math.sqrt(TRADING_DAYS_PER_YEAR);

  return (annualizedReturn - RISK_FREE_RATE) / annualizedDownsideDeviation;
}

/**
 * Calculate Calmar Ratio (annualized return / max drawdown)
 */
function calculateCalmarRatio(returns: number[], maxDrawdown: number): number {
  if (maxDrawdown === 0) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const annualizedReturn = avgReturn * TRADING_DAYS_PER_YEAR;

  return annualizedReturn / maxDrawdown;
}

/**
 * Calculate Herfindahl Index (concentration risk)
 * Higher values = more concentrated portfolio
 */
function calculateConcentrationRisk(positions: PortfolioPosition[], totalValue: number): number {
  if (totalValue === 0) return 0;

  let sumSquaredWeights = 0;
  for (const position of positions) {
    const weight = (position.quantity * position.currentPrice) / totalValue;
    sumSquaredWeights += weight * weight;
  }

  return sumSquaredWeights;
}

/**
 * Main function to calculate comprehensive risk analytics
 */
export async function calculateRiskAnalytics(
  positions: PortfolioPosition[],
  benchmarkReturns?: number[] // Optional market benchmark (e.g., SPY returns)
): Promise<RiskAnalytics> {
  if (positions.length === 0) {
    throw new Error("No positions to analyze");
  }

  // Calculate portfolio-level metrics
  const totalValue = positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);

  // Calculate portfolio returns (weighted average of asset returns)
  const maxLength = Math.max(...positions.map(p => p.returns.length));
  const portfolioReturns: number[] = [];

  for (let i = 0; i < maxLength; i++) {
    let weightedReturn = 0;
    let totalWeight = 0;

    for (const position of positions) {
      if (i < position.returns.length) {
        const weight = (position.quantity * position.currentPrice) / totalValue;
        weightedReturn += position.returns[i] * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      portfolioReturns.push(weightedReturn / totalWeight);
    }
  }

  // Calculate volatility metrics
  const dailyVol = standardDeviation(portfolioReturns);
  const annualizedVol = dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const downsideDeviation = calculateDownsideDeviation(portfolioReturns);

  // Calculate return metrics
  const avgDailyReturn = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
  const annualizedReturn = avgDailyReturn * TRADING_DAYS_PER_YEAR;
  const cumulativeReturn = portfolioReturns.reduce((product, r) => product * (1 + r), 1) - 1;

  // Calculate VaR and CVaR
  const var95 = calculateVaR(portfolioReturns, totalValue, 0.95);
  const var99 = calculateVaR(portfolioReturns, totalValue, 0.99);
  const cvar95 = calculateCVaR(portfolioReturns, totalValue, 0.95);
  const cvar99 = calculateCVaR(portfolioReturns, totalValue, 0.99);

  // Calculate drawdown metrics
  const portfolioPrices = positions[0]?.historicalPrices.map((_, i) => {
    return positions.reduce((sum, pos) => {
      if (i < pos.historicalPrices.length) {
        return sum + (pos.quantity * pos.historicalPrices[i]);
      }
      return sum;
    }, 0);
  }) || [];

  const drawdownMetrics = calculateMaxDrawdown(portfolioPrices);

  // Calculate risk-adjusted returns
  const sharpeRatio = calculateSharpeRatio(portfolioReturns, annualizedVol);
  const sortinoRatio = calculateSortinoRatio(portfolioReturns, downsideDeviation);
  const calmarRatio = calculateCalmarRatio(portfolioReturns, drawdownMetrics.maxDrawdown);

  // Calculate beta and correlation with benchmark
  let beta = 1.0;
  let alpha = 0;
  let correlation = 0;

  if (benchmarkReturns && benchmarkReturns.length > 0) {
    beta = calculateBeta(portfolioReturns, benchmarkReturns);
    correlation = calculateCorrelation(portfolioReturns, benchmarkReturns);

    const benchmarkAvgReturn = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
    const benchmarkAnnualizedReturn = benchmarkAvgReturn * TRADING_DAYS_PER_YEAR;
    alpha = annualizedReturn - (RISK_FREE_RATE + beta * (benchmarkAnnualizedReturn - RISK_FREE_RATE));
  }

  // Calculate concentration and diversification
  const concentrationRisk = calculateConcentrationRisk(positions, totalValue);

  // Diversification ratio: portfolio vol / weighted average of individual vols
  const weightedAvgVol = positions.reduce((sum, pos) => {
    const weight = (pos.quantity * pos.currentPrice) / totalValue;
    const assetVol = standardDeviation(pos.returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    return sum + (weight * assetVol);
  }, 0);
  const diversificationRatio = weightedAvgVol === 0 ? 1 : annualizedVol / weightedAvgVol;

  // Portfolio-level metrics
  const portfolio: PortfolioRiskMetrics = {
    valueAtRisk: {
      var95,
      var99,
      cvar95,
      cvar99,
    },
    volatility: {
      daily: dailyVol,
      annualized: annualizedVol,
      downsideDeviation: downsideDeviation * Math.sqrt(TRADING_DAYS_PER_YEAR),
    },
    returns: {
      daily: avgDailyReturn,
      annualized: annualizedReturn,
      cumulative: cumulativeReturn,
    },
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown: drawdownMetrics.maxDrawdown,
    currentDrawdown: drawdownMetrics.currentDrawdown,
    maxDrawdownDuration: drawdownMetrics.maxDrawdownDuration,
    beta,
    alpha,
    correlation,
    concentrationRisk,
    diversificationRatio,
  };

  // Calculate individual asset metrics
  const assets: AssetRiskMetrics[] = positions.map(position => {
    const currentValue = position.quantity * position.currentPrice;
    const portfolioWeight = currentValue / totalValue;

    // Asset volatility and returns
    const assetVol = standardDeviation(position.returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    const assetAvgReturn = position.returns.reduce((sum, r) => sum + r, 0) / position.returns.length;
    const assetAnnualizedReturn = assetAvgReturn * TRADING_DAYS_PER_YEAR;

    // Asset beta (relative to portfolio)
    const assetBeta = calculateBeta(position.returns, portfolioReturns);

    // Asset Sharpe ratio
    const assetSharpe = calculateSharpeRatio(position.returns, assetVol);

    // Asset max drawdown
    const assetDrawdown = calculateMaxDrawdown(position.historicalPrices);

    // Marginal VaR contribution (approximate using weight * beta)
    const marginContribution = portfolioWeight * assetBeta;
    const componentVaR = var95 * marginContribution;

    // P&L calculations
    const costBasis = position.quantity * position.avgPrice;
    const unrealizedPnL = currentValue - costBasis;
    const unrealizedPnLPercent = costBasis === 0 ? 0 : (unrealizedPnL / costBasis) * 100;

    return {
      symbol: position.symbol,
      name: position.name,
      portfolioWeight: portfolioWeight * 100,
      marginContribution,
      componentVaR,
      volatility: assetVol,
      beta: assetBeta,
      sharpeRatio: assetSharpe,
      maxDrawdown: assetDrawdown.maxDrawdown,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent,
    };
  });

  // Calculate correlation matrix
  const symbols = positions.map(p => p.symbol);
  const matrix: number[][] = [];

  for (let i = 0; i < positions.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < positions.length; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        const corr = calculateCorrelation(positions[i].returns, positions[j].returns);
        row.push(corr);
      }
    }
    matrix.push(row);
  }

  const correlations: CorrelationMatrix = {
    symbols,
    matrix,
    timestamp: new Date(),
  };

  return {
    portfolio,
    assets,
    correlations,
    calculatedAt: new Date(),
  };
}
