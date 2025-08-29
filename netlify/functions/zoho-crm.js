const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_ACCESS_TOKEN, ZOHO_DOMAIN } = process.env;

// Debug environment variables - safe logging
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('ZOHO_CLIENT_ID:', ZOHO_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('ZOHO_CLIENT_SECRET:', ZOHO_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('ZOHO_ACCESS_TOKEN:', ZOHO_ACCESS_TOKEN ? 'SET' : 'NOT SET');
console.log('ZOHO_DOMAIN:', ZOHO_DOMAIN ? 'SET' : 'NOT SET');
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

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Debug endpoint for GET requests
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        debug: true,
        message: 'Function is working',
        timestamp: new Date().toISOString(),
        envVars: {
          clientId: ZOHO_CLIENT_ID ? 'SET' : 'NOT SET',
          clientSecret: ZOHO_CLIENT_SECRET ? 'SET' : 'NOT SET',
          accessToken: ZOHO_ACCESS_TOKEN ? 'SET' : 'NOT SET',
          domain: ZOHO_DOMAIN ? 'SET' : 'NOT SET'
        }
      })
    };
  }

  // Test endpoint for POST requests
  if (event.httpMethod === 'POST' && event.body && event.body.includes('"action":"test"')) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'POST endpoint is working',
        timestamp: new Date().toISOString()
      })
    };
  }

  // Handle POST requests
  if (event.httpMethod === 'POST') {
    try {
      const { action, data } = JSON.parse(event.body);

      switch (action) {
        case 'updateCRM':
          return await updateCRM(data, headers);
        
        case 'createContact':
          return await createContact(data, headers);
        
        case 'createContactAndMeeting':
          return await createContactAndMeeting(data, headers);
        
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

  // If we get here, it's an unsupported method
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

async function updateCRM(crmData, headers) {
  console.log('=== updateCRM called ===');
  console.log('CRM Data:', crmData);
  
  try {
    let contactId = null;
    let contactFound = false;
    
    // Step 1: Search for existing contact by email
    if (crmData.contactInfo && crmData.contactInfo.email && crmData.contactInfo.email !== 'Not mentioned') {
      console.log('Searching for existing contact with email:', crmData.contactInfo.email);
      
      const searchResponse = await fetch(`https://www.zohoapis.com/crm/v3/Contacts/search?email=${encodeURIComponent(crmData.contactInfo.email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ZOHO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const searchResult = await searchResponse.json();
      console.log('Search result:', searchResult);
      
      if (searchResponse.ok && searchResult.data && searchResult.data.length > 0) {
        contactId = searchResult.data[0].id;
        contactFound = true;
        console.log('Found existing contact:', contactId);
      } else {
        console.log('No existing contact found');
        // Return early with message asking user if they want to create contact
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: false, 
            action: 'ask_user',
            message: 'No existing contact found with this email. Would you like to create a new contact?',
            email: crmData.contactInfo.email
          })
        };
      }
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'No valid email provided for contact search'
        })
      };
    }
    
    // Step 2: Create meeting record (deal) linked to existing contact
    if (contactId && crmData.dealInfo && crmData.dealInfo.dealName) {
      console.log('Creating meeting record (deal) for existing contact:', contactId);
      
      const dealResponse = await fetch('https://www.zohoapis.com/crm/v3/Deals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ZOHO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: [{
            Deal_Name: crmData.dealInfo.dealName,
            Stage: crmData.dealInfo.stage || 'Qualification',
            Probability: crmData.dealInfo.probability || 25,
            Amount: crmData.dealInfo.value || '',
            Closing_Date: crmData.dealInfo.expectedCloseDate && crmData.dealInfo.expectedCloseDate !== 'Not mentioned' && crmData.dealInfo.expectedCloseDate !== 'Next month' ? crmData.dealInfo.expectedCloseDate : '',
            Contact_Name: contactId,
            Description: `Meeting Outcome: ${crmData.meetingOutcome}\n\nPain Points: ${crmData.painPoints.join(', ')}\n\nRequirements: ${crmData.requirements.join(', ')}\n\nBudget Discussion: ${crmData.budgetDiscussion}\n\nCompetition: ${crmData.competition}\n\nDecision Maker: ${crmData.decisionMaker}\n\nNext Follow-up: ${crmData.nextFollowUp}`
          }]
        })
      });
      
      const dealResult = await dealResponse.json();
      
      if (dealResponse.ok) {
        console.log('Meeting record created successfully');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            message: 'Meeting record created successfully for existing contact',
            contactId: contactId,
            dealId: dealResult.data[0].details.id,
            action: 'existing_contact_meeting_record_created'
          })
        };
      } else {
        console.log('Meeting record creation failed:', dealResult);
        return {
          statusCode: dealResponse.status,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Failed to create meeting record',
            zohoError: dealResult
          })
        };
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Contact found and processed',
        contactId: contactId,
        action: 'existing_contact_found'
      })
    };
    
  } catch (error) {
    console.error('CRM update error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error during CRM update' 
      })
    };
  }
}

async function createContactAndMeeting(crmData, headers) {
  console.log('=== createContactAndMeeting called ===');
  console.log('CRM Data:', crmData);
  
  try {
    let contactId = null;
    
    // Create new contact
    if (crmData.contactInfo && crmData.contactInfo.email && crmData.contactInfo.email !== 'Not mentioned') {
      console.log('Creating new contact...');
      
      const fullName = crmData.contactInfo.name || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || 'Unknown';
      
      const contactResponse = await fetch('https://www.zohoapis.com/crm/v3/Contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ZOHO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: [{
            First_Name: firstName,
            Last_Name: lastName,
            Email: crmData.contactInfo.email,
            Phone: crmData.contactInfo.phone || '',
            Title: crmData.contactInfo.title || '',
            Company: crmData.contactInfo.company || ''
          }]
        })
      });
      
      const contactResult = await contactResponse.json();
      
      if (contactResponse.ok) {
        contactId = contactResult.data[0].details.id;
        console.log('New contact created:', contactId);
      } else {
        console.log('Contact creation failed:', contactResult);
        return {
          statusCode: contactResponse.status,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Failed to create contact',
            zohoError: contactResult
          })
        };
      }
    }
    
    // Create meeting record (deal) linked to new contact
    if (contactId && crmData.dealInfo && crmData.dealInfo.dealName) {
      console.log('Creating meeting record (deal) for new contact:', contactId);
      
      const dealResponse = await fetch('https://www.zohoapis.com/crm/v3/Deals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ZOHO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: [{
            Deal_Name: crmData.dealInfo.dealName,
            Stage: crmData.dealInfo.stage || 'Qualification',
            Probability: crmData.dealInfo.probability || 25,
            Amount: crmData.dealInfo.value || '',
            Closing_Date: crmData.dealInfo.expectedCloseDate && crmData.dealInfo.expectedCloseDate !== 'Not mentioned' && crmData.dealInfo.expectedCloseDate !== 'Next month' ? crmData.dealInfo.expectedCloseDate : '',
            Contact_Name: contactId,
            Description: `Meeting Outcome: ${crmData.meetingOutcome}\n\nPain Points: ${crmData.painPoints.join(', ')}\n\nRequirements: ${crmData.requirements.join(', ')}\n\nBudget Discussion: ${crmData.budgetDiscussion}\n\nCompetition: ${crmData.competition}\n\nDecision Maker: ${crmData.decisionMaker}\n\nNext Follow-up: ${crmData.nextFollowUp}`
          }]
        })
      });
      
      const dealResult = await dealResponse.json();
      
      if (dealResponse.ok) {
        console.log('Meeting record created successfully');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            message: 'New contact created and meeting record added successfully',
            contactId: contactId,
            dealId: dealResult.data[0].details.id,
            action: 'new_contact_and_meeting_record_created'
          })
        };
      } else {
        console.log('Meeting record creation failed:', dealResult);
        return {
          statusCode: dealResponse.status,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Failed to create meeting record',
            zohoError: dealResult
          })
        };
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'New contact created successfully',
        contactId: contactId,
        action: 'new_contact_created'
      })
    };
    
  } catch (error) {
    console.error('Contact and meeting creation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error during contact and meeting creation' 
      })
    };
  }
}

async function createContact(contactData, headers) {
  console.log('=== createContact called ===');
  console.log('Contact Data:', contactData);
  console.log('Using ZOHO_ACCESS_TOKEN:', ZOHO_ACCESS_TOKEN ? 'TOKEN SET' : 'TOKEN NOT SET');
  
  try {
    // Log the exact data being sent to Zoho
    const zohoPayload = {
      data: [{
        First_Name: contactData.firstName || '',
        Last_Name: contactData.lastName || '',
        Email: contactData.email || '',
        Phone: contactData.phone || '',
        Title: contactData.title || '',
        Company: contactData.company || ''
      }]
    };
    
    console.log('Sending to Zoho:', JSON.stringify(zohoPayload, null, 2));
    console.log('firstName:', contactData.firstName);
    console.log('lastName:', contactData.lastName);
    
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
      console.log('Contact created successfully in Zoho');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          contactId: result.data[0].details.id,
          message: 'Contact created successfully'
        })
      };
    } else {
      console.log('Zoho API error for contact:', result);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.message || result.details?.api_name || 'Failed to create contact',
          zohoError: result
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
  console.log('=== createDeal called ===');
  console.log('Deal Data:', dealData);
  console.log('Using ZOHO_ACCESS_TOKEN:', ZOHO_ACCESS_TOKEN ? 'TOKEN SET' : 'TOKEN NOT SET');
  
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
            Closing_Date: dealData.expectedCloseDate && dealData.expectedCloseDate !== 'Not mentioned' && dealData.expectedCloseDate !== 'Next month' ? dealData.expectedCloseDate : '',
            Contact_Name: dealData.contactId || '',
            Description: dealData.description || ''
          }]
        })
    });

    const result = await response.json();
    console.log('Zoho API response:', result);
    console.log('Response status:', response.status);
    
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
      console.log('Zoho API error:', result);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: result.message || result.details?.api_name || 'Failed to create deal',
          zohoError: result
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