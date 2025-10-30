const jwt = require("jsonwebtoken");
const { connect } = require("../../db");
const { respond, checkApiKey } = require("../../utils");
const DeviceAccess = require("../../models/deviceAccess");

module.exports.deviceLogin = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: "Invalid API key" });
  }

  const body = JSON.parse(event.body || "{}");
  const { deviceName, password } = body;

  if (!deviceName || !password) {
    return respond(400, { message: "Device name and password are required" });
  }

  try {
    const device = await DeviceAccess.findOne({ deviceName });
    if (!device) {
      return respond(404, { message: "Device not found" });
    }

    const isMatch = await device.comparePassword(password);
    if (!isMatch) {
      return respond(401, { message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        _id: device._id,
        deviceName: device.deviceName,
        branchId: device.branchId,
        role: "device",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return respond(200, {
      message: "Login successful",
      token,
      device: {
        _id: device._id,
        deviceName: device.deviceName,
        location: device.location,
        branchId: device.branchId,
      },
    });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};






module.exports.getDeviceMachines = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: "Invalid API key" });
  }

  let device;
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    device = verifyToken(authHeader);

    if (device.role !== "device") {
      return respond(403, { message: "Unauthorized: Not a device token" });
    }
  } catch {
    return respond(401, { message: "Invalid or expired token" });
  }

  try {
    const assignment = await DeviceMachineAssign.findOne({ deviceNameId: device._id })
      .populate("machines")
      .populate("deviceNameId");

    if (!assignment) {
      return respond(404, { message: "No machines assigned to this device" });
    }

    return respond(200, {
      message: "Assigned machines fetched",
      machines: assignment.machines,
    });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};



