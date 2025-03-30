// Load environment variables from .env file
const loadEnvVariables = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    const text = await response.text();
    
    // Parse .env file content
    const envVariables = {};
    text.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVariables[key.trim()] = value.trim();
      }
    });
    
    return envVariables;
  } catch (error) {
    console.error('Error loading environment variables:', error);
    return {};
  }
};

export { loadEnvVariables }; 