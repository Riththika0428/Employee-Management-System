const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Please add employee reference'],
    },
    date: {
      type: Date,
      required: [true, 'Please add date'],
      default: Date.now,
    },
    checkIn: {
      type: Date,
      required: [true, 'Please add check-in time'],
    },
    checkOut: {
      type: Date,
    },
    totalHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day'],
      default: 'absent',
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        index: '2dsphere',
      },
      address: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one check-in per day per employee
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Pre-save middleware to calculate status based on check-in time
attendanceSchema.pre('save', async function(next) {
  if (this.checkIn && !this.status === 'half-day') {
    const checkInHour = this.checkIn.getHours();
    const checkInMinutes = this.checkIn.getMinutes();
    
    // Define late threshold (e.g., 9:30 AM)
    const lateThresholdHour = 9;
    const lateThresholdMinute = 30;
    
    if (checkInHour > lateThresholdHour || 
        (checkInHour === lateThresholdHour && checkInMinutes > lateThresholdMinute)) {
      this.status = 'late';
      // Calculate late minutes
      const thresholdTime = new Date(this.checkIn);
      thresholdTime.setHours(lateThresholdHour, lateThresholdMinute, 0, 0);
      this.lateMinutes = Math.floor((this.checkIn - thresholdTime) / (1000 * 60));
    } else {
      this.status = 'present';
    }
  }
  next();
});

// Method to calculate total hours
attendanceSchema.methods.calculateTotalHours = function() {
  if (this.checkIn && this.checkOut) {
    const hours = (this.checkOut - this.checkIn) / (1000 * 60 * 60);
    this.totalHours = Math.round(hours * 100) / 100;
    return this.totalHours;
  }
  return 0;
};

module.exports = mongoose.model('Attendance', attendanceSchema);