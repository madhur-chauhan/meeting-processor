const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_ACCESS_TOKEN, ZOHO_DOMAIN } = process.env;

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

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
};

async function createContact(contactData, headers) {
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