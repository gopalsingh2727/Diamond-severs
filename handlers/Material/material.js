const mongoose = require("mongoose");
const Material = require("../../models/Material/material");
const connect = require("../../config/mongodb/db");
const verifyToken = require("../../utiles/verifyToken");
const MaterialType = require('../../models/MaterialType/materialType')



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];
  return apiKey === process.env.API_KEY;
};

// OPTIONS handler (for all)
const handleOptions = (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
};

// ===========================
// CREATE Material
// ===========================
module.exports.createMaterial = async (event) => {
  await connect();
  const options = handleOptions(event);
  if (options) return options;

  if (!checkApiKey(event)) return respond(403, { message: "Invalid API key" });

  let user;
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    user = verifyToken(authHeader);
  } catch {
    return respond(401, { message: "Invalid token" });
  }

  const body = JSON.parse(event.body || "{}");

  if (!body.materialName || typeof body.materialName !== "string") {
    return respond(400, { message: "Material name is required and must be a string" });
  }

  const exists = await Material.findOne({ materialName: body.materialName });
  if (exists) return respond(400, { message: "Material name must be unique" });

  try {
    const material = new Material({
      materialName: body.materialName,
      materialMol: body.materialMol,
      materialType: body.materialType,
      branchId: user.role === "admin" ? body.branchId : user.branchId,
    });

    await material.save();
    return respond(201, material);
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

// ===========================
// GET Materials
// ===========================
module.exports.getMaterials = async (event) => {
  await connect();
  const options = handleOptions(event);
  if (options) return options;

  if (!checkApiKey(event)) return respond(403, { message: "Invalid API key" });

  let user;
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    user = verifyToken(authHeader);
  } catch {
    return respond(401, { message: "Invalid token" });
  }

  try {
    const filter = user.role === "manager" ? { branchId: user.branchId } : {};
    const materials = await Material.find(filter).populate("materialType");
    return respond(200, materials);
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

// ===========================
// UPDATE Material
// ===========================
module.exports.updateMaterial = async (event) => {
  await connect();
  const options = handleOptions(event);
  if (options) return options;

  if (!checkApiKey(event)) return respond(403, { message: "Invalid API key" });

  let user;
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    user = verifyToken(authHeader);
  } catch {
    return respond(401, { message: "Invalid token" });
  }

  const id = event.pathParameters?.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return respond(400, { message: "Invalid material ID" });
  }

  const body = JSON.parse(event.body || "{}");

  try {
    const material = await Material.findById(id);
    if (!material) return respond(404, { message: "Material not found" });

    if (user.role !== "admin" && String(material.branchId) !== user.branchId) {
      return respond(403, { message: "Unauthorized" });
    }

    material.materialName = body.materialName || material.materialName;
    material.materialMol = body.materialMol || material.materialMol;
    material.materialType = body.materialType || material.materialType;

    await material.save();
    return respond(200, material);
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

// ===========================
// DELETE Material
// ===========================
module.exports.deleteMaterial = async (event) => {
  await connect();
  const options = handleOptions(event);
  if (options) return options;

  if (!checkApiKey(event)) return respond(403, { message: "Invalid API key" });

  let user;
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    user = verifyToken(authHeader);
  } catch {
    return respond(401, { message: "Invalid token" });
  }

  const id = event.pathParameters?.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return respond(400, { message: "Invalid material ID" });
  }

  try {
    const material = await Material.findById(id);
    if (!material) return respond(404, { message: "Material not found" });

    if (user.role !== "admin" && String(material.branchId) !== user.branchId) {
      return respond(403, { message: "Unauthorized" });
    }

    await material.deleteOne();
    return respond(200, { message: "Material deleted successfully" });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};