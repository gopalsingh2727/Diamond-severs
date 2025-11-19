const connectToDatabase = require('../../config/mongodb/db');
const Conversation = require('../../models/chatbot/conversation');
const ChatSettings = require('../../models/chatbot/chatSettings');
const Reminder = require('../../models/chatbot/reminder');

const {
  withSecurity,
  getCorsHeaders,
  sanitizeChatMessage,
  buildRoleBasedFilter,
  CHAT_RULES
} = require('./security');

const {
  checkOllamaHealth,
  checkModelAvailable,
  generateResponse,
  generateResponseWithData
} = require('./llmService');

const {
  parseCommand,
  parseReminderTime,
  generateHelpText,
  generateUnknownCommandResponse
} = require('./ruleParser');

const { executeToolQuery } = require('./tools');

// ============================================================================
// MAIN CHAT HANDLER
// ============================================================================

/**
 * POST /chat/message - Send a chat message and get response
 */
const sendMessage = async (event, context) => {
  try {
    await connectToDatabase();

    const { user, parsedBody } = event;
    const { message } = parsedBody;

    // Validate message
    let sanitizedMessage;
    try {
      sanitizedMessage = sanitizeChatMessage(message);
    } catch (error) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: error.message
        })
      };
    }

    // Get user's chat settings
    const settings = await ChatSettings.getOrCreate({
      userId: user.userId,
      userRole: user.userRole,
      branchId: user.branchId,
      product27InfinityId: user.product27InfinityId
    });

    // Check if chat is enabled
    if (!settings.isEnabled) {
      return {
        statusCode: 403,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Chat agent is disabled. Enable it in settings.'
        })
      };
    }

    // Get or create today's conversation
    const conversation = await Conversation.findOrCreateForUser({
      userId: user.userId,
      userRole: user.userRole,
      branchId: user.branchId,
      product27InfinityId: user.product27InfinityId,
      assistantName: settings.assistantName,
      voiceGender: settings.voiceGender
    });

    // Add user message to conversation
    await conversation.addMessage('user', sanitizedMessage);

    // Parse the message for commands
    const parsed = parseCommand(sanitizedMessage);
    let responseText = '';
    let responseData = null;

    // Handle based on parse result
    switch (parsed.type) {
      case 'command':
      case 'natural_language':
        // Execute the command
        const result = await executeCommand(parsed.command, parsed.args, user, settings);
        responseText = result.text;
        responseData = result.data;
        break;

      case 'unknown_command':
        responseText = generateUnknownCommandResponse(parsed.command);
        break;

      case 'free_text':
        // Try LLM for free text
        responseText = await handleFreeText(sanitizedMessage, conversation, user, settings);
        break;

      default:
        responseText = 'I didn\'t understand that. Type /help for available commands.';
    }

    // Add assistant response to conversation
    await conversation.addMessage('assistant', responseText);

    // Update statistics
    await settings.incrementMessageCount();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data: {
          response: responseText,
          responseData,
          assistantName: settings.assistantName,
          voiceGender: settings.voiceGender,
          conversationId: conversation._id,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Chat error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to process message'
      })
    };
  }
};

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

/**
 * Execute a parsed command
 */
const executeCommand = async (command, args, user, settings) => {
  const roleFilter = buildRoleBasedFilter(user);

  switch (command) {
    case 'orders':
      return await executeToolQuery('orders', { status: args[0] || 'pending', ...roleFilter }, user);

    case 'machines':
      return await executeToolQuery('machines', { status: args[0], ...roleFilter }, user);

    case 'operators':
      return await executeToolQuery('operators', roleFilter, user);

    case 'analytics':
      return await executeToolQuery('analytics', { period: args[0] || 'today', ...roleFilter }, user);

    case 'remind':
      return await createReminder(args.join(' '), user, settings);

    case 'reminders':
      return await listReminders(user, roleFilter);

    case 'help':
      return { text: generateHelpText(), data: null };

    case 'customers':
      return await executeToolQuery('customers', { search: args[0], ...roleFilter }, user);

    case 'materials':
      return await executeToolQuery('materials', roleFilter, user);

    default:
      return { text: `Command "${command}" is not implemented yet.`, data: null };
  }
};

/**
 * Handle free text with LLM or rule-based fallback
 */
const handleFreeText = async (message, conversation, user, settings) => {
  // First, try to understand common patterns without LLM
  const lowerMessage = message.toLowerCase();

  // Detect if message is in Hindi (contains Devanagari script or Hindi keywords)
  const isHindi = /[\u0900-\u097F]/.test(message) ||
                  /^(kaise|kya|kab|kahan|kaun|kitna|batao|dikhao|madad|help|namaste|dhanyavaad)/i.test(lowerMessage) ||
                  settings?.language === 'hi-IN';

  // Hindi greeting patterns
  if (/^(namaste|namaskar|नमस्ते|नमस्कार|प्रणाम)/.test(lowerMessage) ||
      (isHindi && /^(hi|hello|hey)/.test(lowerMessage))) {
    return `नमस्ते! मैं ${settings.assistantName} हूं, आपका मैन्युफैक्चरिंग असिस्टेंट। आज मैं आपकी कैसे मदद कर सकता/सकती हूं?

**त्वरित कमांड:**
• /orders - ऑर्डर देखें
• /machines - मशीनें देखें
• /analytics - आज की मेट्रिक्स
• /help - सभी कमांड

**आप पूछ सकते हैं:**
• "मशीन कैसे बनाएं?"
• "ऑर्डर कैसे बनाएं?"
• "2+2" (गणना)`;
  }

  // Hindi help patterns
  if (isHindi && /(madad|help|sahayata|मदद|सहायता|kya\s*kar\s*sakte)/i.test(lowerMessage)) {
    return `**मैं इनमें मदद कर सकता/सकती हूं:**

**ऑर्डर प्रबंधन:**
• /orders - लंबित ऑर्डर देखें
• /orders today - आज के ऑर्डर
• /orders completed - पूर्ण ऑर्डर

**मशीन और ऑपरेटर:**
• /machines - मशीन स्थिति
• /operators - ऑपरेटर सूची

**एनालिटिक्स:**
• /analytics - आज की मेट्रिक्स

**रिमाइंडर:**
• remind 3pm स्टॉक चेक करें

**सॉफ्टवेयर मदद:**
• "मशीन कैसे बनाएं?"
• "ऑर्डर कैसे बनाएं?"
• "कस्टमर कैसे जोड़ें?"`;
  }

  // Hindi how-to questions
  if (isHindi && /(kaise|कैसे|banaye|बनाएं|banana|बनाना|add|jode|जोड़े)/i.test(lowerMessage)) {
    // Machine in Hindi
    if (/machine|मशीन/i.test(lowerMessage)) {
      return `**मशीन कैसे बनाएं:**

1. **Menu → Create** पर जाएं
2. **Machine** टैब चुनें
3. विवरण भरें:
   • मशीन का नाम
   • मशीन प्रकार
   • सीरियल नंबर
   • ब्रांच
4. **Save** क्लिक करें

**मशीन एडिट करने के लिए:**
• Menu → Edit → Machines

**टिप्स:**
• ऑपरेटर को मशीन से असाइन करें
• मशीन कैपेसिटी सेट करें`;
    }

    // Order in Hindi
    if (/order|ऑर्डर|आर्डर/i.test(lowerMessage)) {
      return `**ऑर्डर कैसे बनाएं:**

1. **Menu → Create Orders** पर जाएं
2. विवरण भरें:
   • कस्टमर चुनें
   • प्रोडक्ट चुनें
   • मात्रा डालें
   • डिलीवरी तारीख
3. **Create Order** क्लिक करें

**ऑर्डर प्रबंधन:**
• **All Orders** - सभी ऑर्डर देखें
• **Day Book** - दैनिक सारांश
• **Dispatch** - शिपिंग के लिए

**टिप्स:**
• ऑर्डर ऑपरेटर के मोबाइल पर दिखेंगे`;
    }

    // Customer in Hindi
    if (/customer|कस्टमर|ग्राहक/i.test(lowerMessage)) {
      return `**कस्टमर कैसे जोड़ें:**

1. **Menu → Create** पर जाएं
2. **Customer** टैब चुनें
3. विवरण भरें:
   • कस्टमर का नाम
   • कंपनी का नाम
   • फोन नंबर
   • ईमेल
   • पता
   • GST नंबर
4. **Save** क्लिक करें

**कस्टमर एडिट करने के लिए:**
• Menu → Edit → Customers`;
    }

    // Product in Hindi
    if (/product|प्रोडक्ट|उत्पाद/i.test(lowerMessage)) {
      return `**प्रोडक्ट कैसे बनाएं:**

1. **Menu → Create** पर जाएं
2. **Product Catalogue** टैब चुनें
3. विवरण भरें:
   • प्रोडक्ट का नाम
   • प्रोडक्ट प्रकार
   • साइज, रंग
   • GSM/वजन
4. **Save** क्लिक करें

**प्रोडक्ट एडिट करने के लिए:**
• Menu → Edit → Products`;
    }

    // Branch in Hindi
    if (/branch|ब्रांच|शाखा/i.test(lowerMessage)) {
      if (user.userRole === 'manager') {
        return `**ब्रांच बनाना - अनुमति आवश्यक**

माफ़ करें, **Manager** के रूप में आपको ब्रांच बनाने की अनुमति नहीं है।

**केवल Admin या Master Admin ब्रांच बना सकते हैं।**

**Manager के रूप में आप कर सकते हैं:**
• अपनी ब्रांच का विवरण देखें
• अपनी ब्रांच में ऑर्डर प्रबंधित करें
• मशीनें और ऑपरेटर देखें

**नई ब्रांच चाहिए?**
अपने Admin से संपर्क करें।`;
      }

      return `**ब्रांच कैसे बनाएं:**

1. **Menu → Create** पर जाएं
2. **Branch** टैब चुनें
3. विवरण भरें:
   • ब्रांच का नाम
   • ब्रांच कोड
   • पता
   • संपर्क विवरण
4. **Save** क्लिक करें

**नोट:** केवल Admin और Master Admin ब्रांच बना सकते हैं।`;
    }

    // General how-to in Hindi
    return `**सॉफ्टवेयर का उपयोग कैसे करें:**

**मुख्य मेनू:**

1. **Create** - नए आइटम बनाएं
   • मशीन, प्रोडक्ट, ऑर्डर
   • कस्टमर, ऑपरेटर

2. **Edit** - मौजूदा डेटा बदलें

3. **Create Orders** - नए ऑर्डर

4. **Day Book** - दैनिक सारांश

5. **All Orders** - ऑर्डर देखें/प्रबंधित करें

6. **Dispatch** - पूर्ण ऑर्डर शिप करें

7. **Report Dashboard** - रिपोर्ट

**विशिष्ट मदद के लिए पूछें:**
• "मशीन कैसे बनाएं?"
• "ऑर्डर कैसे बनाएं?"`;
  }

  // Hindi troubleshooting
  if (isHindi && /(error|समस्या|problem|dikkat|दिक्कत|kharab|खराब|nahi\s*chal|नहीं\s*चल)/i.test(lowerMessage)) {
    if (/machine|मशीन/i.test(lowerMessage)) {
      return `**मशीन समस्या निवारण:**

**आम समस्याएं:**

1. **मशीन शुरू नहीं हो रही**
   • ऑपरेटर असाइन है या नहीं चेक करें
   • पावर/कनेक्शन देखें
   • Edit → Machines में स्थिति देखें

2. **मशीन में एरर**
   • एरर कोड नोट करें
   • सिस्टम लॉग चेक करें
   • हार्डवेयर समस्या हो तो मेंटेनेंस से संपर्क करें

**त्वरित कमांड:**
• /machines - सभी मशीनों की स्थिति

**समस्या बनी हुई है?**
सिस्टम एडमिनिस्ट्रेटर से संपर्क करें।`;
    }

    if (/order|ऑर्डर/i.test(lowerMessage)) {
      return `**ऑर्डर समस्या निवारण:**

**आम समस्याएं:**

1. **ऑर्डर प्रोसेसिंग में अटका**
   • मशीन उपलब्ध है या नहीं चेक करें
   • ऑपरेटर असाइनमेंट देखें

2. **ऑर्डर नहीं बन रहा**
   • कस्टमर चुना है या नहीं
   • सभी फील्ड भरें

3. **डिस्पैच नहीं हो रहा**
   • ऑर्डर "Completed" होना चाहिए
   • पता भरा होना चाहिए

**त्वरित कमांड:**
• /orders pending - लंबित ऑर्डर`;
    }

    return `**समस्या निवारण:**

कृपया बताएं:
• आप क्या करने की कोशिश कर रहे थे?
• क्या एरर आया?

**मैं इनमें मदद कर सकता/सकती हूं:**
• मशीन की समस्या
• ऑर्डर की समस्या
• डिस्पैच की समस्या
• लॉगिन की समस्या

**त्वरित जांच:**
• पेज रिफ्रेश करें
• इंटरनेट कनेक्शन चेक करें`;
  }

  // Greeting patterns (English)
  if (/^(hi|hello|hey|namaste|good\s*(morning|afternoon|evening))/.test(lowerMessage)) {
    return `Hello! I'm ${settings.assistantName}, your manufacturing assistant. How can I help you today?\n\nQuick commands:\n• /orders - View orders\n• /machines - Check machines\n• /analytics - See today's metrics\n• /help - All commands`;
  }

  // Math calculation patterns (2+2, 10*5, etc.)
  if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(message.trim()) ||
      /^(what\s*is|calculate|solve|compute)?\s*[\d\s\+\-\*\/\.\(\)]+\s*(\?)?$/i.test(message.trim())) {
    try {
      // Extract the math expression
      let expression = message.replace(/what\s*is|calculate|solve|compute|\?/gi, '').trim();

      // Validate expression (only allow safe characters)
      if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expression)) {
        return `I can only calculate basic math expressions with numbers and +, -, *, / operators.`;
      }

      // Safe evaluation using Function (safer than eval)
      const result = Function('"use strict"; return (' + expression + ')')();

      // Check if result is valid
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        // Format result (remove unnecessary decimals)
        const formattedResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(6));
        return `**${expression} = ${formattedResult}**`;
      } else {
        return `Could not calculate: ${expression}`;
      }
    } catch (error) {
      return `Invalid math expression. Please use numbers with +, -, *, / operators.\nExample: 2+2, 10*5, 100/4`;
    }
  }

  // Troubleshooting patterns - must come BEFORE "how to" patterns
  if (/(error|problem|issue|stuck|not\s*working|failed|failing|broken|trouble|wrong|can't|cannot|won't)/i.test(lowerMessage)) {
    // Machine errors
    if (/machine/i.test(lowerMessage)) {
      return `**Machine Troubleshooting:**

**Common Machine Issues:**

1. **Machine Not Starting**
   • Check if machine is assigned to an operator
   • Verify power/connection status
   • Go to **Edit → Machines** to check status

2. **Machine Showing Error**
   • Note the error code/message
   • Check machine logs in system
   • Contact maintenance if hardware issue

3. **Machine Not Appearing**
   • Verify branch assignment
   • Check if machine is active
   • Refresh the page

**Quick Commands:**
• /machines - Check all machine status
• /machines active - View active machines

**Still having issues?**
Contact your system administrator with the error details.`;
    }

    // Order errors
    if (/order/i.test(lowerMessage)) {
      return `**Order Troubleshooting:**

**Common Order Issues:**

1. **Order Stuck at Processing**
   • Check if machine is available
   • Verify operator assignment
   • Go to **All Orders** → Select order → Check status

2. **Cannot Create Order**
   • Ensure customer is selected
   • Check product availability
   • Verify all required fields are filled

3. **Order Not Dispatching**
   • Order must be "Completed" first
   • Check dispatch details are filled
   • Verify delivery address

**Quick Commands:**
• /orders pending - View pending orders
• /orders today - Today's orders

**Need help?** Contact your manager or admin.`;
    }

    // Dispatch errors
    if (/dispatch|delivery|ship/i.test(lowerMessage)) {
      return `**Dispatch Troubleshooting:**

**Common Dispatch Issues:**

1. **Cannot Dispatch Order**
   • Order must be marked as "Completed"
   • Check customer address is filled
   • Verify transport details

2. **Dispatch Button Not Working**
   • Ensure all required fields are complete
   • Check your permissions

**Steps to Dispatch:**
1. Go to **Menu → Dispatch**
2. Select completed orders
3. Fill transport/tracking details
4. Click "Mark as Dispatched"`;
    }

    // Login/Access errors
    if (/login|access|permission|password/i.test(lowerMessage)) {
      return `**Login/Access Troubleshooting:**

**Common Issues:**

1. **Cannot Login**
   • Check username/email spelling
   • Verify password (case-sensitive)
   • Clear browser cache

2. **Permission Denied**
   • Your role may not have access
   • Contact admin for permissions

3. **Forgot Password**
   • Contact your admin to reset password

**For Operators:**
• Use 4-digit PIN to login on mobile`;
    }

    // General error
    return `**Troubleshooting Help:**

I noticed you're having an issue. Please specify:
• What were you trying to do?
• What error message did you see?
• When did this start happening?

**Common issues I can help with:**
• Machine errors - "machine showing error"
• Order problems - "order stuck"
• Dispatch issues - "can't dispatch"
• Login problems - "can't login"

**Quick checks:**
• Refresh the page
• Check your internet connection
• Clear browser cache

**Need more help?** Contact your system administrator.`;
  }

  // Software usage help patterns - "how to" questions
  if (/(how\s*(to|do|can|i)|create|add|make|setup|set\s*up)/i.test(lowerMessage)) {
    // Machine related
    if (/machine/i.test(lowerMessage)) {
      return `**How to Create/Manage Machines:**

1. Go to **Menu → Create**
2. Select **Machine** tab
3. Fill in machine details:
   • Machine Name
   • Machine Type (select from list)
   • Serial Number
   • Branch assignment
4. Click **Save**

**To Edit Machine:**
• Go to **Menu → Edit → Machines**
• Select machine and update details

**Tips:**
• Assign operators to machines for tracking
• Set machine capacity for production planning`;
    }

    // Account/User related
    if (/account|user|manager|admin|operator/i.test(lowerMessage)) {
      // Check if asking specifically about manager/admin creation
      if (/(manager|admin)/i.test(lowerMessage) && user.userRole === 'manager') {
        return `**Create Manager/Admin - Permission Required**

Sorry, as a **Manager** you don't have permission to create Managers or Admins.

**Only Admin or Master Admin can create:**
• New Managers
• New Admins

**What you can create as Manager:**
• Operators (with PIN for mobile login)

**How to Create Operator:**
1. Go to **Menu → Create → Operator**
2. Fill in:
   • Operator Name
   • 4-digit PIN (for mobile login)
   • Assign to Machine
   • Assign to Branch
3. Click **Save**

**Need a new Manager?**
Contact your Admin to create one.`;
      }

      // Role-based response
      if (user.userRole === 'manager') {
        return `**How to Create Users (Manager Access):**

**You can create Operators:**
1. Go to **Menu → Create → Operator**
2. Fill in:
   • Operator Name
   • 4-digit PIN (for mobile login)
   • Assign to Machine
   • Assign to Branch
3. Click **Save**

**Tips:**
• Operators use PIN to log in on mobile
• Assign each operator to specific machines

**Note:** To create Managers or Admins, contact your Admin.`;
      }

      return `**How to Create Accounts/Users:**

**For Manager/Admin:**
1. Go to **Menu → Create**
2. Select **Manager** or **Admin** tab
3. Fill in details:
   • Name, Email, Password
   • Phone Number
   • Assign to Branch
4. Click **Save**

**For Operator:**
1. Go to **Menu → Create → Operator**
2. Fill in:
   • Operator Name
   • 4-digit PIN (for mobile login)
   • Assign to Machine
   • Assign to Branch
3. Click **Save**

**Tips:**
• Operators use PIN to log in on mobile
• Assign each operator to specific machines`;
    }

    // Product/Catalogue related
    if (/product|catalogue|catalog|item/i.test(lowerMessage)) {
      return `**How to Create Products:**

1. Go to **Menu → Create**
2. Select **Product Catalogue** tab
3. Fill in product details:
   • Product Name
   • Product Type
   • Specifications (size, color, etc.)
   • GSM/Weight details
4. Click **Save**

**To Edit Products:**
• Go to **Menu → Edit → Products**
• Select product and modify details

**Product Specifications:**
• Go to **Menu → Create → Product Spec**
• Add detailed specifications for each product`;
    }

    // Order related
    if (/order/i.test(lowerMessage)) {
      return `**How to Create Orders:**

1. Go to **Menu → Create Orders**
2. Fill in order details:
   • Select Customer
   • Select Product from catalogue
   • Enter Quantity
   • Set Due Date
   • Add special instructions
3. Click **Create Order**

**Order Management:**
• **View All Orders:** Menu → All Orders
• **Day Book:** Menu → Day Book (daily summary)
• **Dispatch:** Menu → Dispatch (for shipping)

**Tips:**
• Orders appear in operator's mobile app
• Track progress from All Orders page`;
    }

    // Formula/Calculation related
    if (/formula|calculation|calculate|gsm|weight/i.test(lowerMessage)) {
      return `**How to Use Formulas/Calculations:**

**For Plastic Bag Calculations:**
The system calculates based on:
• Length × Width × Thickness
• GSM (grams per square meter)
• Material density

**Creating Formula:**
1. Go to **Menu → Create → Formula**
2. Define:
   • Formula name
   • Material type
   • Calculation method
3. Save formula

**Using Calculations:**
• Calculations auto-apply when creating orders
• Based on product specifications
• Considers wastage percentages`;
    }

    // Customer related
    if (/customer|client|buyer/i.test(lowerMessage)) {
      return `**How to Create Customers:**

1. Go to **Menu → Create**
2. Select **Customer** tab
3. Fill in details:
   • Customer Name
   • Company Name
   • Contact Number
   • Email
   • Address (for delivery)
   • GST Number (optional)
4. Click **Save**

**To Edit Customer:**
• Go to **Menu → Edit → Customers**
• Update customer information

**Tips:**
• Customers appear in dropdown when creating orders
• Address is used for dispatch labels`;
    }

    // Branch related
    if (/branch|location|factory/i.test(lowerMessage)) {
      // Check user role - only Admin and Master Admin can create branches
      if (user.userRole === 'manager') {
        return `**Branch Creation - Permission Required**

Sorry, as a **Manager** you don't have permission to create branches.

**Only Admin or Master Admin can create branches.**

**What you can do as Manager:**
• View your assigned branch details
• Manage orders within your branch
• View machines and operators in your branch
• Access branch reports

**Need a new branch?**
Contact your Admin to create a new branch for you.`;
      }

      return `**How to Create Branch:**

1. Go to **Menu → Create**
2. Select **Branch** tab
3. Fill in:
   • Branch Name
   • Branch Code
   • Address
   • Contact details
4. Click **Save**

**Branch Management:**
• Each branch has its own machines, operators, orders
• Managers are assigned to specific branches
• Reports can be filtered by branch

**Note:** Only Admin and Master Admin can create branches.`;
    }

    // Material related
    if (/material|raw\s*material|inventory|stock/i.test(lowerMessage)) {
      return `**How to Manage Materials:**

**Add Material Type:**
1. Go to **Menu → Create → Material Type**
2. Enter material name and properties

**Add Material:**
1. Go to **Menu → Create → Material**
2. Select material type
3. Enter quantity, unit price
4. Assign to branch

**Tips:**
• Track material usage in production
• Set reorder levels for alerts`;
    }

    // Report/Analytics related
    if (/report|analytics|dashboard|statistics/i.test(lowerMessage)) {
      return `**How to Use Reports & Analytics:**

**Report Dashboard:**
• Go to **Menu → Report Dashboard**
• View production metrics, order status
• Filter by date range, branch

**Available Reports:**
• Daily production summary
• Order completion rates
• Machine utilization
• Operator performance

**Chat Commands:**
• /analytics - Today's metrics
• /orders today - Today's orders
• /machines - Machine status`;
    }

    // Dispatch related
    if (/dispatch|ship|delivery|send/i.test(lowerMessage)) {
      return `**How to Dispatch Orders:**

1. Go to **Menu → Dispatch**
2. Select completed orders
3. Enter dispatch details:
   • Transport method
   • Tracking number
   • Delivery date
4. Mark as dispatched

**Tips:**
• Only completed orders can be dispatched
• Print delivery labels from dispatch page
• Track delivery status`;
    }
  }

  // General "how to use" the software
  if (/(how\s*(to\s*)?use|guide|tutorial|learn|start)/i.test(lowerMessage)) {
    return `**Quick Start Guide:**

**Main Menu Options:**

1. **Create** - Add new items
   • Machines, Products, Orders
   • Customers, Operators, Materials

2. **Edit** - Modify existing data

3. **Create Orders** - New production orders

4. **Day Book** - Daily summary

5. **All Orders** - View/manage orders

6. **Dispatch** - Ship completed orders

7. **Account** - Your profile settings

8. **Report Dashboard** - Analytics & reports

**Need specific help?** Ask me:
• "How to create a machine?"
• "How to create an order?"
• "How to add a customer?"
• "How to use formulas?"`;
  }

  // Status/update patterns
  if (/(status|update|how\s*(many|much)|show\s*me|what\s*(is|are))/.test(lowerMessage)) {
    if (/order/.test(lowerMessage)) {
      return `To check orders, use:\n• /orders - All pending orders\n• /orders completed - Completed orders\n• /orders today - Today's orders`;
    }
    if (/machine/.test(lowerMessage)) {
      return `To check machines, use:\n• /machines - All machines\n• /machines active - Active machines`;
    }
    if (/operator/.test(lowerMessage)) {
      return `To check operators, use:\n• /operators - List all operators`;
    }
  }

  // Reminder patterns - actually create the reminder
  if (/^remind\s+/i.test(lowerMessage)) {
    // Extract the reminder text (remove "remind" prefix)
    const reminderText = message.replace(/^remind\s+/i, '').trim();
    if (reminderText) {
      const result = await createReminder(reminderText, user, settings);
      return result.text;
    }
    return `To set a reminder:\nremind [time] [message]\n\nExamples:\n• remind 3pm check stock\n• remind tomorrow review orders\n• remind 30m call supplier`;
  }

  // Just asking about reminders
  if (/reminder|alert|notify/.test(lowerMessage)) {
    return `To set a reminder:\nremind [time] [message]\n\nExamples:\n• remind 3pm check stock\n• remind tomorrow review orders\n• remind 30m call supplier`;
  }

  // Help patterns
  if (/help|what can you|how to|commands/.test(lowerMessage)) {
    return generateHelpText();
  }

  // Check if Ollama is available for more complex queries
  const ollamaHealth = await checkOllamaHealth();

  if (!ollamaHealth.available) {
    // Better fallback response
    return `I understand you're asking about "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"\n\nI can help with these commands:\n• /orders - View pending orders\n• /machines - Check machine status\n• /operators - List operators\n• /analytics - Today's metrics\n• /remind [time] [msg] - Set reminder\n• /help - All available commands`;
  }

  // Check if model is available
  const modelCheck = await checkModelAvailable();
  if (!modelCheck.available) {
    return `I'm in basic mode right now. Here's what I can help with:\n\n${generateHelpText()}`;
  }

  // Generate response with LLM
  const result = await generateResponse(message, {
    conversationHistory: conversation.messages.slice(-10),
    assistantName: settings.assistantName,
    userRole: user.userRole
  });

  if (result.success) {
    return result.response;
  }

  // LLM failed, fallback
  return `I'm having trouble with that request. Try these commands:\n• /orders - View orders\n• /machines - Check machines\n• /help - All commands`;
};

// ============================================================================
// REMINDER FUNCTIONS
// ============================================================================

/**
 * Create a reminder from chat
 */
const createReminder = async (text, user, settings) => {
  if (!text || !text.trim()) {
    return {
      text: 'Please specify what to remind you about.\nExample: `/remind 3pm check material stock`',
      data: null
    };
  }

  const { dueDate, message } = parseReminderTime(text);

  const reminder = new Reminder({
    userId: user.userId,
    userRole: user.userRole,
    branchId: user.branchId,
    product27InfinityId: user.product27InfinityId,
    title: message,
    dueDate,
    priority: 'normal',
    status: 'pending'
  });

  await reminder.save();
  await settings.incrementReminderCount();

  const formattedDate = dueDate.toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    text: `✓ Reminder set!\n\n**${message}**\nDue: ${formattedDate}`,
    data: {
      reminderId: reminder._id,
      title: message,
      dueDate: dueDate.toISOString()
    }
  };
};

/**
 * List user's reminders
 */
const listReminders = async (user, roleFilter) => {
  const reminders = await Reminder.find({
    userId: user.userId,
    status: 'pending',
    ...roleFilter
  })
    .sort({ dueDate: 1 })
    .limit(20);

  if (reminders.length === 0) {
    return {
      text: 'You have no pending reminders.\n\nCreate one with `/remind [time] [message]`',
      data: []
    };
  }

  let text = `**Your Reminders (${reminders.length}):**\n\n`;

  reminders.forEach((r, i) => {
    const due = new Date(r.dueDate).toLocaleString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const priority = r.priority === 'high' ? '🔴' : r.priority === 'normal' ? '🟡' : '🟢';
    text += `${i + 1}. ${priority} **${r.title}**\n   Due: ${due}\n\n`;
  });

  return {
    text,
    data: reminders
  };
};

// ============================================================================
// CONVERSATION HISTORY HANDLER
// ============================================================================

/**
 * GET /chat/history - Get conversation history
 */
const getHistory = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;
    const limit = parseInt(event.queryStringParameters?.limit) || 50;

    const conversations = await Conversation.find({
      userId: user.userId
    })
      .sort({ createdAt: -1 })
      .limit(7) // Last 7 days max
      .select('messages metadata createdAt');

    // Flatten messages from all conversations
    const allMessages = [];
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        allMessages.push({
          ...msg.toObject(),
          conversationDate: conv.createdAt
        });
      }
    }

    // Sort by timestamp and limit
    allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedMessages = allMessages.slice(0, limit).reverse();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data: {
          messages: limitedMessages,
          total: allMessages.length
        }
      })
    };

  } catch (error) {
    console.error('Get history error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to get chat history'
      })
    };
  }
};

// ============================================================================
// HEALTH CHECK HANDLER
// ============================================================================

/**
 * GET /chat/health - Check chat service health
 */
const healthCheck = async (event, context) => {
  try {
    await connectToDatabase();

    const ollamaHealth = await checkOllamaHealth();
    const modelCheck = await checkModelAvailable();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data: {
          database: 'connected',
          ollama: ollamaHealth,
          model: modelCheck,
          rules: CHAT_RULES
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Health check failed',
        error: error.message
      })
    };
  }
};

// ============================================================================
// EXPORTS WITH SECURITY WRAPPER
// ============================================================================

module.exports = {
  sendMessage: withSecurity({
    requireAuth: true,
    rateLimit: true,
    sanitize: true,
    allowedRoles: ['manager', 'admin', 'master-admin']
  })(sendMessage),

  getHistory: withSecurity({
    requireAuth: true,
    rateLimit: true,
    sanitize: false,
    allowedRoles: ['manager', 'admin', 'master-admin']
  })(getHistory),

  healthCheck: withSecurity({
    requireAuth: false,
    rateLimit: false,
    sanitize: false
  })(healthCheck)
};
