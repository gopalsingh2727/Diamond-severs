const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const deviceAccessManager = new mongoose.Schema(
  {
    deviceName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    pin: {
      type: String,
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
     product27InfinityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product27Infinity',
        required: false
      }
  },
  {
    timestamps: true,
  }
);


deviceAccessManager.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  if (this.isModified("pin")) {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
  }

  next();
});


deviceAccessManager.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

deviceAccessManager.methods.comparePin = async function (inputPin) {
  return await bcrypt.compare(inputPin, this.pin);
};

module.exports = mongoose.model("DeviceAccessManager", deviceAccessManager);