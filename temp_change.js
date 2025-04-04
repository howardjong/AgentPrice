      return robustPerplexityClient.execute(async () => {
        return axios.post(API_ENDPOINT, requestData, {
          headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout // Add timeout parameter
        });
