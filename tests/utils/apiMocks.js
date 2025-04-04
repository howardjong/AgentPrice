/**
 * API Mocks Utility
 * 
 * This module provides utilities for loading and working with API mocks
 * for testing purposes.
 */

import fs from 'fs/promises';
import path from 'path';

// Path to fixtures directory
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures');

/**
 * Ensure the fixtures directory exists
 */
async function ensureFixturesDirectory() {
  try {
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Error creating fixtures directory: ${error.message}`);
    return false;
  }
}

/**
 * Load a fixture file from the fixtures directory
 * 
 * @param {string} fixturePath - Path to the fixture, relative to fixtures directory
 * @returns {Promise<any>} - The parsed fixture data
 */
export async function loadFixture(fixturePath) {
  await ensureFixturesDirectory();
  
  // Make sure subdirectories exist
  const dirPath = path.dirname(path.join(FIXTURES_DIR, fixturePath));
  await fs.mkdir(dirPath, { recursive: true });
  
  const fullPath = path.join(FIXTURES_DIR, fixturePath);
  
  try {
    // Try to load the fixture from disk
    const data = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If the file doesn't exist or can't be parsed, return a default fixture
    console.warn(`Fixture not found at ${fullPath}, using default mock`);
    
    if (fixturePath.includes('claude')) {
      return createDefaultClaudeFixture(fixturePath);
    } else if (fixturePath.includes('perplexity')) {
      return createDefaultPerplexityFixture(fixturePath);
    } else {
      return { message: 'Default mock response', path: fixturePath };
    }
  }
}

/**
 * Save fixture data to the fixtures directory
 * 
 * @param {string} fixturePath - Path to save the fixture, relative to fixtures directory
 * @param {any} data - The data to save
 * @returns {Promise<string>} - The full path where the fixture was saved
 */
export async function saveFixture(fixturePath, data) {
  await ensureFixturesDirectory();
  
  // Make sure subdirectories exist
  const dirPath = path.dirname(path.join(FIXTURES_DIR, fixturePath));
  await fs.mkdir(dirPath, { recursive: true });
  
  const fullPath = path.join(FIXTURES_DIR, fixturePath);
  
  await fs.writeFile(
    fullPath,
    JSON.stringify(data, null, 2),
    'utf8'
  );
  
  return fullPath;
}

/**
 * Create a default Claude API response fixture
 */
function createDefaultClaudeFixture(fixturePath) {
  if (fixturePath.includes('chart')) {
    return {
      id: "msg_01abcdefghijkl",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Here's the chart data you requested:\n\n```json\n{\n  \"chartType\": \"van_westendorp\",\n  \"data\": {\n    \"prices\": [4, 5, 6, 7, 8, 9, 10, 11, 12],\n    \"tooCheap\": [90, 75, 60, 40, 25, 15, 8, 4, 2],\n    \"bargain\": [10, 25, 45, 65, 80, 70, 55, 40, 20],\n    \"tooExpensive\": [5, 10, 20, 35, 55, 75, 85, 92, 97],\n    \"notGoodValue\": [45, 35, 28, 20, 15, 10, 15, 25, 40]\n  },\n  \"insights\": [\n    \"Optimal price point appears to be around $7-$8\",\n    \"Price resistance increases significantly above $9\",\n    \"Below $5 is perceived as too cheap and potentially low quality\",\n    \"The indifference price point is approximately $7.50\"\n  ]\n}\n```\n\nWould you like me to explain these results or suggest a specific pricing strategy based on this data?"
        }
      ],
      model: "claude-3-7-sonnet-20250219",
      stop_reason: "end_turn",
      type: "message"
    };
  } else {
    return {
      id: "msg_01abcdefghijkl",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Based on your coffee business concept and the answers you've provided, I've analyzed the specialty coffee market in the Bay Area. Here are my findings and recommendations for your chemistry-infused coffee business:\n\n## Market Analysis\n\n- The Bay Area specialty coffee market is valued at approximately $1.2 billion annually with 8-9% growth.\n- Premium coffee experiences (>$6/cup) represent about 35% of this market.\n- Your target demographic (25-45 year-old professionals) makes up 65% of specialty coffee consumers.\n- 42% of specialty coffee drinkers report willingness to try \"innovative\" coffee experiences.\n\n## Pricing Strategy\n\nBased on Van Westendorp price sensitivity analysis:\n\n- **Too cheap** (quality concerns): Below $4.50\n- **Bargain** (good value): $5.50-$7.00\n- **Expected price point**: $7.50\n- **Premium** (still acceptable): $8.00-$10.00\n- **Too expensive** (resistance point): Above $11.00\n\nCompetitor pricing:\n- Blue Bottle: $5.25-$6.50 (standard), $7.00-$8.50 (reserve)\n- Philz: $4.75-$6.25 (standard), $6.50-$7.50 (specialty)\n- Sightglass: $5.00-$6.50 (standard), $7.00-$9.00 (limited)\n\n## Recommendations\n\n1. **Tiered pricing strategy**:\n   - Standard infusions: $7.50-$8.50\n   - Premium/seasonal infusions: $9.00-$10.00\n   - Limited edition experiences: $11.00-$12.00\n\n2. **Bundle options** to improve perceived value:\n   - Tasting flights: $15.00 for 3 small infusions\n   - Subscription model: $65.00/month for 10 cups (effective $6.50/cup)\n\n3. **Cost management** to maintain 35% margins:\n   - Optimize labor costs through efficient workflow design\n   - Consider strategic sourcing of specialty beans\n   - Develop reusable infusion methods to reduce per-cup costs\n\nThis pricing strategy positions you firmly in the premium segment, differentiates from competitors, and maintains your required profit margins."
        }
      ],
      model: "claude-3-7-sonnet-20250219",
      stop_reason: "end_turn",
      type: "message"
    };
  }
}

/**
 * Create a default Perplexity API response fixture
 */
function createDefaultPerplexityFixture(fixturePath) {
  if (fixturePath.includes('deep-research')) {
    return {
      id: "chatcmpl-7RyNSG3h8KL9D2K0",
      choices: [
        {
          index: 0,
          message: {
            content: "# Specialty Coffee Business Market Analysis\n\n## Market Overview\n\nThe specialty coffee market in the Bay Area is thriving with estimated annual revenue of $1.2-1.5 billion and projected growth of 7-9% annually through 2028. The premium segment (coffee priced above $5.50 per cup) represents approximately 38% of the market and is growing faster at 11-13% annually.\n\n## Consumer Demographics & Behavior\n\nYour target demographic of coffee connoisseurs and adventurous professionals aged 25-45 makes up approximately 62% of specialty coffee consumers in the Bay Area. Research from the Specialty Coffee Association indicates:\n\n- 68% consume specialty coffee 3+ times weekly\n- 42% explicitly value unique flavor experiences\n- 57% consider themselves \"coffee enthusiasts\" willing to pay premium prices\n- 38% regularly try new coffee shops and innovations\n\n## Competitive Landscape\n\n### Blue Bottle Coffee\n- Market position: Premium established brand\n- Price points: $4.75-$6.50 standard, $7.00-$9.00 reserve\n- Strengths: Brand recognition, consistent quality, minimalist aesthetic\n- Weaknesses: Limited flavor innovation, perceived as corporate since Nestlé acquisition\n\n### Philz Coffee\n- Market position: Customized coffee experience\n- Price points: $4.25-$6.00 standard, $6.50-$8.00 specialty\n- Strengths: Personalization, loyal following, comfortable atmosphere\n- Weaknesses: Inconsistent quality between locations, limited science-based innovation\n\n### Other competitors:\n- Ritual Coffee Roasters: $5.00-$7.00, known for direct trade\n- Sightglass: $5.25-$8.50, emphasizes roasting technique\n- Equator Coffees: $4.75-$7.50, sustainability focus\n\n## Price Sensitivity Analysis\n\n### Van Westendorp Price Sensitivity Model\n- Too cheap (quality concerns): Below $4.50\n- Bargain (good value): $5.50-$7.00\n- Expected price point: $7.50 \n- Premium (still acceptable): $8.00-$10.00\n- Too expensive (resistance point): Above $11.00\n\n### Feature-Price Analysis\n- Basic specialty coffee: $5.00-$6.00 baseline\n- Unique brewing method: +$1.00-$1.50\n- Uncommon bean variety: +$1.00-$2.00\n- Novel flavor infusion: +$1.50-$2.50\n- Limited edition experience: +$3.00-$4.00\n\n## Strategic Recommendations\n\n### Pricing Strategy\n1. **Tiered Pricing Approach:**\n   - Core offerings: $7.50-$8.50\n   - Premium infusions: $9.00-$10.50\n   - Limited edition/experimental: $11.00-$12.00\n\n2. **Subscription Model:**\n   - Monthly subscription at $65-$75 for 10 drinks (effectively $6.50-$7.50 per drink)\n   - Includes early access to new flavors and member-only varieties\n\n3. **Tasting Flights:**\n   - $15-$18 for three small servings of different infusions\n   - Encourages experimentation and higher overall spend\n\n### Marketing Positioning\n1. Position as a **scientific coffee laboratory** rather than just another coffee shop\n2. Emphasize your **unique chemistry-driven innovation** as justification for premium pricing\n3. Create **transparent storytelling** about ingredient sourcing and infusion processes\n\n### Cost Management (to maintain 35% margin)\n1. Optimize batch preparation of infusions to reduce labor costs\n2. Develop relationships with direct-trade coffee suppliers\n3. Create operational efficiencies through specialized equipment\n4. Consider a smaller focused menu rather than extensive offerings\n\n## Market Entry Strategy\n\n1. **Launch with premium positioning** - don't compete on price with established players\n2. Begin with a **pop-up or limited location** to create exclusivity and manage costs\n3. Leverage **social media-worthy presentations** to drive organic marketing\n4. Create a **\"lab membership\"** for early adopters to build community and stable revenue\n\n## Conclusion\n\nThe Bay Area market has demonstrated strong receptivity to premium coffee experiences with scientific or artisanal narratives. Your chemistry-infused coffee concept has significant market potential if positioned correctly. The recommended price points of $7.50-$10.00 for standard offerings and up to $12.00 for premium experiences aligns with market expectations for truly innovative products while maintaining your required 35% profit margin.\n\nSources:\n1. Specialty Coffee Association Market Research Report 2024\n2. Bay Area Food & Beverage Consumption Trends Q1 2025\n3. Premium Coffee Pricing Analysis, Beverage Industry Insights\n4. Coffee Business Quarterly Financial Benchmarks 2024",
            role: "assistant",
            function_call: null
          },
          finish_reason: "stop"
        }
      ],
      created: 1680000000,
      model: "llama-3.1-sonar-large-128k-online",
      sources: [
        {
          title: "Specialty Coffee Association Market Report",
          url: "https://sca.coffee/research/market-reports",
          text: "The specialty coffee segment continues to show robust growth..."
        },
        {
          title: "Bay Area Consumer Trends 2025",
          url: "https://example.com/bay-area-trends",
          text: "Premium experiences in food and beverage continue to outperform..."
        },
        {
          title: "Coffee Business Financial Benchmarks",
          url: "https://example.com/coffee-business-finance",
          text: "Specialty coffee shops maintain gross margins between 28-42%..."
        }
      ]
    };
  } else {
    return {
      id: "chatcmpl-7RyNSG3h8KL9D2K0",
      choices: [
        {
          index: 0,
          message: {
            content: "Based on my research, the specialty coffee market in the Bay Area is estimated at $1.2 billion annually with 8% growth. Premium coffee experiences ($6+ per cup) represent about 35% of this market.\n\nYour target demographic of 25-45 year-old professionals makes up approximately 65% of specialty coffee consumers in the region. Research indicates that 42% of specialty coffee drinkers report willingness to try innovative coffee experiences.\n\nCompetitor pricing shows Blue Bottle at $5.25-$6.50 (standard), $7.00-$8.50 (reserve); Philz at $4.75-$6.25 (standard), $6.50-$7.50 (specialty); and Sightglass at $5.00-$6.50 (standard), $7.00-$9.00 (limited).\n\nFor your chemistry-infused specialty coffee, I recommend a tiered pricing strategy with standard infusions at $7.50-$8.50, premium infusions at $9.00-$10.00, and limited edition experiences at $11.00-$12.00. This positions you in the premium segment, differentiates from competitors, and should maintain your 35% profit margin.",
            role: "assistant",
            function_call: null
          },
          finish_reason: "stop"
        }
      ],
      created: 1680000000,
      model: "llama-3.1-sonar-small-128k-online"
    };
  }
}

/**
 * Create fixtures for Claude and Perplexity responses for testing
 */
export async function createDefaultFixtures() {
  const fixtures = [
    { path: 'claude/standard-response.json', data: createDefaultClaudeFixture('claude/standard-response.json') },
    { path: 'claude/chart-response.json', data: createDefaultClaudeFixture('claude/chart-response.json') },
    { path: 'perplexity/standard-response.json', data: createDefaultPerplexityFixture('perplexity/standard-response.json') },
    { path: 'perplexity/deep-research-response.json', data: createDefaultPerplexityFixture('perplexity/deep-research-response.json') }
  ];
  
  for (const fixture of fixtures) {
    await saveFixture(fixture.path, fixture.data);
  }
  
  return fixtures.map(f => f.path);
}

// Create default fixtures if this file is executed directly
if (process.argv[1] === import.meta.url) {
  createDefaultFixtures()
    .then(paths => {
      console.log('Created default fixtures:');
      paths.forEach(path => console.log(` - ${path}`));
    })
    .catch(error => {
      console.error('Error creating fixtures:', error);
    });
}