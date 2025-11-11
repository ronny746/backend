const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5300;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/uploads', express.static('uploads'));


// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/unacademy_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  name: { type: String, required: true },
  reason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Holiday = mongoose.model('Holiday', holidaySchema);

// Student Schema - UPDATED WITH RFID SUPPORT
const studentSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
  rfidNumber: { type: String, default: '', unique: true, sparse: true }, // RFID support added
  class: { type: String, required: true, default: 'Not Specified' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  qrData: { type: Object },
  qrLink: { type: String },
  serialNumber: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  studentName: { type: String, required: true },
  checkInTime: { type: Date, required: true },
  checkOutTime: { type: Date },
  date: { type: String, required: true },
  status: { type: String, enum: ['checked-in', 'checked-out'], default: 'checked-in' },
  scanType: { type: String, enum: ['qr', 'rfid'], default: 'qr' }, // Track scan type
  createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed!'), false);
    }
  }
});

// Helper function to extract QR data
function extractQRData(qrLink) {
  try {
    if (!qrLink) return null;
    const dataParam = qrLink.split('data=')[1];
    if (dataParam) {
      const decodedData = decodeURIComponent(dataParam);
      return JSON.parse(decodedData);
    }
  } catch (e) {
    console.log('Could not parse QR data from link:', qrLink);
  }
  return null;
}

// Helper function to format time for Flutter
function formatTimeForFlutter(date) {
  if (!date) return null;
  const d = new Date(date);
  // Keep as local IST time
  const istTime = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return istTime.toISOString().slice(0, -1); // remove Z to avoid UTC conversion
}



// ✅ helper to preserve leading zeros
function safeCell(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

// ✅ helper for normal strings
function asString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

app.post('/api/import-students', upload.single('studentFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;

    const workbook = xlsx.readFile(filePath, {
      cellDates: false,   // keep as text
      raw: false          // ✅ prevents losing leading zeros
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = xlsx.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: ""          // ✅ empty cells stay empty (not undefined)
    });

    const students = [];

    for (const row of data) {
      const rollNumber = safeCell(
        row['Roll number'] ||
        row.rollNumber ||
        row.userId ||
        row.UserId
      );

      const name = asString(
        row.Name ||
        row.name ||
        row.student_name ||
        row['Student Name']
      );

      const mobile = safeCell(
        row.Mobile ||
        row.mobile ||
        row.phone ||
        row.Phone
      );

      const qrLink = asString(
        row['Qr link'] ||
        row.qrLink ||
        row.qr_link
      );

      const serialNumber = row['S.N'] || row.sn || row.serialNumber || 0;

      const rfidNumber = safeCell(
        row.RFID ||
        row.rfid ||
        row.rfid_number ||
        row['RFID Number']
      );

      const className = asString(
        row.class ||
        row.Class ||
        row.className ||
        row['Class']
      );

      const email = asString(row.email || row.Email);

      const student = {
        userId: rollNumber,
        name,
        rollNumber,
        rfidNumber,
        class: className || "Not Specified",
        email,
        phone: mobile,
        qrLink,
        serialNumber,
        qrData: extractQRData(qrLink)
      };

      if (student.userId && student.name && student.rollNumber) {
        students.push(student);
      }
    }

    const result = await Promise.all(
      students.map(async (student) => {
        try {
          return await Student.findOneAndUpdate(
            { userId: student.userId },
            student,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.log("Error saving student:", student.name, error.message);
          return null;
        }
      })
    );

    const successfulInserts = result.filter(r => r !== null);

    res.json({
      message: "Students imported successfully",
      count: successfulInserts.length,
      total: students.length,
      students: successfulInserts
    });

  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Failed to import students: " + error.message });
  }
});

// 2. Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ serialNumber: 1, name: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Add new student - UPDATED WITH RFID SUPPORT
app.post('/api/students', async (req, res) => {
  try {
    const { name, rollNumber, rfidNumber, class: className, phone, email } = req.body;

    if (!name || !rollNumber) {
      return res.status(400).json({ error: 'Name and roll number are required' });
    }

    // Check if student with same roll number exists
    const existingStudent = await Student.findOne({ rollNumber: rollNumber.toString() });
    if (existingStudent) {
      return res.status(400).json({ error: 'Student with this roll number already exists' });
    }

    // Check if RFID number already exists (if provided)
    if (rfidNumber) {
      const existingRFID = await Student.findOne({ rfidNumber: rfidNumber.toString() });
      if (existingRFID) {
        return res.status(400).json({ error: 'Student with this RFID number already exists' });
      }
    }

    // Get next serial number
    const maxSerialNumber = await Student.findOne().sort({ serialNumber: -1 }).limit(1);
    const nextSerial = maxSerialNumber ? (maxSerialNumber.serialNumber || 0) + 1 : 1;

    const student = new Student({
      userId: rollNumber.toString(),
      name,
      rollNumber: rollNumber.toString(),
      rfidNumber: rfidNumber ? rfidNumber.toString() : '',
      class: className || 'Not Specified',
      phone: phone || '',
      email: email || '',
      serialNumber: nextSerial
    });

    await student.save();
    res.status(201).json(student);

  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. QR/RFID Scan - Check In/Check Out - UPDATED TO SUPPORT BOTH
// app.post('/api/attendance/scan', async (req, res) => {
//   try {
//     const { userId, qrData } = req.body;
//     let studentUserId = userId;
//     let scanType = 'qr'; // default

//     console.log('Scan request:', { userId, qrData });

//     // Try to parse QR data if provided
//     if (qrData && typeof qrData === 'string') {
//       try {
//         const parsed = JSON.parse(qrData);
//         if (parsed.roll_number) {
//           studentUserId = parsed.roll_number.toString();
//           scanType = 'qr';
//         }
//       } catch (e) {
//         console.log('Could not parse QR data, treating as direct input');
//       }
//     }

//     if (!studentUserId) {
//       return res.status(400).json({ error: 'User ID or RFID is required' });
//     }

//     // Try to find student by roll number first (userId)
//     let student = await Student.findOne({ userId: studentUserId.toString() });

//     // If not found by userId, try RFID number
//     if (!student) {
//       student = await Student.findOne({ rfidNumber: studentUserId.toString() });
//       if (student) {
//         scanType = 'rfid';
//         studentUserId = student.userId; // Use the actual userId for attendance
//         console.log(`Student found by RFID: ${student.name}`);
//       }
//     }

//     if (!student) {
//       return res.status(404).json({
//         error: 'Student not found with ID/RFID: ' + studentUserId,
//         searchedId: studentUserId
//       });
//     }

//     const today = new Date().toISOString().split('T')[0];
//     const now = new Date();

//     const existingAttendance = await Attendance.findOne({
//       userId: student.userId.toString(),
//       date: today
//     }).sort({ createdAt: -1 });

//     if (!existingAttendance) {
//       // First scan - Check In
//       const attendance = new Attendance({
//         userId: student.userId.toString(),
//         studentName: student.name,
//         checkInTime: now,
//         date: today,
//         status: 'checked-in',
//         scanType: scanType
//       });

//       await attendance.save();

//       console.log(`Check-in successful for: ${student.name} via ${scanType.toUpperCase()}`);

//       res.json({
//         message: `Check-in successful via ${scanType.toUpperCase()}`,
//         action: 'check-in',
//         student: student.name,
//         rollNumber: student.rollNumber,
//         rfidNumber: student.rfidNumber || 'Not assigned',
//         userId: student.userId,
//         scanType: scanType,
//         time: now
//       });

//     } else if (existingAttendance.status === 'checked-in') {
//       const checkInTime = new Date(existingAttendance.checkInTime);
//       const timeDifference = (now - checkInTime) / (1000 * 60);

//       if (timeDifference >= 30) {
//         // Check Out
//         existingAttendance.checkOutTime = now;
//         existingAttendance.status = 'checked-out';
//         existingAttendance.scanType = scanType; // Update scan type
//         await existingAttendance.save();

//         console.log(`Check-out successful for: ${student.name} via ${scanType.toUpperCase()}`);

//         res.json({
//           message: `Check-out successful via ${scanType.toUpperCase()}`,
//           action: 'check-out',
//           student: student.name,
//           rollNumber: student.rollNumber,
//           rfidNumber: student.rfidNumber || 'Not assigned',
//           userId: student.userId,
//           scanType: scanType,
//           time: now,
//           totalTime: Math.round(timeDifference) + ' minutes'
//         });
//       } else {
//         const remainingTime = 30 - Math.round(timeDifference);
//         res.status(400).json({
//           error: `Cannot check-out yet. Please wait ${remainingTime} more minutes.`,
//           remainingTime,
//           student: student.name,
//           rollNumber: student.rollNumber,
//           rfidNumber: student.rfidNumber || 'Not assigned'
//         });
//       }
//     } else {
//       res.status(400).json({
//         error: 'Already checked out for today',
//         student: student.name,
//         rollNumber: student.rollNumber,
//         rfidNumber: student.rfidNumber || 'Not assigned'
//       });
//     }

//   } catch (error) {
//     console.error('Attendance scan error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

app.post('/api/attendance/scan', async (req, res) => {
  try {
    const { userId, qrData } = req.body;
    let studentUserId = userId;
    let scanType = 'qr';

    console.log('Scan request:', { userId, qrData });

    // Parse QR data if provided
    if (qrData && typeof qrData === 'string') {
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.roll_number) {
          studentUserId = parsed.roll_number.toString();
          scanType = 'qr';
        }
      } catch {
        console.log('Could not parse QR data, treating as direct input');
      }
    }

    if (!studentUserId) {
      return res.status(400).json({ error: 'Learner Not found Please contact admin.' });
    }

    // Find student
    let student = await Student.findOne({ userId: studentUserId.toString() });
    if (!student) {
      student = await Student.findOne({ rfidNumber: studentUserId.toString() });
      if (student) {
        scanType = 'rfid';
        studentUserId = student.userId;
      }
    }

    if (!student) {
      return res.status(400).json({
        error: 'Student not found with ID/RFID: ' + studentUserId
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Find last attendance of the day
    const lastAttendance = await Attendance.findOne({
      userId: student.userId.toString(),
      date: today
    }).sort({ createdAt: -1 });

    // ✅ 1-hour block time (ms)
    const BLOCK_TIME = 60 * 60 * 1000;

    // ✅ Block duplicate scans within 1 hour
    if (lastAttendance) {
      const lastTime = lastAttendance.checkOutTime || lastAttendance.checkInTime;
      const diff = now - new Date(lastTime);

      if (diff < BLOCK_TIME) {
        const minutesLeft = Math.ceil((BLOCK_TIME - diff) / 60000);

        return res.status(200).json({
          message: `Please wait You can check out after ${minutesLeft} minute(s).`,
          lastAction: lastAttendance.status,
          student: student.name,
          scanType,
          nextAllowedAt: new Date(lastTime.getTime() + BLOCK_TIME)
        });
      }
    }

    let action = 'check-in';

    // ✅ Auto check-out logic
    if (lastAttendance && lastAttendance.status === 'checked-in') {
      lastAttendance.checkOutTime = now;
      lastAttendance.status = 'checked-out';
      lastAttendance.scanType = scanType;
      await lastAttendance.save();
      action = 'check-out';

      console.log(`Check-out successful for: ${student.name}`);
      return res.json({
        message: `Check-out successful via ${scanType.toUpperCase()}`,
        action,
        student: student.name,
        class: student.class,
        rollNumber: student.rollNumber,
        rfidNumber: student.rfidNumber || 'Not assigned',
        userId: student.userId,
        phone: student.phone || 'Not available',
        scanType,
        time: now
      });
    }

    // ✅ Always allow new check-in
    const attendance = new Attendance({
      userId: student.userId.toString(),
      studentName: student.name,
      checkInTime: now,
      class: student.class,
      date: today,
      status: 'checked-in',
      scanType
    });

    await attendance.save();

    console.log(`Check-in successful for: ${student.name}`);
    res.json({
      message: `Check-in successful via ${scanType.toUpperCase()}`,
      action,
      student: student.name,
      class: student.class,
      rollNumber: student.rollNumber,
      rfidNumber: student.rfidNumber || 'Not assigned',
      userId: student.userId,
      phone: student.phone || 'Not available',
      scanType,
      time: now
    });

  } catch (error) {
    console.error('Attendance scan error:', error);
    res.status(500).json({ error: error.message });
  }
});


// 5. Get attendance statistics (for Dashboard)
app.get('/api/attendance/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalStudents = await Student.countDocuments();
    // presentToday: count of attendance records for today (each check-in record counts)
    const presentToday = await Attendance.countDocuments({ date: today });

    // holidays: check if today is a holiday
    const holidayToday = await Holiday.findOne({ date: today });

    const checkedIn = await Attendance.countDocuments({ date: today, status: 'checked-in' });
    const checkedOut = await Attendance.countDocuments({ date: today, status: 'checked-out' });

    const qrScans = await Attendance.countDocuments({ date: today, scanType: 'qr' });
    const rfidScans = await Attendance.countDocuments({ date: today, scanType: 'rfid' });

    // Note: attendancePercentage is naive (presentToday / totalStudents). 
    // If you want to exclude today's holiday from denominators, adjust accordingly.
    res.json({
      totalStudents,
      presentToday,
      absentToday: totalStudents - presentToday,
      checkedIn,
      checkedOut,
      qrScans,
      rfidScans,
      attendancePercentage: totalStudents > 0 ? ((presentToday / totalStudents) * 100).toFixed(1) : 0,
      date: today,
      holidayToday: holidayToday ? { date: holidayToday.date, name: holidayToday.name, reason: holidayToday.reason } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get attendance records (for specific date/student)
app.get('/api/attendance', async (req, res) => {
  try {
    const { date, userId, limit = 100 } = req.query;
    let filter = {};

    if (date) filter.date = date;
    if (userId) filter.userId = userId.toString();

    const attendance = await Attendance.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Updated attendance/range endpoint (replace your current /api/attendance/range)
app.get('/api/attendance/range', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Both start and end date parameters are required',
        format: 'YYYY-MM-DD'
      });
    }

    console.log(`Fetching attendance from ${start} to ${end}`);

    const attendanceRecords = await Attendance.find({
      date: {
        $gte: start,
        $lte: end
      }
    }).sort({ date: 1, createdAt: 1 });

    // Fetch holidays in range
    const holidays = await Holiday.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    // Create a quick lookup
    const holidayMap = {};
    holidays.forEach(h => { holidayMap[h.date] = { name: h.name, reason: h.reason }; });

    const formattedData = attendanceRecords.map(record => {
      const isHoliday = Boolean(holidayMap[record.date]);
      return {
        userId: record.userId,
        date: record.date,
        status: record.status,
        studentName: record.studentName,
        scanType: record.scanType || 'qr',
        checkInTime: formatTimeForFlutter(record.checkInTime),
        checkOutTime: record.checkOutTime ? formatTimeForFlutter(record.checkOutTime) : null,
        isHoliday,
        holiday: null
      };
    });

    console.log(`Found ${formattedData.length} attendance records, holidays: ${holidays.length}`);

    // Return both attendance entries and holidays list (so UI can mark days without attendance too)
    res.json({
      attendance: formattedData,
      holidays: holidays.map(h => ({ date: h.date, name: h.name, reason: h.reason }))
    });

  } catch (error) {
    console.error('Attendance range fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});


// 8. Get student details by userId or RFID - UPDATED
app.get('/api/student/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier.toString();

    // Try to find by userId first
    let student = await Student.findOne({ userId: identifier });

    // If not found, try RFID
    if (!student) {
      student = await Student.findOne({ rfidNumber: identifier });
    }

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const recentAttendance = await Attendance.find({ userId: student.userId.toString() })
      .sort({ date: -1 })
      .limit(10);

    res.json({
      ...student.toObject(),
      recentAttendance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Get attendance report for date range (for Reports screen)
app.get('/api/attendance/report', async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    let filter = {};

    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.date = { $gte: startDate };
    } else if (endDate) {
      filter.date = { $lte: endDate };
    }

    if (userId) filter.userId = userId.toString();

    const attendance = await Attendance.find(filter).sort({ date: -1, createdAt: -1 });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Get detailed reports with statistics (for Reports screen)
app.get('/api/reports/attendance', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const students = await Student.find().sort({ serialNumber: 1, name: 1 });

    const attendanceRecords = await Attendance.find({
      date: { $gte: start, $lte: end }
    });

    // Calculate working days (excluding Sundays)
    const startDate = new Date(start);
    const endDate = new Date(end);
    let workingDays = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) {
        workingDays++;
      }
    }

    const reportData = students.map(student => {
      const studentAttendance = attendanceRecords.filter(
        record => record.userId === student.userId
      );

      const presentDays = studentAttendance.length;
      const absentDays = workingDays - presentDays;
      const percentage = workingDays > 0 ? (presentDays / workingDays * 100).toFixed(1) : '0.0';

      // Count scan types
      const qrScans = studentAttendance.filter(a => a.scanType === 'qr').length;
      const rfidScans = studentAttendance.filter(a => a.scanType === 'rfid').length;

      return {
        studentName: student.name,
        rollNumber: student.rollNumber,
        rfidNumber: student.rfidNumber || 'Not assigned',
        className: student.class,
        userId: student.userId,
        totalDays: workingDays,
        presentDays,
        absentDays,
        percentage: parseFloat(percentage),
        qrScans,
        rfidScans
      };
    });

    res.json(reportData);

  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 11. Update attendance manually (for Register screen editing)
app.post('/api/attendance/update', async (req, res) => {
  try {
    const { userId, date, status } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ error: 'User ID and date are required' });
    }

    const student = await Student.findOne({ userId: userId.toString() });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (status === 'present') {
      const existingAttendance = await Attendance.findOne({ userId: userId.toString(), date });

      if (!existingAttendance) {
        const attendance = new Attendance({
          userId: userId.toString(),
          studentName: student.name,
          checkInTime: new Date(`${date}T09:00:00.000Z`),
          date,
          status: 'checked-in',
          scanType: 'manual'
        });
        await attendance.save();
      }
    } else {
      await Attendance.deleteMany({ userId: userId.toString(), date });
    }

    res.json({ message: 'Attendance updated successfully' });

  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 12. Update student RFID - NEW ENDPOINT
app.put('/api/student/:userId/rfid', async (req, res) => {
  try {
    const { rfidNumber } = req.body;

    if (!rfidNumber) {
      return res.status(400).json({ error: 'RFID number is required' });
    }

    // Check if RFID already exists for another student
    const existingRFID = await Student.findOne({
      rfidNumber: rfidNumber.toString(),
      userId: { $ne: req.params.userId }
    });

    if (existingRFID) {
      return res.status(400).json({
        error: 'This RFID number is already assigned to another student',
        assignedTo: existingRFID.name
      });
    }

    const student = await Student.findOneAndUpdate(
      { userId: req.params.userId.toString() },
      { rfidNumber: rfidNumber.toString() },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({
      message: 'RFID number updated successfully',
      student
    });

  } catch (error) {
    console.error('Update RFID error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 13. Export attendance data (for Excel export)
app.post('/api/export-attendance', async (req, res) => {
  try {
    const { month, year, data } = req.body;

    console.log(`Export request for ${month}/${year}`);

    res.json({
      message: 'Export completed successfully',
      filename: `attendance_${month}_${year}.xlsx`
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 14. Delete student (for testing/admin purposes)
app.delete('/api/student/:userId', async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ userId: req.params.userId.toString() });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await Attendance.deleteMany({ userId: req.params.userId.toString() });

    res.json({ message: 'Student and attendance records deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create holiday
 * Body: { date: 'YYYY-MM-DD', name: 'Holiday Name', reason: '...' }
 */
app.post('/api/holidays', async (req, res) => {
  try {
    const { date, name, reason } = req.body;
    if (!date || !name) {
      return res.status(400).json({ error: 'date and name are required. Format: YYYY-MM-DD' });
    }

    // Basic date format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const existing = await Holiday.findOne({ date });
    if (existing) {
      return res.status(400).json({ error: 'Holiday for this date already exists', holiday: existing });
    }

    const holiday = new Holiday({ date, name, reason: reason || '' });
    await holiday.save();

    res.status(201).json({ message: 'Holiday added', holiday });
  } catch (err) {
    console.error('Add holiday error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get holidays
 * Optional query: ?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
app.get('/api/holidays', async (req, res) => {
  try {
    const { start, end } = req.query;
    let filter = {};
    if (start && end) {
      filter.date = { $gte: start, $lte: end };
    } else if (start) {
      filter.date = { $gte: start };
    } else if (end) {
      filter.date = { $lte: end };
    }
    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.json(holidays);
  } catch (err) {
    console.error('Get holidays error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete holiday by date (YYYY-MM-DD) 
 * or you may change to use id if preferred
 */
app.delete('/api/holidays/:date', async (req, res) => {
  try {
    const date = req.params.date;
    const removed = await Holiday.findOneAndDelete({ date });
    if (!removed) return res.status(404).json({ error: 'Holiday not found' });
    res.json({ message: 'Holiday deleted', holiday: removed });
  } catch (err) {
    console.error('Delete holiday error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 15. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Student Attendance API is running with QR & RFID support',
    timestamp: new Date().toISOString(),
    features: ['QR Code Scanner', 'RFID Scanner', 'Dual Mode Support'],
    endpoints: [
      'POST /api/import-students',
      'GET /api/students',
      'POST /api/students',
      'POST /api/attendance/scan (QR & RFID)',
      'GET /api/attendance/stats',
      'GET /api/attendance',
      'GET /api/attendance/range',
      'GET /api/student/:identifier',
      'GET /api/attendance/report',
      'GET /api/reports/attendance',
      'POST /api/attendance/update',
      'PUT /api/student/:userId/rfid (Update RFID)',
      'POST /api/export-attendance',
      'DELETE /api/student/:userId'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
  console.log(`💾 MongoDB database: student_attendance`);
  console.log(`📁 File uploads directory: uploads/`);
  console.log(`\n🎯 Features Enabled:`);
  console.log(`   ✓ QR Code Scanner Support`);
  console.log(`   ✓ RFID Card Scanner Support`);
  console.log(`   ✓ Dual Mode Attendance`);
  console.log(`\n📋 Key Endpoints:`);
  console.log(`   POST /api/attendance/scan - Attendance via QR/RFID`);
  console.log(`   PUT  /api/student/:userId/rfid - Update student RFID`);
  console.log(`   GET  /api/attendance/stats - Statistics with scan types`);
  console.log(`   GET  /api/student/:identifier - Search by Roll or RFID`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

module.exports = app;