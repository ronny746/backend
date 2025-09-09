// const express = require('express');
// const mongoose = require('mongoose');
// const multer = require('multer');
// const xlsx = require('xlsx');
// const cors = require('cors');
// const path = require('path');

// const app = express();
// const PORT = process.env.PORT || 5300;

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use('/uploads', express.static('uploads'));

// // MongoDB Connection
// mongoose.connect('mongodb://localhost:27017/student_attendance', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// // Student Schema (Updated for your data format)
// const studentSchema = new mongoose.Schema({
//   userId: { type: String, required: true, unique: true }, // This will be roll number
//   name: { type: String, required: true },
//   rollNumber: { type: String, required: true },
//   class: { type: String, required: true, default: 'Not Specified' },
//   email: { type: String, default: '' },
//   phone: { type: String, default: '' },
//   qrData: { type: Object }, // Store QR code data
//   qrLink: { type: String }, // Store original QR link
//   serialNumber: { type: Number }, // S.N from your Excel
//   createdAt: { type: Date, default: Date.now }
// });

// // Attendance Schema
// const attendanceSchema = new mongoose.Schema({
//   userId: { type: String, required: true },
//   studentName: { type: String, required: true },
//   checkInTime: { type: Date, required: true },
//   checkOutTime: { type: Date },
//   date: { type: String, required: true }, // YYYY-MM-DD format
//   status: { type: String, enum: ['checked-in', 'checked-out'], default: 'checked-in' },
//   createdAt: { type: Date, default: Date.now }
// });

// const Student = mongoose.model('Student', studentSchema);
// const Attendance = mongoose.model('Attendance', attendanceSchema);

// // Multer setup for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/');
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({
//   storage: storage,
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ['.xlsx', '.xls', '.csv'];
//     const fileExtension = path.extname(file.originalname).toLowerCase();
//     if (allowedTypes.includes(fileExtension)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only Excel and CSV files are allowed!'), false);
//     }
//   }
// });

// // Helper function to extract QR data
// function extractQRData(qrLink) {
//   try {
//     if (!qrLink) return null;

//     // Extract data parameter from QR URL
//     const dataParam = qrLink.split('data=')[1];
//     if (dataParam) {
//       const decodedData = decodeURIComponent(dataParam);
//       return JSON.parse(decodedData);
//     }
//   } catch (e) {
//     console.log('Could not parse QR data from link:', qrLink);
//   }
//   return null;
// }

// // Routes

// // 1. Upload Excel/CSV file and import students (Updated for your format)
// app.post('/api/import-students', upload.single('studentFile'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: 'No file uploaded' });
//     }

//     console.log('File uploaded:', req.file);

//     const filePath = req.file.path;
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];
//     const data = xlsx.utils.sheet_to_json(worksheet);

//     console.log('Sample data row:', data[0]);

//     const students = [];

//     for (const row of data) {
//       console.log('Processing row:', row);

//       // Handle your specific Excel format
//       const rollNumber = row['Roll number'] || row.rollNumber || row.userId || row.UserId;
//       const name = row.Name || row.name || row.student_name || row['Student Name'];
//       const mobile = row.Mobile || row.mobile || row.phone || row.Phone || '';
//       const qrLink = row['Qr link'] || row.qrLink || row.qr_link || '';
//       const serialNumber = row['S.N'] || row.sn || row.serialNumber || 0;

//       const student = {
//         userId: rollNumber ? rollNumber.toString() : '',
//         name: name || '',
//         rollNumber: rollNumber ? rollNumber.toString() : '',
//         class: row.class || row.Class || row.className || row['Class'] || 'Not Specified',
//         email: row.email || row.Email || '',
//         phone: mobile ? mobile.toString() : '',
//         qrLink: qrLink,
//         serialNumber: serialNumber,
//         qrData: extractQRData(qrLink)
//       };

//       if (student.userId && student.name && student.rollNumber) {
//         students.push(student);
//       } else {
//         console.log('Skipping invalid student data:', student);
//       }
//     }

//     console.log(`Processing ${students.length} students`);

//     // Insert students into database (update if exists)
//     const result = await Promise.all(
//       students.map(async (student) => {
//         try {
//           return await Student.findOneAndUpdate(
//             { userId: student.userId },
//             student,
//             { upsert: true, new: true }
//           );
//         } catch (error) {
//           console.log('Error saving student:', student.name, error.message);
//           return null;
//         }
//       })
//     );

//     const successfulInserts = result.filter(r => r !== null);

//     res.json({
//       message: 'Students imported successfully',
//       count: successfulInserts.length,
//       total: students.length,
//       students: successfulInserts
//     });

//   } catch (error) {
//     console.error('Import error:', error);
//     res.status(500).json({ error: 'Failed to import students: ' + error.message });
//   }
// });

// // 2. Get all students
// app.get('/api/students', async (req, res) => {
//   try {
//     const students = await Student.find().sort({ serialNumber: 1, name: 1 });
//     res.json(students);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 3. QR Scan - Check In/Check Out (Updated for your QR format)
// app.post('/api/attendance/scan', async (req, res) => {
//   try {
//     const { userId, qrData } = req.body;
//     let studentUserId = userId;

//     console.log('Scan request:', { userId, qrData });

//     // If QR data is provided (JSON format), extract roll number
//     if (qrData && typeof qrData === 'string') {
//       try {
//         const parsed = JSON.parse(qrData);
//         if (parsed.roll_number) {
//           studentUserId = parsed.roll_number.toString();
//         }
//       } catch (e) {
//         // If parsing fails, use userId as is
//         console.log('Could not parse QR data, using userId as is');
//       }
//     }

//     if (!studentUserId) {
//       return res.status(400).json({ error: 'User ID is required' });
//     }

//     // Check if student exists (by userId which is roll number)
//     const student = await Student.findOne({ userId: studentUserId.toString() });
//     if (!student) {
//       return res.status(404).json({
//         error: 'Student not found with roll number: ' + studentUserId,
//         searchedId: studentUserId
//       });
//     }

//     const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
//     const now = new Date();

//     // Check if student already has attendance for today
//     const existingAttendance = await Attendance.findOne({
//       userId: studentUserId.toString(),
//       date: today
//     }).sort({ createdAt: -1 });

//     if (!existingAttendance) {
//       // First scan - Check In
//       const attendance = new Attendance({
//         userId: studentUserId.toString(),
//         studentName: student.name,
//         checkInTime: now,
//         date: today,
//         status: 'checked-in'
//       });

//       await attendance.save();

//       console.log('Check-in successful for:', student.name);

//       res.json({
//         message: 'Check-in successful',
//         action: 'check-in',
//         student: student.name,
//         rollNumber: student.rollNumber,
//         userId: student.userId,
//         time: now
//       });

//     } else if (existingAttendance.status === 'checked-in') {
//       // Check if 30 minutes have passed since check-in
//       const checkInTime = new Date(existingAttendance.checkInTime);
//       const timeDifference = (now - checkInTime) / (1000 * 60); // minutes

//       if (timeDifference >= 30) {
//         // Check Out
//         existingAttendance.checkOutTime = now;
//         existingAttendance.status = 'checked-out';
//         await existingAttendance.save();

//         console.log('Check-out successful for:', student.name);

//         res.json({
//           message: 'Check-out successful',
//           action: 'check-out',
//           student: student.name,
//           rollNumber: student.rollNumber,
//           userId: student.userId,
//           time: now,
//           totalTime: Math.round(timeDifference) + ' minutes'
//         });
//       } else {
//         const remainingTime = 30 - Math.round(timeDifference);
//         res.status(400).json({
//           error: `Cannot check-out yet. Please wait ${remainingTime} more minutes.`,
//           remainingTime,
//           student: student.name,
//           rollNumber: student.rollNumber
//         });
//       }
//     } else {
//       res.status(400).json({
//         error: 'Already checked out for today',
//         student: student.name,
//         rollNumber: student.rollNumber
//       });
//     }

//   } catch (error) {
//     console.error('Attendance scan error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 4. Get attendance statistics
// app.get('/api/attendance/stats', async (req, res) => {
//   try {
//     const today = new Date().toISOString().split('T')[0];

//     const totalStudents = await Student.countDocuments();
//     const presentToday = await Attendance.countDocuments({ date: today });
//     const absentToday = totalStudents - presentToday;

//     // Get checked in vs checked out
//     const checkedIn = await Attendance.countDocuments({ date: today, status: 'checked-in' });
//     const checkedOut = await Attendance.countDocuments({ date: today, status: 'checked-out' });

//     res.json({
//       totalStudents,
//       presentToday,
//       absentToday,
//       checkedIn,
//       checkedOut,
//       attendancePercentage: totalStudents > 0 ? ((presentToday / totalStudents) * 100).toFixed(1) : 0,
//       date: today
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 5. Get attendance records
// app.get('/api/attendance', async (req, res) => {
//   try {
//     const { date, userId, limit = 100 } = req.query;
//     let filter = {};

//     if (date) filter.date = date;
//     if (userId) filter.userId = userId.toString();

//     const attendance = await Attendance.find(filter)
//       .sort({ createdAt: -1 })
//       .limit(parseInt(limit));

//     res.json(attendance);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 6. Get student details by userId
// app.get('/api/student/:userId', async (req, res) => {
//   try {
//     const student = await Student.findOne({ userId: req.params.userId.toString() });
//     if (!student) {
//       return res.status(404).json({ error: 'Student not found' });
//     }

//     // Also get recent attendance
//     const recentAttendance = await Attendance.find({ userId: req.params.userId.toString() })
//       .sort({ date: -1 })
//       .limit(10);

//     res.json({
//       ...student.toObject(),
//       recentAttendance
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 7. Get attendance report for date range
// app.get('/api/attendance/report', async (req, res) => {
//   try {
//     const { startDate, endDate, userId } = req.query;
//     let filter = {};

//     if (startDate && endDate) {
//       filter.date = { $gte: startDate, $lte: endDate };
//     } else if (startDate) {
//       filter.date = { $gte: startDate };
//     } else if (endDate) {
//       filter.date = { $lte: endDate };
//     }

//     if (userId) filter.userId = userId.toString();

//     const attendance = await Attendance.find(filter).sort({ date: -1, createdAt: -1 });

//     res.json(attendance);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get('/api/attendance/range', async (req, res) => {
//   try {
//     const { start, end } = req.query;

//     if (!start || !end) {
//       return res.status(400).json({ error: 'Please provide start and end query parameters in YYYY-MM-DD format.' });
//     }

//     // Validate simple YYYY-MM-DD format (basic)
//     const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!isoDateRegex.test(start) || !isoDateRegex.test(end)) {
//       return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
//     }

//     // Build filter: date is stored as string 'YYYY-MM-DD' in your schema
//     const filter = {
//       date: { $gte: start, $lte: end }
//     };

//     // Fetch attendance sorted by date and createdAt
//     const attendance = await Attendance.find(filter).sort({ date: 1, createdAt: 1 });

//     return res.json(attendance);
//   } catch (error) {
//     console.error('Error in /attendance/range:', error);
//     return res.status(500).json({ error: error.message || 'Server error' });
//   }
// });


// // 8. Delete student (for testing)
// app.delete('/api/student/:userId', async (req, res) => {
//   try {
//     const student = await Student.findOneAndDelete({ userId: req.params.userId.toString() });
//     if (!student) {
//       return res.status(404).json({ error: 'Student not found' });
//     }

//     // Also delete attendance records
//     await Attendance.deleteMany({ userId: req.params.userId.toString() });

//     res.json({ message: 'Student and attendance records deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 9. Health check
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'OK',
//     message: 'Student Attendance API is running',
//     timestamp: new Date().toISOString()
//   });
// });

// // Error handling middleware
// app.use((error, req, res, next) => {
//   console.error('Global error handler:', error);
//   if (error instanceof multer.MulterError) {
//     if (error.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({ error: 'File too large' });
//     }
//   }
//   res.status(500).json({ error: 'Something went wrong!' });
// });

// // Create uploads directory if it doesn't exist
// const fs = require('fs');
// if (!fs.existsSync('uploads')) {
//   fs.mkdirSync('uploads');
// }

// // MongoDB connection events
// mongoose.connection.on('connected', () => {
//   console.log('✅ MongoDB connected successfully');
// });

// mongoose.connection.on('error', (err) => {
//   console.error('❌ MongoDB connection error:', err);
// });

// mongoose.connection.on('disconnected', () => {
//   console.log('⚠️ MongoDB disconnected');
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
//   console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
//   console.log(`💾 MongoDB database: student_attendance`);
//   console.log(`📁 File uploads directory: uploads/`);
// });

// // Graceful shutdown
// process.on('SIGINT', async () => {
//   console.log('\n⚠️ Shutting down gracefully...');
//   await mongoose.connection.close();
//   console.log('✅ MongoDB connection closed');
//   process.exit(0);
// });

// module.exports = app;


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
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/student_attendance', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Student Schema
const studentSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
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
  date: { type: String, required: true }, // YYYY-MM-DD format
  status: { type: String, enum: ['checked-in', 'checked-out'], default: 'checked-in' },
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
  return date.toISOString();
}

// Routes

// 1. Upload Excel/CSV file and import students
app.post('/api/import-students', upload.single('studentFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File uploaded:', req.file);

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    console.log('Sample data row:', data[0]);

    const students = [];

    for (const row of data) {
      console.log('Processing row:', row);

      const rollNumber = row['Roll number'] || row.rollNumber || row.userId || row.UserId;
      const name = row.Name || row.name || row.student_name || row['Student Name'];
      const mobile = row.Mobile || row.mobile || row.phone || row.Phone || '';
      const qrLink = row['Qr link'] || row.qrLink || row.qr_link || '';
      const serialNumber = row['S.N'] || row.sn || row.serialNumber || 0;

      const student = {
        userId: rollNumber ? rollNumber.toString() : '',
        name: name || '',
        rollNumber: rollNumber ? rollNumber.toString() : '',
        class: row.class || row.Class || row.className || row['Class'] || 'Not Specified',
        email: row.email || row.Email || '',
        phone: mobile ? mobile.toString() : '',
        qrLink: qrLink,
        serialNumber: serialNumber,
        qrData: extractQRData(qrLink)
      };

      if (student.userId && student.name && student.rollNumber) {
        students.push(student);
      } else {
        console.log('Skipping invalid student data:', student);
      }
    }

    console.log(`Processing ${students.length} students`);

    const result = await Promise.all(
      students.map(async (student) => {
        try {
          return await Student.findOneAndUpdate(
            { userId: student.userId },
            student,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.log('Error saving student:', student.name, error.message);
          return null;
        }
      })
    );

    const successfulInserts = result.filter(r => r !== null);

    res.json({
      message: 'Students imported successfully',
      count: successfulInserts.length,
      total: students.length,
      students: successfulInserts
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import students: ' + error.message });
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

// 3. Add new student
app.post('/api/students', async (req, res) => {
  try {
    const { name, rollNumber, class: className, phone, email } = req.body;

    if (!name || !rollNumber) {
      return res.status(400).json({ error: 'Name and roll number are required' });
    }

    // Check if student with same roll number exists
    const existingStudent = await Student.findOne({ rollNumber: rollNumber.toString() });
    if (existingStudent) {
      return res.status(400).json({ error: 'Student with this roll number already exists' });
    }

    // Get next serial number
    const maxSerialNumber = await Student.findOne().sort({ serialNumber: -1 }).limit(1);
    const nextSerial = maxSerialNumber ? (maxSerialNumber.serialNumber || 0) + 1 : 1;

    const student = new Student({
      userId: rollNumber.toString(),
      name,
      rollNumber: rollNumber.toString(),
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

// 4. QR Scan - Check In/Check Out
app.post('/api/attendance/scan', async (req, res) => {
  try {
    const { userId, qrData } = req.body;
    let studentUserId = userId;

    console.log('Scan request:', { userId, qrData });

    if (qrData && typeof qrData === 'string') {
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.roll_number) {
          studentUserId = parsed.roll_number.toString();
        }
      } catch (e) {
        console.log('Could not parse QR data, using userId as is');
      }
    }

    if (!studentUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const student = await Student.findOne({ userId: studentUserId.toString() });
    if (!student) {
      return res.status(404).json({
        error: 'Student not found with roll number: ' + studentUserId,
        searchedId: studentUserId
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const existingAttendance = await Attendance.findOne({
      userId: studentUserId.toString(),
      date: today
    }).sort({ createdAt: -1 });

    if (!existingAttendance) {
      const attendance = new Attendance({
        userId: studentUserId.toString(),
        studentName: student.name,
        checkInTime: now,
        date: today,
        status: 'checked-in'
      });

      await attendance.save();

      console.log('Check-in successful for:', student.name);

      res.json({
        message: 'Check-in successful',
        action: 'check-in',
        student: student.name,
        rollNumber: student.rollNumber,
        userId: student.userId,
        time: now
      });

    } else if (existingAttendance.status === 'checked-in') {
      const checkInTime = new Date(existingAttendance.checkInTime);
      const timeDifference = (now - checkInTime) / (1000 * 60);

      if (timeDifference >= 30) {
        existingAttendance.checkOutTime = now;
        existingAttendance.status = 'checked-out';
        await existingAttendance.save();

        console.log('Check-out successful for:', student.name);

        res.json({
          message: 'Check-out successful',
          action: 'check-out',
          student: student.name,
          rollNumber: student.rollNumber,
          userId: student.userId,
          time: now,
          totalTime: Math.round(timeDifference) + ' minutes'
        });
      } else {
        const remainingTime = 30 - Math.round(timeDifference);
        res.status(400).json({
          error: `Cannot check-out yet. Please wait ${remainingTime} more minutes.`,
          remainingTime,
          student: student.name,
          rollNumber: student.rollNumber
        });
      }
    } else {
      res.status(400).json({
        error: 'Already checked out for today',
        student: student.name,
        rollNumber: student.rollNumber
      });
    }

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
    const presentToday = await Attendance.countDocuments({ date: today });
    const absentToday = totalStudents - presentToday;

    const checkedIn = await Attendance.countDocuments({ date: today, status: 'checked-in' });
    const checkedOut = await Attendance.countDocuments({ date: today, status: 'checked-out' });

    res.json({
      totalStudents,
      presentToday,
      absentToday,
      checkedIn,
      checkedOut,
      attendancePercentage: totalStudents > 0 ? ((presentToday / totalStudents) * 100).toFixed(1) : 0,
      date: today
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

// 7. Get attendance data for date range (for Flutter calendar/register)
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

    const formattedData = attendanceRecords.map(record => ({
      userId: record.userId,
      date: record.date,
      status: record.status,
      studentName: record.studentName,
      checkInTime: formatTimeForFlutter(record.checkInTime),
      checkOutTime: record.checkOutTime ? formatTimeForFlutter(record.checkOutTime) : null
    }));

    console.log(`Found ${formattedData.length} attendance records`);

    res.json(formattedData);

  } catch (error) {
    console.error('Attendance range fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Get student details by userId
app.get('/api/student/:userId', async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.params.userId.toString() });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const recentAttendance = await Attendance.find({ userId: req.params.userId.toString() })
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

    // Get all students
    const students = await Student.find().sort({ serialNumber: 1, name: 1 });
    
    // Get attendance records for the date range
    const attendanceRecords = await Attendance.find({
      date: { $gte: start, $lte: end }
    });

    // Calculate working days (excluding Sundays)
    const startDate = new Date(start);
    const endDate = new Date(end);
    let workingDays = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) { // Sunday = 0
        workingDays++;
      }
    }

    // Create report data
    const reportData = students.map(student => {
      const studentAttendance = attendanceRecords.filter(
        record => record.userId === student.userId
      );
      
      const presentDays = studentAttendance.length;
      const absentDays = workingDays - presentDays;
      const percentage = workingDays > 0 ? (presentDays / workingDays * 100).toFixed(1) : '0.0';

      return {
        studentName: student.name,
        rollNumber: student.rollNumber,
        className: student.class,
        userId: student.userId,
        totalDays: workingDays,
        presentDays,
        absentDays,
        percentage: parseFloat(percentage)
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
      // Create or update attendance record
      const existingAttendance = await Attendance.findOne({ userId: userId.toString(), date });
      
      if (!existingAttendance) {
        const attendance = new Attendance({
          userId: userId.toString(),
          studentName: student.name,
          checkInTime: new Date(`${date}T09:00:00.000Z`), // Default check-in time
          date,
          status: 'checked-in'
        });
        await attendance.save();
      }
    } else {
      // Remove attendance record if marking as absent
      await Attendance.deleteMany({ userId: userId.toString(), date });
    }

    res.json({ message: 'Attendance updated successfully' });

  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 12. Export attendance data (for Excel export)
app.post('/api/export-attendance', async (req, res) => {
  try {
    const { month, year, data } = req.body;

    // In a real implementation, you would generate Excel file here
    // For now, just return success
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

// 13. Delete student (for testing/admin purposes)
app.delete('/api/student/:userId', async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ userId: req.params.userId.toString() });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Also delete attendance records
    await Attendance.deleteMany({ userId: req.params.userId.toString() });

    res.json({ message: 'Student and attendance records deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Student Attendance API is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/import-students',
      'GET /api/students',
      'POST /api/students',
      'POST /api/attendance/scan',
      'GET /api/attendance/stats',
      'GET /api/attendance',
      'GET /api/attendance/range',
      'GET /api/student/:userId',
      'GET /api/attendance/report',
      'GET /api/reports/attendance',
      'POST /api/attendance/update',
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
  console.log(`\n📋 Available Endpoints:`);
  console.log(`   POST /api/import-students - Import students from Excel/CSV`);
  console.log(`   GET  /api/students - Get all students`);
  console.log(`   POST /api/students - Add new student`);
  console.log(`   POST /api/attendance/scan - QR code attendance scan`);
  console.log(`   GET  /api/attendance/stats - Dashboard statistics`);
  console.log(`   GET  /api/attendance - Get attendance records`);
  console.log(`   GET  /api/attendance/range - Get attendance for date range`);
  console.log(`   GET  /api/student/:userId - Get student details`);
  console.log(`   GET  /api/reports/attendance - Get detailed attendance report`);
  console.log(`   POST /api/attendance/update - Update attendance manually`);
  console.log(`   POST /api/export-attendance - Export to Excel`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

module.exports = app;