/**
 * COMPREHENSIVE BILINGUAL LEARNING DATASET
 * For Manufacturing Chatbot - English & Hindi
 * 
 * This dataset helps the chatbot understand:
 * - Natural language variations in both languages
 * - Code-switching (Hinglish)
 * - Regional vocabulary
 * - Context-aware responses
 */

const BILINGUAL_LEARNING_DATA = {
  
  // ============================================================================
  // GREETINGS & CONVERSATION STARTERS
  // ============================================================================
  
  greetings: {
    english: [
      { input: "hi", response: "greeting" },
      { input: "hello", response: "greeting" },
      { input: "hey there", response: "greeting" },
      { input: "good morning", response: "greeting" },
      { input: "good afternoon", response: "greeting" },
      { input: "good evening", response: "greeting" },
      { input: "howdy", response: "greeting" },
      { input: "what's up", response: "greeting" },
      { input: "hey buddy", response: "greeting" },
    ],
    
    hindi: [
      { input: "namaste", response: "greeting" },
      { input: "नमस्ते", response: "greeting" },
      { input: "namaskar", response: "greeting" },
      { input: "नमस्कार", response: "greeting" },
      { input: "pranam", response: "greeting" },
      { input: "प्रणाम", response: "greeting" },
      { input: "ram ram", response: "greeting" },
      { input: "राम राम", response: "greeting" },
      { input: "jai hind", response: "greeting" },
      { input: "sat sri akal", response: "greeting" },
    ],
    
    hinglish: [
      { input: "hi bhai", response: "greeting" },
      { input: "hello ji", response: "greeting" },
      { input: "namaste sir", response: "greeting" },
      { input: "good morning ji", response: "greeting" },
      { input: "hey boss", response: "greeting" },
    ]
  },

  // ============================================================================
  // HELP REQUESTS
  // ============================================================================
  
  helpRequests: {
    english: [
      { input: "help", intent: "help" },
      { input: "help me", intent: "help" },
      { input: "i need help", intent: "help" },
      { input: "what can you do", intent: "help" },
      { input: "show me commands", intent: "help" },
      { input: "how do i use this", intent: "help" },
      { input: "guide me", intent: "help" },
      { input: "instructions please", intent: "help" },
      { input: "tutorial", intent: "help" },
      { input: "show features", intent: "help" },
    ],
    
    hindi: [
      { input: "madad", intent: "help" },
      { input: "मदद", intent: "help" },
      { input: "sahayata", intent: "help" },
      { input: "सहायता", intent: "help" },
      { input: "madad chahiye", intent: "help" },
      { input: "मदद चाहिए", intent: "help" },
      { input: "kya kar sakte ho", intent: "help" },
      { input: "क्या कर सकते हो", intent: "help" },
      { input: "batao kaise use kare", intent: "help" },
      { input: "समझाओ", intent: "help" },
      { input: "sikhao", intent: "help" },
    ],
    
    hinglish: [
      { input: "help karo", intent: "help" },
      { input: "help chahiye", intent: "help" },
      { input: "kya help kar sakte", intent: "help" },
      { input: "commands batao", intent: "help" },
      { input: "guide karo please", intent: "help" },
    ]
  },

  // ============================================================================
  // HOW-TO QUESTIONS - MACHINES
  // ============================================================================
  
  machineQuestions: {
    english: [
      { input: "how to create machine", intent: "create_machine" },
      { input: "how do i add a machine", intent: "create_machine" },
      { input: "add new machine", intent: "create_machine" },
      { input: "create machine", intent: "create_machine" },
      { input: "setup machine", intent: "create_machine" },
      { input: "register machine", intent: "create_machine" },
      { input: "how to add machine details", intent: "create_machine" },
      { input: "machine setup process", intent: "create_machine" },
      { input: "steps to create machine", intent: "create_machine" },
      { input: "machine creation", intent: "create_machine" },
      { input: "how to edit machine", intent: "edit_machine" },
      { input: "modify machine details", intent: "edit_machine" },
      { input: "update machine info", intent: "edit_machine" },
      { input: "change machine settings", intent: "edit_machine" },
    ],
    
    hindi: [
      { input: "machine kaise banaye", intent: "create_machine" },
      { input: "मशीन कैसे बनाएं", intent: "create_machine" },
      { input: "machine banana hai", intent: "create_machine" },
      { input: "मशीन बनाना है", intent: "create_machine" },
      { input: "nayi machine kaise add kare", intent: "create_machine" },
      { input: "नई मशीन कैसे जोड़ें", intent: "create_machine" },
      { input: "machine create karne ka tarika", intent: "create_machine" },
      { input: "मशीन setup kaise kare", intent: "create_machine" },
      { input: "machine register karna hai", intent: "create_machine" },
      { input: "machine ki details kaise dale", intent: "create_machine" },
      { input: "machine edit kaise kare", intent: "edit_machine" },
      { input: "machine ka naam change karna hai", intent: "edit_machine" },
    ],
    
    hinglish: [
      { input: "machine kaise create kare", intent: "create_machine" },
      { input: "machine add karne ka process", intent: "create_machine" },
      { input: "new machine setup karna hai", intent: "create_machine" },
      { input: "machine details kaise fill kare", intent: "create_machine" },
      { input: "machine ko edit kaise kare", intent: "edit_machine" },
    ]
  },

  // ============================================================================
  // HOW-TO QUESTIONS - ORDERS
  // ============================================================================
  
  orderQuestions: {
    english: [
      { input: "how to create order", intent: "create_order" },
      { input: "how do i place an order", intent: "create_order" },
      { input: "create new order", intent: "create_order" },
      { input: "add order", intent: "create_order" },
      { input: "make an order", intent: "create_order" },
      { input: "order creation process", intent: "create_order" },
      { input: "steps to create order", intent: "create_order" },
      { input: "how to add new order", intent: "create_order" },
      { input: "place order for customer", intent: "create_order" },
      { input: "register new order", intent: "create_order" },
      { input: "show pending orders", intent: "view_orders" },
      { input: "view all orders", intent: "view_orders" },
      { input: "check order status", intent: "view_orders" },
      { input: "today's orders", intent: "view_orders" },
    ],
    
    hindi: [
      { input: "order kaise banaye", intent: "create_order" },
      { input: "ऑर्डर कैसे बनाएं", intent: "create_order" },
      { input: "order banana hai", intent: "create_order" },
      { input: "नया order kaise create kare", intent: "create_order" },
      { input: "order dalna hai", intent: "create_order" },
      { input: "order register kaise kare", intent: "create_order" },
      { input: "customer ka order kaise le", intent: "create_order" },
      { input: "order create karne ki process", intent: "create_order" },
      { input: "order banane ka tarika", intent: "create_order" },
      { input: "pending orders dikhao", intent: "view_orders" },
      { input: "order check karna hai", intent: "view_orders" },
      { input: "aaj ke orders", intent: "view_orders" },
      { input: "order ki status kya hai", intent: "view_orders" },
    ],
    
    hinglish: [
      { input: "order kaise create kare", intent: "create_order" },
      { input: "new order dalna hai", intent: "create_order" },
      { input: "order creation ka process batao", intent: "create_order" },
      { input: "pending orders show karo", intent: "view_orders" },
      { input: "orders check karne hain", intent: "view_orders" },
    ]
  },

  // ============================================================================
  // HOW-TO QUESTIONS - CUSTOMERS
  // ============================================================================
  
  customerQuestions: {
    english: [
      { input: "how to add customer", intent: "create_customer" },
      { input: "create new customer", intent: "create_customer" },
      { input: "add customer details", intent: "create_customer" },
      { input: "register customer", intent: "create_customer" },
      { input: "customer creation", intent: "create_customer" },
      { input: "add new client", intent: "create_customer" },
      { input: "how to create customer", intent: "create_customer" },
      { input: "customer setup", intent: "create_customer" },
      { input: "edit customer info", intent: "edit_customer" },
      { input: "view customers", intent: "view_customers" },
      { input: "customer list", intent: "view_customers" },
    ],
    
    hindi: [
      { input: "customer kaise jode", intent: "create_customer" },
      { input: "कस्टमर कैसे जोड़ें", intent: "create_customer" },
      { input: "customer banana hai", intent: "create_customer" },
      { input: "naya customer add karna hai", intent: "create_customer" },
      { input: "ग्राहक कैसे बनाएं", intent: "create_customer" },
      { input: "customer ki details kaise bhare", intent: "create_customer" },
      { input: "customer register kaise kare", intent: "create_customer" },
      { input: "customer list dikhao", intent: "view_customers" },
      { input: "customer edit karna hai", intent: "edit_customer" },
    ],
    
    hinglish: [
      { input: "customer kaise add kare", intent: "create_customer" },
      { input: "new customer banana hai", intent: "create_customer" },
      { input: "customer details kaise fill kare", intent: "create_customer" },
      { input: "customer list show karo", intent: "view_customers" },
    ]
  },

  // ============================================================================
  // HOW-TO QUESTIONS - PRODUCTS
  // ============================================================================
  
  productQuestions: {
    english: [
      { input: "how to add product", intent: "create_product" },
      { input: "create product", intent: "create_product" },
      { input: "add to catalogue", intent: "create_product" },
      { input: "new product creation", intent: "create_product" },
      { input: "product setup", intent: "create_product" },
      { input: "add product specs", intent: "create_product" },
      { input: "product catalogue", intent: "create_product" },
      { input: "register product", intent: "create_product" },
      { input: "view products", intent: "view_products" },
      { input: "product list", intent: "view_products" },
    ],
    
    hindi: [
      { input: "product kaise banaye", intent: "create_product" },
      { input: "प्रोडक्ट कैसे बनाएं", intent: "create_product" },
      { input: "naya product add karna hai", intent: "create_product" },
      { input: "product catalogue me kaise dale", intent: "create_product" },
      { input: "उत्पाद कैसे जोड़ें", intent: "create_product" },
      { input: "product ki details kaise bhare", intent: "create_product" },
      { input: "product register kaise kare", intent: "create_product" },
      { input: "product list dikhao", intent: "view_products" },
    ],
    
    hinglish: [
      { input: "product kaise create kare", intent: "create_product" },
      { input: "new product add karna hai", intent: "create_product" },
      { input: "product catalogue me kaise daale", intent: "create_product" },
    ]
  },

  // ============================================================================
  // HOW-TO QUESTIONS - OPERATORS
  // ============================================================================
  
  operatorQuestions: {
    english: [
      { input: "how to add operator", intent: "create_operator" },
      { input: "create operator", intent: "create_operator" },
      { input: "add worker", intent: "create_operator" },
      { input: "register operator", intent: "create_operator" },
      { input: "setup operator pin", intent: "create_operator" },
      { input: "assign operator to machine", intent: "assign_operator" },
      { input: "view operators", intent: "view_operators" },
      { input: "operator list", intent: "view_operators" },
      { input: "check operators", intent: "view_operators" },
    ],
    
    hindi: [
      { input: "operator kaise banaye", intent: "create_operator" },
      { input: "ऑपरेटर कैसे बनाएं", intent: "create_operator" },
      { input: "worker add karna hai", intent: "create_operator" },
      { input: "कर्मचारी कैसे जोड़ें", intent: "create_operator" },
      { input: "operator ka pin kaise set kare", intent: "create_operator" },
      { input: "operator ko machine se kaise jode", intent: "assign_operator" },
      { input: "operator list dikhao", intent: "view_operators" },
      { input: "kitne operators hain", intent: "view_operators" },
    ],
    
    hinglish: [
      { input: "operator kaise add kare", intent: "create_operator" },
      { input: "new operator banana hai", intent: "create_operator" },
      { input: "operator ko machine assign kaise kare", intent: "assign_operator" },
      { input: "operators ki list show karo", intent: "view_operators" },
    ]
  },

  // ============================================================================
  // HOW-TO QUESTIONS - BRANCH/ADMIN
  // ============================================================================
  
  branchQuestions: {
    english: [
      { input: "how to create branch", intent: "create_branch" },
      { input: "add new branch", intent: "create_branch" },
      { input: "branch creation", intent: "create_branch" },
      { input: "setup branch", intent: "create_branch" },
      { input: "register branch", intent: "create_branch" },
      { input: "how to add manager", intent: "create_manager" },
      { input: "create manager account", intent: "create_manager" },
      { input: "add admin user", intent: "create_admin" },
      { input: "create admin", intent: "create_admin" },
    ],
    
    hindi: [
      { input: "branch kaise banaye", intent: "create_branch" },
      { input: "ब्रांच कैसे बनाएं", intent: "create_branch" },
      { input: "nayi branch add karna hai", intent: "create_branch" },
      { input: "शाखा कैसे जोड़ें", intent: "create_branch" },
      { input: "manager kaise banaye", intent: "create_manager" },
      { input: "मैनेजर कैसे बनाएं", intent: "create_manager" },
      { input: "admin kaise add kare", intent: "create_admin" },
    ],
    
    hinglish: [
      { input: "branch kaise create kare", intent: "create_branch" },
      { input: "new branch add karna hai", intent: "create_branch" },
      { input: "manager account kaise banaye", intent: "create_manager" },
    ]
  },

  // ============================================================================
  // TROUBLESHOOTING - ERRORS & PROBLEMS
  // ============================================================================
  
  troubleshooting: {
    english: [
      { input: "machine not working", intent: "machine_error" },
      { input: "machine error", intent: "machine_error" },
      { input: "machine stopped", intent: "machine_error" },
      { input: "machine won't start", intent: "machine_error" },
      { input: "machine problem", intent: "machine_error" },
      { input: "machine showing error", intent: "machine_error" },
      { input: "order stuck", intent: "order_error" },
      { input: "order not processing", intent: "order_error" },
      { input: "order problem", intent: "order_error" },
      { input: "can't create order", intent: "order_error" },
      { input: "order failed", intent: "order_error" },
      { input: "can't login", intent: "login_error" },
      { input: "forgot password", intent: "login_error" },
      { input: "login problem", intent: "login_error" },
      { input: "access denied", intent: "permission_error" },
      { input: "permission denied", intent: "permission_error" },
      { input: "can't dispatch", intent: "dispatch_error" },
      { input: "dispatch not working", intent: "dispatch_error" },
    ],
    
    hindi: [
      { input: "machine kharab hai", intent: "machine_error" },
      { input: "मशीन खराब है", intent: "machine_error" },
      { input: "machine nahi chal rahi", intent: "machine_error" },
      { input: "मशीन नहीं चल रही", intent: "machine_error" },
      { input: "machine me problem hai", intent: "machine_error" },
      { input: "machine error aa raha hai", intent: "machine_error" },
      { input: "machine shuru nahi ho rahi", intent: "machine_error" },
      { input: "order atka hua hai", intent: "order_error" },
      { input: "order nahi ban raha", intent: "order_error" },
      { input: "order me dikkat hai", intent: "order_error" },
      { input: "order fail ho gaya", intent: "order_error" },
      { input: "login nahi ho raha", intent: "login_error" },
      { input: "password bhool gaya", intent: "login_error" },
      { input: "login ki problem", intent: "login_error" },
      { input: "permission nahi hai", intent: "permission_error" },
      { input: "access nahi mil raha", intent: "permission_error" },
      { input: "dispatch nahi ho raha", intent: "dispatch_error" },
    ],
    
    hinglish: [
      { input: "machine problem hai", intent: "machine_error" },
      { input: "machine start nahi ho rahi", intent: "machine_error" },
      { input: "order stuck ho gaya", intent: "order_error" },
      { input: "order create nahi ho raha", intent: "order_error" },
      { input: "login nahi kar pa rahe", intent: "login_error" },
      { input: "permission ki problem hai", intent: "permission_error" },
    ]
  },

  // ============================================================================
  // STATUS & ANALYTICS QUERIES
  // ============================================================================
  
  statusQueries: {
    english: [
      { input: "show analytics", intent: "analytics" },
      { input: "today's report", intent: "analytics" },
      { input: "production stats", intent: "analytics" },
      { input: "daily summary", intent: "analytics" },
      { input: "show metrics", intent: "analytics" },
      { input: "how many orders today", intent: "analytics" },
      { input: "production report", intent: "analytics" },
      { input: "machine status", intent: "machine_status" },
      { input: "which machines are running", intent: "machine_status" },
      { input: "active machines", intent: "machine_status" },
      { input: "show order status", intent: "order_status" },
      { input: "pending orders", intent: "order_status" },
      { input: "completed orders", intent: "order_status" },
    ],
    
    hindi: [
      { input: "analytics dikhao", intent: "analytics" },
      { input: "आज की report", intent: "analytics" },
      { input: "production stats batao", intent: "analytics" },
      { input: "daily summary", intent: "analytics" },
      { input: "aaj kitne orders hain", intent: "analytics" },
      { input: "आज कितने ऑर्डर हैं", intent: "analytics" },
      { input: "production report dikhao", intent: "analytics" },
      { input: "machine ki status", intent: "machine_status" },
      { input: "konsi machines chal rahi hain", intent: "machine_status" },
      { input: "कौनसी मशीनें चल रही हैं", intent: "machine_status" },
      { input: "order ki status kya hai", intent: "order_status" },
      { input: "pending orders kitne hain", intent: "order_status" },
      { input: "completed orders dikhao", intent: "order_status" },
    ],
    
    hinglish: [
      { input: "analytics show karo", intent: "analytics" },
      { input: "aaj ki report dikhao", intent: "analytics" },
      { input: "kitne orders complete hue", intent: "analytics" },
      { input: "machine status check karo", intent: "machine_status" },
      { input: "pending orders kitne hai", intent: "order_status" },
    ]
  },

  // ============================================================================
  // REMINDERS
  // ============================================================================
  
  reminderQueries: {
    english: [
      { input: "remind me to check stock at 3pm", intent: "create_reminder" },
      { input: "set reminder for tomorrow", intent: "create_reminder" },
      { input: "remind 30 minutes call supplier", intent: "create_reminder" },
      { input: "create reminder", intent: "create_reminder" },
      { input: "show my reminders", intent: "view_reminders" },
      { input: "view reminders", intent: "view_reminders" },
      { input: "what are my reminders", intent: "view_reminders" },
      { input: "pending reminders", intent: "view_reminders" },
    ],
    
    hindi: [
      { input: "mujhe yaad dilao 3 baje stock check karne", intent: "create_reminder" },
      { input: "मुझे याद दिलाओ", intent: "create_reminder" },
      { input: "reminder set karo", intent: "create_reminder" },
      { input: "kal mujhe yaad dilao", intent: "create_reminder" },
      { input: "mere reminders dikhao", intent: "view_reminders" },
      { input: "reminders kya hain", intent: "view_reminders" },
      { input: "pending reminders", intent: "view_reminders" },
    ],
    
    hinglish: [
      { input: "remind karo 3pm stock check", intent: "create_reminder" },
      { input: "reminder set karna hai", intent: "create_reminder" },
      { input: "reminders show karo", intent: "view_reminders" },
    ]
  },

  // ============================================================================
  // CALCULATIONS & MATH
  // ============================================================================
  
  calculations: {
    patterns: [
      { input: "2+2", intent: "calculate" },
      { input: "10*5", intent: "calculate" },
      { input: "100/4", intent: "calculate" },
      { input: "what is 25*4", intent: "calculate" },
      { input: "calculate 150+250", intent: "calculate" },
      { input: "2+2 kya hoga", intent: "calculate" },
      { input: "10*5 kitna hoga", intent: "calculate" },
      { input: "calculate karo 100+50", intent: "calculate" },
    ]
  },

  // ============================================================================
  // DISPATCH & DELIVERY
  // ============================================================================
  
  dispatchQueries: {
    english: [
      { input: "how to dispatch", intent: "dispatch_help" },
      { input: "dispatch order", intent: "dispatch_help" },
      { input: "ship order", intent: "dispatch_help" },
      { input: "mark as dispatched", intent: "dispatch_help" },
      { input: "delivery process", intent: "dispatch_help" },
      { input: "send order", intent: "dispatch_help" },
      { input: "ready to dispatch", intent: "view_dispatch" },
      { input: "show dispatch list", intent: "view_dispatch" },
    ],
    
    hindi: [
      { input: "dispatch kaise kare", intent: "dispatch_help" },
      { input: "order kaise bheje", intent: "dispatch_help" },
      { input: "delivery kaise kare", intent: "dispatch_help" },
      { input: "order ship karna hai", intent: "dispatch_help" },
      { input: "dispatch list dikhao", intent: "view_dispatch" },
      { input: "bhejne ke liye ready orders", intent: "view_dispatch" },
    ],
    
    hinglish: [
      { input: "dispatch kaise kare", intent: "dispatch_help" },
      { input: "order ship karna hai", intent: "dispatch_help" },
      { input: "dispatch wale orders dikhao", intent: "view_dispatch" },
    ]
  },

  // ============================================================================
  // MATERIAL & INVENTORY
  // ============================================================================
  
  materialQueries: {
    english: [
      { input: "check material stock", intent: "view_materials" },
      { input: "show materials", intent: "view_materials" },
      { input: "inventory status", intent: "view_materials" },
      { input: "raw material", intent: "view_materials" },
      { input: "material list", intent: "view_materials" },
      { input: "add material", intent: "create_material" },
      { input: "how to add material", intent: "create_material" },
    ],
    
    hindi: [
      { input: "material stock check karo", intent: "view_materials" },
      { input: "material list dikhao", intent: "view_materials" },
      { input: "raw material kitna hai", intent: "view_materials" },
      { input: "inventory status", intent: "view_materials" },
      { input: "material kaise add kare", intent: "create_material" },
      { input: "naya material dalna hai", intent: "create_material" },
    ],
    
    hinglish: [
      { input: "material stock dikhao", intent: "view_materials" },
      { input: "materials check karo", intent: "view_materials" },
      { input: "material add karna hai", intent: "create_material" },
    ]
  },

  // ============================================================================
  // POLITE RESPONSES & SOCIAL
  // ============================================================================
  
  politeResponses: {
    thankYou: {
      english: ["thank you", "thanks", "thanks a lot", "appreciate it", "thank you so much"],
      hindi: ["धन्यवाद", "dhanyavaad", "shukriya", "शुक्रिया", "bahut bahut dhanyavaad"],
      hinglish: ["thanks yaar", "thank you ji", "shukriya bhai"]
    },
    
    goodbye: {
      english: ["bye", "goodbye", "see you", "see you later", "talk to you later"],
      hindi: ["अलविदा", "alvida", "फिर मिलेंगे", "phir milenge", "namaste"],
      hinglish: ["bye ji", "see you bhai", "baad me baat karenge"]
    },
    
    appreciation: {
      english: ["good job", "well done", "excellent", "great", "awesome"],
      hindi: ["बहुत अच्छा", "bahut accha", "shabash", "शाबाश", "badhiya"],
      hinglish: ["great job yaar", "bahut accha kiya", "perfect hai"]
    }
  },

  // ============================================================================
  // COMMON TYPOS & VARIATIONS
  // ============================================================================
  
  commonTypos: {
    machine: ["machin", "machne", "mechine", "mchine", "mashin"],
    order: ["oder", "ordr", "ordeer", "oorder"],
    customer: ["custmer", "costomer", "customr", "customar"],
    operator: ["operater", "oprator", "opertor"],
    reminder: ["remider", "remindr", "remender"],
    analytics: ["analtics", "analitics", "analytcs"],
    dispatch: ["dispach", "dispatc", "despatch"]
  },

  // ============================================================================
  // CONTEXT-AWARE PATTERNS
  // ============================================================================
  
  contextPatterns: {
    // Time-based
    morning: {
      hours: [6, 7, 8, 9, 10, 11],
      greetingEn: "Good morning!",
      greetingHi: "सुप्रभात! / Suprabhat!"
    },
    
    afternoon: {
      hours: [12, 13, 14, 15, 16, 17],
      greetingEn: "Good afternoon!",
      greetingHi: "नमस्ते!"
    },
    
    evening: {
      hours: [18, 19, 20, 21],
      greetingEn: "Good evening!",
      greetingHi: "शुभ संध्या! / Shubh Sandhya!"
    },
    
    night: {
      hours: [22, 23, 0, 1, 2, 3, 4, 5],
      greetingEn: "Hello! Working late?",
      greetingHi: "नमस्ते! रात को काम कर रहे हैं?"
    }
  },

  // ============================================================================
  // INDUSTRY-SPECIFIC TERMS (Manufacturing/Plastics)
  // ============================================================================
  
  industryTerms: {
    manufacturing: {
      english: [
        "production", "manufacturing", "factory", "plant", "workshop",
        "assembly line", "production line", "batch", "lot", "cycle time",
        "downtime", "uptime", "efficiency", "throughput", "capacity",
        "quality control", "QC", "inspection", "defects", "rejection"
      ],
      
      hindi: [
        "उत्पादन / utpadan", "निर्माण / nirman", "कारखाना / karkhana",
        "फैक्ट्री / factory", "उत्पादन लाइन / production line",
        "बैच / batch", "साइकिल टाइम / cycle time", "डाउनटाइम / downtime",
        "क्षमता / kshamata", "गुणवत्ता जांच / quality check",
        "खराबी / kharabi", "निरीक्षण / nirikshan"
      ]
    },
    
    plastics: {
      english: [
        "plastic bag", "polythene", "LDPE", "HDPE", "PP", "PVC",
        "extrusion", "blow molding", "GSM", "micron", "thickness",
        "width", "length", "gusset", "seal", "printing",
        "die", "roller", "heating", "cooling", "scrap"
      ],
      
      hindi: [
        "प्लास्टिक बैग / plastic bag", "पॉलिथीन / polythene",
        "मोटाई / motai", "चौड़ाई / chaudai", "लंबाई / lambai",
        "सील / seal", "प्रिंटिंग / printing", "स्क्रैप / scrap",
        "रोलर / roller", "हीटिंग / heating", "कूलिंग / cooling"
      ]
    },
    
    measurements: {
      english: [
        "kilogram / kg", "gram / gm", "meter / m", "centimeter / cm",
        "millimeter / mm", "micron", "GSM", "pieces / pcs",
        "ton", "liter / L", "square meter / sqm"
      ],
      
      hindi: [
        "किलोग्राम / kg", "ग्राम / gm", "मीटर / meter",
        "सेंटीमीटर / cm", "टन / ton", "लीटर / liter",
        "पीस / piece", "माइक्रोन / micron"
      ]
    }
  },

  // ============================================================================
  // ROLE-BASED RESPONSES
  // ============================================================================
  
  roleBasedQueries: {
    manager: {
      english: [
        { input: "what can i do as manager", intent: "role_permissions" },
        { input: "manager permissions", intent: "role_permissions" },
        { input: "my access level", intent: "role_permissions" },
        { input: "what am i allowed to do", intent: "role_permissions" }
      ],
      
      hindi: [
        { input: "manager ke roop me kya kar sakta hu", intent: "role_permissions" },
        { input: "मेरी permissions kya hain", intent: "role_permissions" },
        { input: "main kya kya kar sakta hu", intent: "role_permissions" }
      ]
    },
    
    admin: {
      english: [
        { input: "admin features", intent: "role_permissions" },
        { input: "what can admin do", intent: "role_permissions" },
        { input: "admin capabilities", intent: "role_permissions" }
      ],
      
      hindi: [
        { input: "admin kya kar sakta hai", intent: "role_permissions" },
        { input: "admin ki powers", intent: "role_permissions" }
      ]
    }
  },

  // ============================================================================
  // FREQUENTLY ASKED QUESTIONS (FAQ)
  // ============================================================================
  
  faq: {
    english: [
      {
        question: "how to assign operator to machine",
        keywords: ["assign", "operator", "machine"],
        intent: "assign_operator"
      },
      {
        question: "how to check production report",
        keywords: ["production", "report", "check"],
        intent: "production_report"
      },
      {
        question: "how to print order invoice",
        keywords: ["print", "invoice", "order"],
        intent: "print_invoice"
      },
      {
        question: "how to export data",
        keywords: ["export", "download", "data", "excel"],
        intent: "export_data"
      },
      {
        question: "how to calculate GSM",
        keywords: ["calculate", "gsm", "formula"],
        intent: "calculate_gsm"
      },
      {
        question: "what is the difference between admin and manager",
        keywords: ["difference", "admin", "manager", "role"],
        intent: "role_difference"
      }
    ],
    
    hindi: [
      {
        question: "operator ko machine se kaise jode",
        keywords: ["operator", "machine", "assign", "jode"],
        intent: "assign_operator"
      },
      {
        question: "production report kaise dekhe",
        keywords: ["production", "report", "dekhe"],
        intent: "production_report"
      },
      {
        question: "order ka invoice kaise print kare",
        keywords: ["invoice", "print", "order"],
        intent: "print_invoice"
      },
      {
        question: "data export kaise kare",
        keywords: ["export", "download", "data"],
        intent: "export_data"
      },
      {
        question: "GSM kaise calculate kare",
        keywords: ["gsm", "calculate", "formula"],
        intent: "calculate_gsm"
      }
    ]
  },

  // ============================================================================
  // RESPONSE TEMPLATES
  // ============================================================================
  
  responseTemplates: {
    greeting: {
      english: [
        "Hello! I'm {assistantName}, your manufacturing assistant. How can I help you today?",
        "Hi there! I'm {assistantName}. What would you like to do today?",
        "Good to see you! I'm {assistantName}, ready to help with your manufacturing tasks."
      ],
      
      hindi: [
        "नमस्ते! मैं {assistantName} हूं, आपका मैन्युफैक्चरिंग असिस्टेंट। आज मैं आपकी कैसे मदद कर सकता/सकती हूं?",
        "नमस्कार! मैं {assistantName} हूं। आज आप क्या करना चाहते हैं?",
        "आपका स्वागत है! मैं {assistantName} हूं, आपके काम में मदद के लिए तैयार हूं।"
      ]
    },
    
    thankYouResponse: {
      english: [
        "You're welcome! Let me know if you need anything else.",
        "Happy to help! Feel free to ask if you need more assistance.",
        "Glad I could help! I'm here if you need anything."
      ],
      
      hindi: [
        "आपका स्वागत है! और कुछ चाहिए तो बताइए।",
        "खुशी हुई मदद करके! कुछ और चाहिए तो पूछिए।",
        "मदद कर सका/सकी तो अच्छा लगा! कुछ और काम हो तो बताएं।"
      ]
    },
    
    goodbyeResponse: {
      english: [
        "Goodbye! Have a productive day!",
        "See you later! Feel free to come back anytime.",
        "Take care! I'll be here when you need me."
      ],
      
      hindi: [
        "अलविदा! आपका दिन शुभ हो!",
        "फिर मिलेंगे! जब भी जरूरत हो आइएगा।",
        "ध्यान रखिए! मैं यहीं हूं जब भी जरूरत हो।"
      ]
    },
    
    confusion: {
      english: [
        "I'm not sure I understood that. Could you rephrase?",
        "I didn't quite get that. Can you try asking differently?",
        "I'm having trouble understanding. Type /help for available commands."
      ],
      
      hindi: [
        "मुझे ठीक से समझ नहीं आया। कृपया दूसरे तरीके से पूछें?",
        "मैं समझ नहीं पाया/पाई। क्या आप दूसरे शब्दों में पूछ सकते हैं?",
        "मुझे समझने में परेशानी हो रही है। /help टाइप करें सभी commands के लिए।"
      ]
    },
    
    error: {
      english: [
        "Sorry, I encountered an error. Please try again.",
        "Oops! Something went wrong. Can you try that again?",
        "I'm having technical difficulties. Please retry your request."
      ],
      
      hindi: [
        "क्षमा करें, कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।",
        "उफ्फ! कुछ गलत हो गया। क्या आप फिर से कोशिश कर सकते हैं?",
        "मुझे तकनीकी समस्या हो रही है। कृपया फिर से कोशिश करें।"
      ]
    }
  },

  // ============================================================================
  // EMOJI & VISUAL INDICATORS
  // ============================================================================
  
  indicators: {
    success: "✓",
    error: "✗",
    warning: "⚠️",
    info: "ℹ️",
    machine: "⚙️",
    order: "📦",
    customer: "👤",
    analytics: "📊",
    reminder: "🔔",
    calendar: "📅",
    time: "⏰",
    money: "₹",
    location: "📍",
    phone: "📞",
    email: "📧",
    priority: {
      high: "🔴",
      medium: "🟡",
      low: "🟢"
    }
  },

  // ============================================================================
  // REGIONAL VARIATIONS
  // ============================================================================
  
  regionalVariations: {
    northIndia: {
      greetings: ["namaste", "ram ram", "sat sri akal", "aadab"],
      farewell: ["alvida", "phir milenge", "rab rakha"],
      affirmative: ["haan", "ji haan", "bilkul", "zaroor"],
      negative: ["nahi", "nahi ji", "bilkul nahi"]
    },
    
    southIndia: {
      greetings: ["vanakkam", "namaskara", "namaste"],
      commonWords: ["anna" (brother), "akka" (sister)]
    },
    
    informal: {
      greetings: ["hey boss", "kya scene hai", "sab badhiya", "all good"],
      affirmative: ["haan yaar", "done", "pakka", "sure"],
      negative: ["nahi yaar", "no way", "mat karo"]
    }
  },

  // ============================================================================
  // SENTIMENT & TONE DETECTION
  // ============================================================================
  
  sentimentPatterns: {
    frustrated: {
      english: ["frustrated", "annoyed", "irritated", "fed up", "stuck", "not working", "broken"],
      hindi: ["pareshan", "परेशान", "gussa", "गुस्सा", "thak gaya", "थक गया"],
      response: "empathetic"
    },
    
    urgent: {
      english: ["urgent", "asap", "quickly", "immediately", "emergency", "right now"],
      hindi: ["jaldi", "जल्दी", "turant", "तुरंत", "abhi", "अभी", "emergency"],
      response: "prioritize"
    },
    
    confused: {
      english: ["confused", "don't understand", "not clear", "unclear", "lost"],
      hindi: ["samajh nahi aaya", "समझ नहीं आया", "confusion hai", "saaf nahi hai"],
      response: "clarify"
    },
    
    satisfied: {
      english: ["great", "perfect", "excellent", "awesome", "love it"],
      hindi: ["badhiya", "बढ़िया", "bahut accha", "perfect", "zabardast"],
      response: "acknowledge"
    }
  },

  // ============================================================================
  // COMMAND ALIASES & SHORTCUTS
  // ============================================================================
  
  commandAliases: {
    orders: ["orders", "order", "ord", "/orders", "/order"],
    machines: ["machines", "machine", "mach", "/machines", "/machine"],
    operators: ["operators", "operator", "op", "/operators", "/operator"],
    analytics: ["analytics", "stats", "report", "/analytics", "/stats"],
    help: ["help", "?", "commands", "/help", "/?"],
    reminders: ["reminders", "reminder", "remind", "/reminders", "/reminder"],
    customers: ["customers", "customer", "cust", "/customers", "/customer"]
  },

  // ============================================================================
  // MULTI-STEP CONVERSATION FLOWS
  // ============================================================================
  
  conversationFlows: {
    createOrder: {
      step1: {
        english: "Let's create an order. First, which customer is this for?",
        hindi: "चलिए order बनाते हैं। पहले बताइए, यह order किस customer के लिए है?"
      },
      step2: {
        english: "Great! Now, which product do they want?",
        hindi: "बढ़िया! अब बताइए, कौनसा product चाहिए?"
      },
      step3: {
        english: "How many pieces/quantity?",
        hindi: "कितनी quantity / कितने पीस?"
      },
      step4: {
        english: "When is the delivery due date?",
        hindi: "Delivery कब तक चाहिए?"
      },
      confirmation: {
        english: "Perfect! I'll create the order. Go to Menu → Create Orders to complete.",
        hindi: "परफेक्ट! Order बनाने के लिए Menu → Create Orders में जाएं।"
      }
    },
    
    troubleshootMachine: {
      step1: {
        english: "I'll help troubleshoot the machine. Which machine is having the problem?",
        hindi: "मैं machine की problem solve करने में help करूंगा/करूंगी। कौनसी machine में problem है?"
      },
      step2: {
        english: "What's happening? Is it not starting, showing error, or something else?",
        hindi: "क्या हो रहा है? Start nahi ho rahi, error aa raha hai, या कुछ और?"
      },
      step3: {
        english: "Let me check the common solutions for you...",
        hindi: "मैं आपके लिए common solutions check करता/करती हूं..."
      }
    }
  },

  // ============================================================================
  // DATE & TIME PARSING PATTERNS
  // ============================================================================
  
  dateTimePatterns: {
    english: {
      today: ["today", "aaj"],
      tomorrow: ["tomorrow", "kal"],
      yesterday: ["yesterday"],
      thisWeek: ["this week", "is hafte"],
      thisMonth: ["this month", "is mahine"],
      relative: {
        minutes: ["in 5 minutes", "5 min", "5m"],
        hours: ["in 2 hours", "2 hours", "2h"],
        days: ["in 3 days", "3 days"]
      },
      specific: {
        time: ["3pm", "3:00pm", "15:00", "at 3"],
        date: ["march 15", "15 march", "15/03"]
      }
    },
    
    hindi: {
      today: ["aaj", "आज"],
      tomorrow: ["kal", "कल", "kal subah"],
      yesterday: ["kal" /* context-dependent */, "कल"],
      thisWeek: ["is hafte", "इस हफ्ते"],
      thisMonth: ["is mahine", "इस महीने"],
      relative: {
        minutes: ["5 minute me", "5 मिनट में"],
        hours: ["2 ghante me", "2 घंटे में"],
        days: ["3 din me", "3 दिन में"]
      }
    }
  },

  // ============================================================================
  // BUSINESS HOURS & AVAILABILITY
  // ============================================================================
  
  businessContext: {
    workingHours: {
      start: 9, // 9 AM
      end: 18,  // 6 PM
      timezone: "Asia/Kolkata"
    },
    
    holidays: {
      // Major Indian holidays
      fixed: [
        { date: "01-26", name: "Republic Day" },
        { date: "08-15", name: "Independence Day" },
        { date: "10-02", name: "Gandhi Jayanti" },
        { date: "12-25", name: "Christmas" }
      ],
      // Variable holidays (Diwali, Holi, Eid, etc.) would need yearly updates
    },
    
    outOfHoursMessages: {
      english: "I see you're working outside normal hours (9 AM - 6 PM). I'm here to help anytime!",
      hindi: "आप काम के normal hours (9 AM - 6 PM) के बाहर काम कर रहे हैं। मैं हमेशा मदद के लिए यहां हूं!"
    }
  },

  // ============================================================================
  // VALIDATION PATTERNS
  // ============================================================================
  
  validationPatterns: {
    phone: {
      india: /^(\+91|91)?[6-9]\d{9}$/,
      examples: ["9876543210", "+919876543210", "919876543210"]
    },
    
    gst: {
      pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      example: "22AAAAA0000A1Z5"
    },
    
    pin: {
      operator: /^\d{4}$/,
      example: "1234"
    },
    
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      example: "user@example.com"
    }
  },

  // ============================================================================
  // ERROR MESSAGES
  // ============================================================================
  
  errorMessages: {
    validation: {
      english: {
        required: "This field is required",
        invalidPhone: "Please enter a valid 10-digit phone number",
        invalidEmail: "Please enter a valid email address",
        invalidGST: "Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)",
        invalidPIN: "Please enter a 4-digit PIN"
      },
      
      hindi: {
        required: "यह field भरना जरूरी है",
        invalidPhone: "कृपया 10 अंकों का सही phone number डालें",
        invalidEmail: "कृपया सही email address डालें",
        invalidGST: "कृपया सही GST number डालें",
        invalidPIN: "कृपया 4 अंकों का PIN डालें"
      }
    },
    
    permission: {
      english: {
        denied: "You don't have permission to perform this action",
        roleRestriction: "This feature is only available for {role} users",
        contactAdmin: "Please contact your administrator for access"
      },
      
      hindi: {
        denied: "आपको यह action करने की permission नहीं है",
        roleRestriction: "यह feature केवल {role} users के लिए available है",
        contactAdmin: "Access के लिए कृपया अपने administrator से संपर्क करें"
      }
    }
  },

  // ============================================================================
  // SUCCESS MESSAGES
  // ============================================================================
  
  successMessages: {
    created: {
      english: "{item} created successfully! ✓",
      hindi: "{item} सफलतापूर्वक बनाया गया! ✓"
    },
    
    updated: {
      english: "{item} updated successfully! ✓",
      hindi: "{item} सफलतापूर्वक अपडेट किया गया! ✓"
    },
    
    deleted: {
      english: "{item} deleted successfully! ✓",
      hindi: "{item} सफलतापूर्वक delete किया गया! ✓"
    },
    
    dispatched: {
      english: "Order dispatched successfully! 📦",
      hindi: "Order सफलतापूर्वक dispatch किया गया! 📦"
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS FOR USING THIS DATA
// ============================================================================

/**
 * Detect language from input text
 */
function detectLanguage(text) {
  // Check for Devanagari script
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hindi';
  }
  
  // Check for common Hindi transliterations
  const hindiWords = /\b(kaise|kya|kab|kahan|kaun|kitna|hai|ho|hain|ka|ki|ke|me|se|tak|aur|ya)\b/i;
  if (hindiWords.test(text)) {
    return 'hinglish';
  }
  
  return 'english';
}

/**
 * Match user input to intent
 */
function matchIntent(userInput, dataset) {
  const normalized = userInput.toLowerCase().trim();
  const language = detectLanguage(normalized);
  
  // Search through all categories
  for (const [category, data] of Object.entries(dataset)) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Check all language variations
      for (const [lang, patterns] of Object.entries(data)) {
        if (Array.isArray(patterns)) {
          for (const pattern of patterns) {
            if (pattern.input && normalized.includes(pattern.input.toLowerCase())) {
              return {
                category,
                intent: pattern.intent || pattern.response,
                language,
                confidence: calculateConfidence(normalized, pattern.input)
              };
            }
          }
        }
      }
    }
  }
  
  return { category: 'unknown', intent: null, language, confidence: 0 };
}

/**
 * Calculate confidence score for a match
 */
function calculateConfidence(input, pattern) {
  const inputWords = input.split(/\s+/);
  const patternWords = pattern.toLowerCase().split(/\s+/);
  
  let matchCount = 0;
  for (const word of patternWords) {
    if (inputWords.some(iw => iw.includes(word) || word.includes(iw))) {
      matchCount++;
    }
  }
  
  return (matchCount / patternWords.length) * 100;
}

/**
 * Get response template
 */
function getResponseTemplate(templateKey, language = 'english', variables = {}) {
  const template = BILINGUAL_LEARNING_DATA.responseTemplates[templateKey]?.[language];
  
  if (!template) return null;
  
  // If array, pick random
  const selected = Array.isArray(template) 
    ? template[Math.floor(Math.random() * template.length)]
    : template;
  
  // Replace variables
  let response = selected;
  for (const [key, value] of Object.entries(variables)) {
    response = response.replace(`{${key}}`, value);
  }
  
  return response;
}

// Export the dataset
module.exports = BILINGUAL_LEARNING_DATA;