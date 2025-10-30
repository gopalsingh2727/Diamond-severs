


// module.exports.operatorLogin = async (event) => {
//   await connect();

//   try {
  
//     const apiKey = event.headers['x-api-key'];
//     if (!apiKey || apiKey !== process.env.API_KEY) {
//       return {
//         statusCode: 403,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*',
//         },
//         body: JSON.stringify({ message: 'Invalid API key' }),
//       };
//     }

   
//     if (!event.body) {
//       return {
//         statusCode: 400,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*',
//         },
//         body: JSON.stringify({ message: 'Request body is required' }),
//       };
//     }

//     const { username, password } = JSON.parse(event.body);

//     // ✅ Required field validation
//     if (!username || !password) {
//       return {
//         statusCode: 400,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*',
//         },
//         body: JSON.stringify({ message: 'Username and password required' }),
//       };
//     }

//     const operator = await Operator.findOne({ username });
//     if (!operator) {
//       return {
//         statusCode: 401,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*',
//         },
//         body: JSON.stringify({ message: 'Invalid credentials' }),
//       };
//     }

//     const passwordMatch = await bcrypt.compare(password, operator.password);
//     if (!passwordMatch) {
//       return {
//         statusCode: 401,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*',
//         },
//         body: JSON.stringify({ message: 'Invalid credentials' }),
//       };
//     }

//     // ✅ JWT payload
//     const tokenPayload = {
//       _id: operator._id,
//       username: operator.username,
//       role: operator.role,
//       branchId: operator.branchId,
//       machineId: operator.machineId,
//     };

//     const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
//       expiresIn: '1d',
//     });

//     return {
//       statusCode: 200,
//       headers: {
//         'Content-Type': 'application/json',
//         'Access-Control-Allow-Origin': '*',
//       },
//       body: JSON.stringify({ token }),
//     };
//   } catch (err) {
//     console.error('Operator login error:', err);
//     return {
//       statusCode: 500,
//       headers: {
//         'Content-Type': 'application/json',
//         'Access-Control-Allow-Origin': '*',
//       },
//       body: JSON.stringify({ message: err.message }),
//     };
//   }
// };



module.exports.operatorLogin = async (event) => {
  await connect();

  const body = JSON.parse(event.body || "{}");
  const { password, machineId } = body; // Only password and machineId

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const device = verifyToken(authHeader);

  if (!device || device.role !== "device") {
    return respond(403, { message: "Invalid device token" });
  }

  // Check if machineId is valid for this device
  const assignment = await DeviceMachineAssign.findOne({
    deviceNameId: device._id,
    machines: machineId,
  });

  if (!assignment) {
    return respond(403, { message: "Machine not assigned to this device" });
  }

  // Find operator by password
  const allOperators = await Operator.find(); // Get all operators
  const matchedOperator = await Promise.all(
    allOperators.map(async (op) => {
      const isMatch = await op.comparePassword(password);
      return isMatch ? op : null;
    })
  );

  const operator = matchedOperator.find(op => op !== null);
  if (!operator) {
    return respond(401, { message: "Invalid PIN or no such operator found" });
  }

  const token = jwt.sign(
    {
      _id: operator._id,
      operatorId: operator.operatorId,
      role: "operator",
      branchId: operator.branchId,
      machineId: machineId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return respond(200, {
    message: "Operator logged in",
    token,
    operator: {
      _id: operator._id,
      operatorId: operator.operatorId,
      machineId,
    },
  });
};