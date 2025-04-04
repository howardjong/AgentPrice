/**
 * Mock Services for Workflow Testing
 * 
 * This module provides mock implementations of Claude and Perplexity services
 * for testing workflows without making real API calls.
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Mock implementation of Claude service
 */
const mockClaudeService = {
  /**
   * Generate chart data from research content
   */
  async generateChartData(researchContent, chartType) {
    console.log(`[Mock Claude] Generating ${chartType} chart data from research content...`);

    // Add artificial delay to simulate API call
    await delay(500);

    let data = {};
    let insights = [];

    switch (chartType) {
      case 'basic_bar':
        data = {
          competitors: ['Company A', 'Company B', 'Company C', 'Company D', 'Company E'],
          prices: [120, 145, 95, 156, 110],
          units: 'USD'
        };
        insights = [
          "Company D has the highest price point at $156",
          "Company C offers the lowest price at $95, 39% lower than the highest competitor",
          "The average price across competitors is $125.20"
        ];
        break;

      case 'van_westendorp':
        data = {
          x_values: [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
          too_cheap: [0.95, 0.85, 0.70, 0.55, 0.40, 0.25, 0.15, 0.10, 0.05, 0.01, 0],
          bargain: [0.05, 0.15, 0.35, 0.55, 0.70, 0.60, 0.40, 0.25, 0.15, 0.05, 0],
          expensive: [0.01, 0.05, 0.15, 0.30, 0.45, 0.60, 0.75, 0.85, 0.90, 0.95, 0.99],
          too_expensive: [0, 0.01, 0.05, 0.10, 0.20, 0.35, 0.55, 0.70, 0.85, 0.95, 0.99]
        };
        insights = [
          "Optimal price point is approximately $65",
          "Price stress begins at approximately $80",
          "Acceptable price range is $45-$75"
        ];
        break;

      case 'conjoint':
        data = {
          attributes: ['Battery Life', 'Camera Quality', 'Storage', 'Price', 'Brand'],
          importance: [30, 25, 15, 20, 10],
          part_worths: {
            'Battery Life': {'48h': 30, '36h': 20, '24h': 10},
            'Camera Quality': {'High': 25, 'Medium': 15, 'Low': 5},
            'Storage': {'512GB': 15, '256GB': 10, '128GB': 5},
            'Price': {'$699': 20, '$899': 10, '$1099': 5},
            'Brand': {'Premium': 10, 'Mid-tier': 7, 'Budget': 3}
          }
        };
        insights = [
          "Battery life is the most important feature at 30% importance",
          "Camera quality is the second most important feature at 25% importance",
          "Brand name has the least impact on purchase decisions at 10% importance"
        ];
        break;
    }

    return {
      data,
      insights,
      model: 'claude-3-haiku-20240307',
      usage: {
        input_tokens: 1245,
        output_tokens: 468,
        cost: 0.0
      }
    };
  },

  /**
   * Generate Plotly visualization configuration
   */
  async generatePlotlyVisualization(chartData, chartType, title, description) {
    console.log(`[Mock Claude] Generating Plotly configuration for ${chartType}...`);

    // Add artificial delay to simulate API call
    await delay(300);

    let config = {
      data: [],
      layout: {
        title: title,
        width: 800,
        height: 500
      },
      config: {
        responsive: true
      }
    };

    switch (chartType) {
      case 'basic_bar':
        config.data = [{
          x: chartData.competitors,
          y: chartData.prices,
          type: 'bar',
          marker: {
            color: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
          }
        }];
        config.layout.xaxis = { title: 'Competitors' };
        config.layout.yaxis = { title: `Price (${chartData.units})` };
        break;

      case 'van_westendorp':
        // Too cheap line
        config.data.push({
          x: chartData.x_values,
          y: chartData.too_cheap,
          type: 'scatter',
          mode: 'lines',
          name: 'Too Cheap',
          line: { color: '#1f77b4' }
        });

        // Bargain line
        config.data.push({
          x: chartData.x_values,
          y: chartData.bargain,
          type: 'scatter',
          mode: 'lines',
          name: 'Bargain',
          line: { color: '#2ca02c' }
        });

        // Expensive line
        config.data.push({
          x: chartData.x_values,
          y: chartData.expensive,
          type: 'scatter',
          mode: 'lines',
          name: 'Expensive',
          line: { color: '#ff7f0e' }
        });

        // Too expensive line
        config.data.push({
          x: chartData.x_values,
          y: chartData.too_expensive,
          type: 'scatter',
          mode: 'lines',
          name: 'Too Expensive',
          line: { color: '#d62728' }
        });

        config.layout.xaxis = { title: 'Price ($)' };
        config.layout.yaxis = { title: 'Cumulative Percentage', range: [0, 1] };
        config.pricePoints = {
          optimal: 65,
          indifference: 55,
          stress: 80
        };
        break;

      case 'conjoint':
        // Create bar chart for attribute importance
        config.data.push({
          x: chartData.attributes,
          y: chartData.importance,
          type: 'bar',
          marker: {
            color: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
          },
          name: 'Attribute Importance (%)'
        });

        config.layout.xaxis = { title: 'Attributes' };
        config.layout.yaxis = { title: 'Importance (%)' };

        // Calculate optimal combination
        const optimalCombination = {};
        Object.keys(chartData.part_worths).forEach(attribute => {
          const levels = chartData.part_worths[attribute];
          const bestLevel = Object.keys(levels).reduce((a, b) => 
            levels[a] > levels[b] ? a : b
          );
          optimalCombination[attribute] = bestLevel;
        });

        config.optimalCombination = optimalCombination;
        break;
    }

    return {
      ...config,
      model: 'claude-3-haiku-20240307',
      usage: {
        input_tokens: 752,
        output_tokens: 1241,
        cost: 0.0
      }
    };
  }
};

/**
 * Mock implementation of Perplexity service
 */
const mockPerplexityService = {
  /**
   * Perform deep research on a query
   */
  async performDeepResearch(query, options = {}) {
    console.log(`[Mock Perplexity] Performing ${options.followupQuestions ? 'deep' : 'basic'} research: "${query}"`);

    // Add artificial delay to simulate research
    const baseDelay = options.followupQuestions ? 2000 : 1000;
    await delay(baseDelay);

    // Generate mock content based on query and options
    const model = options.model || 'llama-3.1-sonar-small-128k-online';

    // Load clarifying questions from the test fixture if available
    let clarifyingQuestions = [];
    try {
      const questionsPath = path.join(__dirname, '..', '..', 'vitest', 'workflows', 'tests', 'output', 'clarifying-questions.json');
      const questionsData = await fs.readFile(questionsPath, 'utf8');
      clarifyingQuestions = JSON.parse(questionsData);
    } catch (error) {
      // If file not found, use default questions
      clarifyingQuestions = [
        "What specific aspects of this topic are you most interested in?",
        "Are you looking for recent developments or a historical overview?",
        "Would you like information specific to a particular region or country?",
        "Are you interested in consumer applications or industrial use cases?",
        "Would you like technical details or a more general overview?"
      ];
    }

    // Generate paragraphs based on query keywords
    const keywords = query.toLowerCase().split(' ');
    let paragraphs = [];
    let citations = [];

    // Generate different content based on query type
    if (keywords.includes('renewable') || keywords.includes('energy')) {
      paragraphs = [
        "Recent developments in renewable energy storage have focused on advanced battery technologies. Solid-state batteries represent one of the most promising frontiers, offering higher energy density, improved safety, and longer lifespans compared to traditional lithium-ion batteries. Companies like QuantumScape and Toyota have made significant progress in commercializing these technologies.",

        "Grid-scale storage solutions have seen substantial growth, with flow batteries emerging as a viable option for longer-duration storage needs. These systems, which store energy in liquid electrolytes, can provide power for 8-10 hours compared to the 4-hour capacity typical of lithium-ion installations. Form Energy's iron-air batteries, which can deliver power for up to 100 hours, represent a breakthrough in this space.",

        "Thermal energy storage has gained traction for industrial applications. Molten salt systems, already used in concentrated solar power plants, are being adapted for broader industrial use cases. Antora Energy and Rondo Energy have developed solid materials that can store heat at temperatures above 1000°C, enabling industrial processes to run on renewable electricity.",

        "Mechanical storage solutions continue to evolve beyond traditional pumped hydro. Gravity-based systems from companies like Energy Vault use massive blocks raised and lowered to store and release energy, while compressed air energy storage is finding new implementations in underground caverns and purpose-built containers.",

        "Hydrogen storage, particularly green hydrogen produced using renewable electricity, has seen increasing investment. Innovations in electrolyzers from companies like Nel Hydrogen and ITM Power have reduced costs, while advances in hydrogen storage materials address density and safety concerns."
      ];

      citations = [
        { title: "Advances in Solid-State Battery Technology", url: "https://example.com/solid-state-batteries", publisher: "Energy Science Journal", date: "2025-01-15" },
        { title: "Grid-Scale Storage: Flow Batteries and Beyond", url: "https://example.com/flow-batteries", publisher: "Renewable Energy Today", date: "2024-11-03" },
        { title: "Thermal Energy Storage for Industrial Applications", url: "https://example.com/thermal-storage", publisher: "Industrial Electrification", date: "2025-02-22" },
        { title: "Mechanical Energy Storage: New Approaches", url: "https://example.com/mechanical-storage", publisher: "Power Systems Quarterly", date: "2024-12-05" },
        { title: "Green Hydrogen: Storage Solutions and Challenges", url: "https://example.com/hydrogen-storage", publisher: "Clean Energy Review", date: "2025-03-10" }
      ];
    } else if (keywords.includes('cloud') || keywords.includes('providers')) {
      paragraphs = [
        "The cloud computing market in 2025 continues to be dominated by three major players: Amazon Web Services (AWS), Microsoft Azure, and Google Cloud Platform (GCP). AWS maintains its market leadership with approximately 32% market share, though this represents a slight decrease from previous years as competitors gain ground.",

        "Microsoft Azure has shown the strongest growth rate, increasing its market share to 25% in 2025. This growth has been fueled by Microsoft's strong enterprise relationships, comprehensive hybrid cloud offerings, and significant investments in AI and industry-specific solutions.",

        "Google Cloud Platform holds approximately 12% of the market, continuing its steady growth trajectory. Google's strengths in data analytics, machine learning infrastructure, and open-source engagement have helped it gain traction, particularly among technology companies and organizations with advanced AI requirements.",

        "Alibaba Cloud remains the dominant cloud provider in Asia with 6% global market share, though international expansion has proven challenging amidst regulatory concerns and geopolitical tensions. Its domestic position remains extremely strong, with over 40% of the Chinese cloud market.",

        "Oracle Cloud and IBM Cloud have both found success through specialization. Oracle's focus on database and enterprise applications has secured it 4% market share, while IBM's concentration on hybrid cloud and regulated industries has maintained its 3% share, despite overall market growth."
      ];

      citations = [
        { title: "Cloud Market Share Report 2025", url: "https://example.com/cloud-market-share", publisher: "Technology Market Analysis", date: "2025-03-01" },
        { title: "Microsoft Azure: Growth Strategies and Market Position", url: "https://example.com/azure-growth", publisher: "Enterprise Tech Review", date: "2025-02-15" },
        { title: "Google Cloud in 2025: Strengths and Challenges", url: "https://example.com/gcp-analysis", publisher: "Cloud Computing Insider", date: "2025-01-20" },
        { title: "Alibaba Cloud: International Expansion Challenges", url: "https://example.com/alibaba-cloud", publisher: "Global Tech Monitor", date: "2024-12-10" },
        { title: "Specialized Cloud Providers: Oracle and IBM Strategies", url: "https://example.com/specialized-cloud", publisher: "Enterprise IT Today", date: "2025-02-28" }
      ];
    } else {
      // Generic content for other queries
      paragraphs = [
        "Research indicates significant developments in this field over the past two years. Multiple studies have demonstrated improved efficiency and reduced costs, making these technologies increasingly accessible for both commercial and consumer applications.",

        "Major companies including Technological Innovations Inc. and Future Solutions LLC have invested heavily in research and development, resulting in next-generation products that address previous limitations in scalability and reliability.",

        "Government policies, particularly in North America and Europe, have created favorable conditions for growth through tax incentives and regulatory frameworks that encourage adoption of these emerging technologies.",

        "Consumer adoption has accelerated, with market penetration increasing by 37% since 2023. This trend is expected to continue as awareness grows and products become more user-friendly.",

        "Challenges remain in infrastructure readiness and supply chain resilience, though industry consortiums have formed to address these issues collaboratively."
      ];

      citations = [
        { title: "Industry Growth Report 2025", url: "https://example.com/industry-growth", publisher: "Market Research Quarterly", date: "2025-02-15" },
        { title: "Next-Generation Technology Developments", url: "https://example.com/next-gen-tech", publisher: "Innovation Monitor", date: "2025-01-10" },
        { title: "Policy Impacts on Technology Adoption", url: "https://example.com/policy-impacts", publisher: "Regulatory Affairs Journal", date: "2024-11-28" },
        { title: "Consumer Technology Adoption Trends", url: "https://example.com/consumer-trends", publisher: "Digital Lifestyle Today", date: "2025-03-05" },
        { title: "Infrastructure Challenges and Solutions", url: "https://example.com/infrastructure", publisher: "Technology Implementation Review", date: "2025-02-22" }
      ];
    }

    // Generate follow-up content if enabled
    let followUpContent = "";
    if (options.followupQuestions) {
      await delay(500);
      followUpContent = "\n\nFurther investigation reveals additional important findings:\n\n" +
        "1. Recent academic research from Stanford University and MIT has identified key efficiency improvements that could accelerate commercial viability.\n\n" +
        "2. Regulatory changes in the EU, US, and China are creating divergent compliance requirements, increasing complexity for global operations.\n\n" +
        "3. Venture capital investment in this sector reached $12.4 billion in 2024, a 28% increase over 2023, with particular focus on integration technologies.\n\n" +
        "4. Consumer surveys indicate changing preferences, with 63% of respondents now prioritizing sustainability features over cost considerations.\n\n" +
        "5. Supply chain innovations, including distributed manufacturing and advanced materials sourcing, are reducing production bottlenecks.";
    }

    // Combine content
    const content = paragraphs.join("\n\n") + followUpContent;

    // Mock standard response
    return {
      content,
      citations,
      model,
      usage: {
        prompt_tokens: 350,
        completion_tokens: 1200,
        total_tokens: 1550,
        cost: 0.0
      },
      clarifyingQuestions
    };
  }
};

/**
 * Utility function to create a delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export {
  mockClaudeService,
  mockPerplexityService
};