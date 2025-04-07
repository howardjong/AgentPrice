
/**
 * Gemini model availability checker script
 * Helps determine which models are currently working
 */
const modelChecker = require('./utils/modelAvailabilityChecker');

async function checkAllModels() {
  console.log('🔍 Checking Gemini model availability...');
  
  const modelsToCheck = [
    'gemini-2.5-pro-preview-03-25',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash'
  ];
  
  const results = [];
  
  // Check each model
  for (const model of modelsToCheck) {
    console.log(`\nChecking ${model}...`);
    const result = await modelChecker.checkModelAvailability(model);
    console.log(`Status: ${result.available ? '✅ Available' : '❌ Unavailable'}`);
    console.log(`Message: ${result.message}`);
    
    results.push({
      model,
      available: result.available,
      isOverloaded: result.isOverloaded || false,
      isRateLimited: result.isRateLimited || false,
      message: result.message
    });
  }
  
  // Display summary
  console.log('\n==========================================');
  console.log('📊 GEMINI MODEL AVAILABILITY SUMMARY');
  console.log('==========================================');
  
  const availableModels = results.filter(r => r.available);
  
  console.log(`\nAvailable Models: ${availableModels.length} of ${modelsToCheck.length}`);
  availableModels.forEach(model => {
    console.log(`- ✅ ${model.model}`);
  });
  
  const unavailableModels = results.filter(r => !r.available);
  console.log(`\nUnavailable Models: ${unavailableModels.length} of ${modelsToCheck.length}`);
  unavailableModels.forEach(model => {
    const reason = model.isOverloaded ? '⚠️ Overloaded' : 
                  model.isRateLimited ? '⏱️ Rate Limited' : '❌ Error';
    console.log(`- ${reason} ${model.model}`);
  });
  
  // Find best available model
  const availableModel = await modelChecker.findAvailableModel();
  
  console.log('\n==========================================');
  console.log('RECOMMENDATION');
  console.log('==========================================');
  
  if (availableModel.available) {
    console.log(`✅ Recommended model: ${availableModel.model}`);
    console.log('Command to use this model:');
    console.log(`node test-gemini-folder-review.js src ${availableModel.model}`);
  } else {
    console.log('❌ No models are currently available');
    console.log('Recommendation: Try again later when traffic may be reduced');
  }
}

// Run the check
checkAllModels().catch(error => {
  console.error('Error checking models:', error);
});
