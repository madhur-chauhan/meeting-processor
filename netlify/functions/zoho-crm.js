const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_ACCESS_TOKEN, ZOHO_DOMAIN } = process.env;

// Debug environment variables
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('ZOHO_CLIENT_ID:', ZOHO_CLIENT_ID ? `SET (${ZOHO_CLIENT_ID.substring(0, 10)}...)` : 'NOT SET');
console.log('ZOHO_CLIENT_SECRET:', ZOHO_CLIENT_SECRET ? `SET (${ZOHO_CLIENT_SECRET.substring(0, 10)}...)` : 'NOT SET');
console.log('ZOHO_ACCESS_TOKEN:', ZOHO_ACCESS_TOKEN ? `SET (${ZOHO_ACCESS_TOKEN.substring(0, 10)}...)` : 'NOT SET');
console.log('ZOHO_DOMAIN:', ZOHO_DOMAIN ? `SET (${ZOHO_DOMAIN})` : 'NOT SET');
console.log('=== END ENVIRONMENT VARIABLES DEBUG ===');

exports.handler = async (event, context) => {
  console.log('=== Function handler called ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Request Body:', event.body);
  
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
  };

  // Add debug endpoint
  if (event.httpMethod === 'GET' && event.rawPath && event.rawPath.includes('/debug')) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        debug: true,
        envVars: {
          clientId: ZOHO_CLIENT_ID ? 'SET' : 'NOT SET',
          clientSecret: ZOHO_CLIENT_SECRET ? 'SET' : 'NOT SET',
          accessToken: ZOHO_ACCESS_TOKEN ? 'SET' : 'NOT SET',
          domain: ZOHO_DOMAIN ? 'SET' : 'NOT SET'
        },
        accessTokenPreview: ZOHO_ACCESS_TOKEN ? ZOHO_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT SET'
      })
    };
  }

  // Simple debug endpoint for any GET request
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        debug: true,
        message: 'Function is working',
        envVars: {
          clientId: ZOHO_CLIENT_ID ? 'SET' : 'NOT SET',
          clientSecret: ZOHO_CLIENT_SECRET ? 'SET' : 'NOT SET',
          accessToken: ZOHO_ACCESS_TOKEN ? 'SET' : 'NOT SET',
          domain: ZOHO_DOMAIN ? 'SET' : 'NOT SET'
        },
        accessTokenPreview: ZOHO_ACCESS_TOKEN ? ZOHO_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT SET'
      })
    };
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only try to parse JSON for POST requests
  if (event.httpMethod === 'POST') {
    try {
      const { action, data } = JSON.parse(event.body);

      switch (action) {
        case 'createContact':
          return await createContact(data, headers);
        
        case 'createDeal':
          return await createDeal(data, headers);
        
        case 'searchContact':
          return await searchContact(data, headers);
        
        default:
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action' })
          };
      }
    } catch (error) {
      console.error('Function error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  }
};

async function createContact(contactData, headers) {
  console.log('=== createContact called ===');
  console.log('Contact Data:', contactData);
  console.log('Using ZOHO_ACCESS_TOKEN:', ZOHO_ACCESS_TOKEN ? 'TOKEN SET' : 'TOKEN NOT SET');
  
  try {
    const response = await fetch('https://www.zohoapis.com/crm/v3/Contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZOHO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [{
          First_Name: contactData.firstName || '',
          Last_Name: contactData.lastName || '',
          Email: contactData.email || '',
          Phone: contactData.phone || '',
          Title: contactData.title || '',
          Company: contactData.company || ''
        }]
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          contactId: result.data[0].details.id 
        })
      };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.message || 'Failed to create contact' 
        })
      };
    }
      } catch (error) {
      console.error('Contact creation error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Internal server error during contact creation',
          debug: {
            envVars: {
              clientId: ZOHO_CLIENT_ID ? 'SET' : 'NOT SET',
              accessToken: ZOHO_ACCESS_TOKEN ? 'SET' : 'NOT SET'
            }
          }
        })
      };
    }
}

async function createDeal(dealData, headers) {
  try {
    const response = await fetch('https://www.zohoapis.com/crm/v3/Deals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZOHO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [{
          Deal_Name: dealData.dealName || '',
          Stage: dealData.stage || 'Qualification',
          Probability: dealData.probability || 25,
          Amount: dealData.value || '',
          Closing_Date: dealData.expectedCloseDate || '',
          Contact_Name: dealData.contactId || '',
          Description: dealData.description || ''
        }]
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          dealId: result.data[0].details.id 
        })
      };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.message || 'Failed to create deal' 
        })
      };
    }
  } catch (error) {
    console.error('Deal creation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error during deal creation' 
      })
    };
  }
}

async function searchContact(searchData, headers) {
  try {
    const response = await fetch(`https://www.zohoapis.com/crm/v3/Contacts/search?email=${encodeURIComponent(searchData.email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ZOHO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      const found = result.data && result.data.length > 0;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          found: found,
          contacts: found ? result.data : []
        })
      };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          found: false,
          contacts: [],
          error: result.message || 'Failed to search contacts' 
        })
      };
    }
  } catch (error) {
    console.error('Contact search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        found: false,
        contacts: [],
        error: 'Internal server error during contact search' 
      })
    };
  }
}