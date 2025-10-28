// const express = require('express');
// const mongoose = require('mongoose');
// const multer = require('multer');
// const xlsx = require('xlsx');
// const cors = require('cors');
// const path = require('path');
// const fs = require('fs');

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

// // Student Schema - UPDATED WITH RFID SUPPORT
// const studentSchema = new mongoose.Schema({
//   userId: { type: String, required: true, unique: true },
//   name: { type: String, required: true },
//   rollNumber: { type: String, required: true },
//   rfidNumber: { type: String, default: '', unique: true, sparse: true }, // RFID support added
//   class: { type: String, required: true, default: 'Not Specified' },
//   email: { type: String, default: '' },
//   phone: { type: String, default: '' },
//   qrData: { type: Object },
//   qrLink: { type: String },
//   serialNumber: { type: Number },
//   createdAt: { type: Date, default: Date.now }
// });

// // Attendance Schema
// const attendanceSchema = new mongoose.Schema({
//   userId: { type: String, required: true },
//   studentName: { type: String, required: true },
//   checkInTime: { type: Date, required: true },
//   checkOutTime: { type: Date },
//   date: { type: String, required: true },
//   status: { type: String, enum: ['checked-in', 'checked-out'], default: 'checked-in' },
//   scanType: { type: String, enum: ['qr', 'rfid'], default: 'qr' }, // Track scan type
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

// // Helper function to format time for Flutter
// function formatTimeForFlutter(date) {
//   return date.toISOString();
// }

// // Routes

// // 1. Upload Excel/CSV file and import students - UPDATED WITH RFID SUPPORT
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

//       const rollNumber = row['Roll number'] || row.rollNumber || row.userId || row.UserId;
//       const name = row.Name || row.name || row.student_name || row['Student Name'];
//       const mobile = row.Mobile || row.mobile || row.phone || row.Phone || '';
//       const qrLink = row['Qr link'] || row.qrLink || row.qr_link || '';
//       const serialNumber = row['S.N'] || row.sn || row.serialNumber || 0;
//       // RFID field support
//       const rfidNumber = row.RFID || row.rfid || row.rfid_number || row['RFID Number'] || '';

//       const student = {
//         userId: rollNumber ? rollNumber.toString() : '',
//         name: name || '',
//         rollNumber: rollNumber ? rollNumber.toString() : '',
//         rfidNumber: rfidNumber ? rfidNumber.toString() : '', // RFID added
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

// // 3. Add new student - UPDATED WITH RFID SUPPORT
// app.post('/api/students', async (req, res) => {
//   try {
//     const { name, rollNumber, rfidNumber, class: className, phone, email } = req.body;

//     if (!name || !rollNumber) {
//       return res.status(400).json({ error: 'Name and roll number are required' });
//     }

//     // Check if student with same roll number exists
//     const existingStudent = await Student.findOne({ rollNumber: rollNumber.toString() });
//     if (existingStudent) {
//       return res.status(400).json({ error: 'Student with this roll number already exists' });
//     }

//     // Check if RFID number already exists (if provided)
//     if (rfidNumber) {
//       const existingRFID = await Student.findOne({ rfidNumber: rfidNumber.toString() });
//       if (existingRFID) {
//         return res.status(400).json({ error: 'Student with this RFID number already exists' });
//       }
//     }

//     // Get next serial number
//     const maxSerialNumber = await Student.findOne().sort({ serialNumber: -1 }).limit(1);
//     const nextSerial = maxSerialNumber ? (maxSerialNumber.serialNumber || 0) + 1 : 1;

//     const student = new Student({
//       userId: rollNumber.toString(),
//       name,
//       rollNumber: rollNumber.toString(),
//       rfidNumber: rfidNumber ? rfidNumber.toString() : '',
//       class: className || 'Not Specified',
//       phone: phone || '',
//       email: email || '',
//       serialNumber: nextSerial
//     });

//     await student.save();
//     res.status(201).json(student);

//   } catch (error) {
//     console.error('Error adding student:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 4. QR/RFID Scan - Check In/Check Out - UPDATED TO SUPPORT BOTH
// // app.post('/api/attendance/scan', async (req, res) => {
// //   try {
// //     const { userId, qrData } = req.body;
// //     let studentUserId = userId;
// //     let scanType = 'qr'; // default

// //     console.log('Scan request:', { userId, qrData });

// //     // Try to parse QR data if provided
// //     if (qrData && typeof qrData === 'string') {
// //       try {
// //         const parsed = JSON.parse(qrData);
// //         if (parsed.roll_number) {
// //           studentUserId = parsed.roll_number.toString();
// //           scanType = 'qr';
// //         }
// //       } catch (e) {
// //         console.log('Could not parse QR data, treating as direct input');
// //       }
// //     }

// //     if (!studentUserId) {
// //       return res.status(400).json({ error: 'User ID or RFID is required' });
// //     }

// //     // Try to find student by roll number first (userId)
// //     let student = await Student.findOne({ userId: studentUserId.toString() });
    
// //     // If not found by userId, try RFID number
// //     if (!student) {
// //       student = await Student.findOne({ rfidNumber: studentUserId.toString() });
// //       if (student) {
// //         scanType = 'rfid';
// //         studentUserId = student.userId; // Use the actual userId for attendance
// //         console.log(`Student found by RFID: ${student.name}`);
// //       }
// //     }

// //     if (!student) {
// //       return res.status(404).json({
// //         error: 'Student not found with ID/RFID: ' + studentUserId,
// //         searchedId: studentUserId
// //       });
// //     }

// //     const today = new Date().toISOString().split('T')[0];
// //     const now = new Date();

// //     const existingAttendance = await Attendance.findOne({
// //       userId: student.userId.toString(),
// //       date: today
// //     }).sort({ createdAt: -1 });

// //     if (!existingAttendance) {
// //       // First scan - Check In
// //       const attendance = new Attendance({
// //         userId: student.userId.toString(),
// //         studentName: student.name,
// //         checkInTime: now,
// //         date: today,
// //         status: 'checked-in',
// //         scanType: scanType
// //       });

// //       await attendance.save();

// //       console.log(`Check-in successful for: ${student.name} via ${scanType.toUpperCase()}`);

// //       res.json({
// //         message: `Check-in successful via ${scanType.toUpperCase()}`,
// //         action: 'check-in',
// //         student: student.name,
// //         rollNumber: student.rollNumber,
// //         rfidNumber: student.rfidNumber || 'Not assigned',
// //         userId: student.userId,
// //         scanType: scanType,
// //         time: now
// //       });

// //     } else if (existingAttendance.status === 'checked-in') {
// //       const checkInTime = new Date(existingAttendance.checkInTime);
// //       const timeDifference = (now - checkInTime) / (1000 * 60);

// //       if (timeDifference >= 30) {
// //         // Check Out
// //         existingAttendance.checkOutTime = now;
// //         existingAttendance.status = 'checked-out';
// //         existingAttendance.scanType = scanType; // Update scan type
// //         await existingAttendance.save();

// //         console.log(`Check-out successful for: ${student.name} via ${scanType.toUpperCase()}`);

// //         res.json({
// //           message: `Check-out successful via ${scanType.toUpperCase()}`,
// //           action: 'check-out',
// //           student: student.name,
// //           rollNumber: student.rollNumber,
// //           rfidNumber: student.rfidNumber || 'Not assigned',
// //           userId: student.userId,
// //           scanType: scanType,
// //           time: now,
// //           totalTime: Math.round(timeDifference) + ' minutes'
// //         });
// //       } else {
// //         const remainingTime = 30 - Math.round(timeDifference);
// //         res.status(400).json({
// //           error: `Cannot check-out yet. Please wait ${remainingTime} more minutes.`,
// //           remainingTime,
// //           student: student.name,
// //           rollNumber: student.rollNumber,
// //           rfidNumber: student.rfidNumber || 'Not assigned'
// //         });
// //       }
// //     } else {
// //       res.status(400).json({
// //         error: 'Already checked out for today',
// //         student: student.name,
// //         rollNumber: student.rollNumber,
// //         rfidNumber: student.rfidNumber || 'Not assigned'
// //       });
// //     }

// //   } catch (error) {
// //     console.error('Attendance scan error:', error);
// //     res.status(500).json({ error: error.message });
// //   }
// // });
// app.post('/api/attendance/scan', async (req, res) => {
//   try {
//     const { userId, qrData } = req.body;
//     let studentUserId = userId;
//     let scanType = 'qr';

//     console.log('Scan request:', { userId, qrData });

//     // Parse QR data if provided
//     if (qrData && typeof qrData === 'string') {
//       try {
//         const parsed = JSON.parse(qrData);
//         if (parsed.roll_number) {
//           studentUserId = parsed.roll_number.toString();
//           scanType = 'qr';
//         }
//       } catch {
//         console.log('Could not parse QR data, treating as direct input');
//       }
//     }

//     if (!studentUserId) {
//       return res.status(400).json({ error: 'User ID or RFID is required' });
//     }

//     // Find student
//     let student = await Student.findOne({ userId: studentUserId.toString() });
//     if (!student) {
//       student = await Student.findOne({ rfidNumber: studentUserId.toString() });
//       if (student) {
//         scanType = 'rfid';
//         studentUserId = student.userId;
//       }
//     }

//     if (!student) {
//       return res.status(404).json({
//         error: 'Student not found with ID/RFID: ' + studentUserId
//       });
//     }

//     const today = new Date().toISOString().split('T')[0];
//     const now = new Date();

//     // Find last attendance of the day
//     const lastAttendance = await Attendance.findOne({
//       userId: student.userId.toString(),
//       date: today
//     }).sort({ createdAt: -1 });

//     let action = 'check-in';

//     // Alternate automatically between check-in/check-out
//     if (lastAttendance && lastAttendance.status === 'checked-in') {
//       lastAttendance.checkOutTime = now;
//       lastAttendance.status = 'checked-out';
//       lastAttendance.scanType = scanType;
//       await lastAttendance.save();
//       action = 'check-out';

//       console.log(`Check-out successful for: ${student.name}`);
//       return res.json({
//         message: `Check-out successful via ${scanType.toUpperCase()}`,
//         action,
//         student: student.name,
//         rollNumber: student.rollNumber,
//         rfidNumber: student.rfidNumber || 'Not assigned',
//         userId: student.userId,
//         scanType,
//         time: now
//       });
//     }

//     // Always allow new check-in (even if multiple per day)
//     const attendance = new Attendance({
//       userId: student.userId.toString(),
//       studentName: student.name,
//       checkInTime: now,
//       date: today,
//       status: 'checked-in',
//       scanType
//     });

//     await attendance.save();

//     console.log(`Check-in successful for: ${student.name}`);
//     res.json({
//       message: `Check-in successful via ${scanType.toUpperCase()}`,
//       action,
//       student: student.name,
//       rollNumber: student.rollNumber,
//       rfidNumber: student.rfidNumber || 'Not assigned',
//       userId: student.userId,
//       scanType,
//       time: now
//     });

//   } catch (error) {
//     console.error('Attendance scan error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });


// // 5. Get attendance statistics (for Dashboard)
// app.get('/api/attendance/stats', async (req, res) => {
//   try {
//     const today = new Date().toISOString().split('T')[0];

//     const totalStudents = await Student.countDocuments();
//     const presentToday = await Attendance.countDocuments({ date: today });
//     const absentToday = totalStudents - presentToday;

//     const checkedIn = await Attendance.countDocuments({ date: today, status: 'checked-in' });
//     const checkedOut = await Attendance.countDocuments({ date: today, status: 'checked-out' });

//     // Get scan type statistics
//     const qrScans = await Attendance.countDocuments({ date: today, scanType: 'qr' });
//     const rfidScans = await Attendance.countDocuments({ date: today, scanType: 'rfid' });

//     res.json({
//       totalStudents,
//       presentToday,
//       absentToday,
//       checkedIn,
//       checkedOut,
//       qrScans,
//       rfidScans,
//       attendancePercentage: totalStudents > 0 ? ((presentToday / totalStudents) * 100).toFixed(1) : 0,
//       date: today
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 6. Get attendance records (for specific date/student)
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

// // 7. Get attendance data for date range (for Flutter calendar/register)
// app.get('/api/attendance/range', async (req, res) => {
//   try {
//     const { start, end } = req.query;

//     if (!start || !end) {
//       return res.status(400).json({
//         error: 'Both start and end date parameters are required',
//         format: 'YYYY-MM-DD'
//       });
//     }

//     console.log(`Fetching attendance from ${start} to ${end}`);

//     const attendanceRecords = await Attendance.find({
//       date: {
//         $gte: start,
//         $lte: end
//       }
//     }).sort({ date: 1, createdAt: 1 });

//     const formattedData = attendanceRecords.map(record => ({
//       userId: record.userId,
//       date: record.date,
//       status: record.status,
//       studentName: record.studentName,
//       scanType: record.scanType || 'qr',
//       checkInTime: formatTimeForFlutter(record.checkInTime),
//       checkOutTime: record.checkOutTime ? formatTimeForFlutter(record.checkOutTime) : null
//     }));

//     console.log(`Found ${formattedData.length} attendance records`);

//     res.json(formattedData);

//   } catch (error) {
//     console.error('Attendance range fetch error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 8. Get student details by userId or RFID - UPDATED
// app.get('/api/student/:identifier', async (req, res) => {
//   try {
//     const identifier = req.params.identifier.toString();
    
//     // Try to find by userId first
//     let student = await Student.findOne({ userId: identifier });
    
//     // If not found, try RFID
//     if (!student) {
//       student = await Student.findOne({ rfidNumber: identifier });
//     }

//     if (!student) {
//       return res.status(404).json({ error: 'Student not found' });
//     }

//     const recentAttendance = await Attendance.find({ userId: student.userId.toString() })
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

// // 9. Get attendance report for date range (for Reports screen)
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

// // 10. Get detailed reports with statistics (for Reports screen)
// app.get('/api/reports/attendance', async (req, res) => {
//   try {
//     const { start, end } = req.query;
    
//     if (!start || !end) {
//       return res.status(400).json({ error: 'Start and end dates are required' });
//     }

//     const students = await Student.find().sort({ serialNumber: 1, name: 1 });
    
//     const attendanceRecords = await Attendance.find({
//       date: { $gte: start, $lte: end }
//     });

//     // Calculate working days (excluding Sundays)
//     const startDate = new Date(start);
//     const endDate = new Date(end);
//     let workingDays = 0;
    
//     for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
//       if (d.getDay() !== 0) {
//         workingDays++;
//       }
//     }

//     const reportData = students.map(student => {
//       const studentAttendance = attendanceRecords.filter(
//         record => record.userId === student.userId
//       );
      
//       const presentDays = studentAttendance.length;
//       const absentDays = workingDays - presentDays;
//       const percentage = workingDays > 0 ? (presentDays / workingDays * 100).toFixed(1) : '0.0';

//       // Count scan types
//       const qrScans = studentAttendance.filter(a => a.scanType === 'qr').length;
//       const rfidScans = studentAttendance.filter(a => a.scanType === 'rfid').length;

//       return {
//         studentName: student.name,
//         rollNumber: student.rollNumber,
//         rfidNumber: student.rfidNumber || 'Not assigned',
//         className: student.class,
//         userId: student.userId,
//         totalDays: workingDays,
//         presentDays,
//         absentDays,
//         percentage: parseFloat(percentage),
//         qrScans,
//         rfidScans
//       };
//     });

//     res.json(reportData);

//   } catch (error) {
//     console.error('Reports error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 11. Update attendance manually (for Register screen editing)
// app.post('/api/attendance/update', async (req, res) => {
//   try {
//     const { userId, date, status } = req.body;

//     if (!userId || !date) {
//       return res.status(400).json({ error: 'User ID and date are required' });
//     }

//     const student = await Student.findOne({ userId: userId.toString() });
//     if (!student) {
//       return res.status(404).json({ error: 'Student not found' });
//     }

//     if (status === 'present') {
//       const existingAttendance = await Attendance.findOne({ userId: userId.toString(), date });
      
//       if (!existingAttendance) {
//         const attendance = new Attendance({
//           userId: userId.toString(),
//           studentName: student.name,
//           checkInTime: new Date(`${date}T09:00:00.000Z`),
//           date,
//           status: 'checked-in',
//           scanType: 'manual'
//         });
//         await attendance.save();
//       }
//     } else {
//       await Attendance.deleteMany({ userId: userId.toString(), date });
//     }

//     res.json({ message: 'Attendance updated successfully' });

//   } catch (error) {
//     console.error('Update attendance error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 12. Update student RFID - NEW ENDPOINT
// app.put('/api/student/:userId/rfid', async (req, res) => {
//   try {
//     const { rfidNumber } = req.body;

//     if (!rfidNumber) {
//       return res.status(400).json({ error: 'RFID number is required' });
//     }

//     // Check if RFID already exists for another student
//     const existingRFID = await Student.findOne({ 
//       rfidNumber: rfidNumber.toString(),
//       userId: { $ne: req.params.userId }
//     });

//     if (existingRFID) {
//       return res.status(400).json({ 
//         error: 'This RFID number is already assigned to another student',
//         assignedTo: existingRFID.name
//       });
//     }

//     const student = await Student.findOneAndUpdate(
//       { userId: req.params.userId.toString() },
//       { rfidNumber: rfidNumber.toString() },
//       { new: true }
//     );

//     if (!student) {
//       return res.status(404).json({ error: 'Student not found' });
//     }

//     res.json({
//       message: 'RFID number updated successfully',
//       student
//     });

//   } catch (error) {
//     console.error('Update RFID error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 13. Export attendance data (for Excel export)
// app.post('/api/export-attendance', async (req, res) => {
//   try {
//     const { month, year, data } = req.body;

//     console.log(`Export request for ${month}/${year}`);
    
//     res.json({ 
//       message: 'Export completed successfully',
//       filename: `attendance_${month}_${year}.xlsx`
//     });

//   } catch (error) {
//     console.error('Export error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // 14. Delete student (for testing/admin purposes)
// app.delete('/api/student/:userId', async (req, res) => {
//   try {
//     const student = await Student.findOneAndDelete({ userId: req.params.userId.toString() });
//     if (!student) {
//       return res.status(404).json({ error: 'Student not found' });
//     }

//     await Attendance.deleteMany({ userId: req.params.userId.toString() });

//     res.json({ message: 'Student and attendance records deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 15. Health check
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'OK',
//     message: 'Student Attendance API is running with QR & RFID support',
//     timestamp: new Date().toISOString(),
//     features: ['QR Code Scanner', 'RFID Scanner', 'Dual Mode Support'],
//     endpoints: [
//       'POST /api/import-students',
//       'GET /api/students',
//       'POST /api/students',
//       'POST /api/attendance/scan (QR & RFID)',
//       'GET /api/attendance/stats',
//       'GET /api/attendance',
//       'GET /api/attendance/range',
//       'GET /api/student/:identifier',
//       'GET /api/attendance/report',
//       'GET /api/reports/attendance',
//       'POST /api/attendance/update',
//       'PUT /api/student/:userId/rfid (Update RFID)',
//       'POST /api/export-attendance',
//       'DELETE /api/student/:userId'
//     ]
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
//   console.log(`\n🎯 Features Enabled:`);
//   console.log(`   ✓ QR Code Scanner Support`);
//   console.log(`   ✓ RFID Card Scanner Support`);
//   console.log(`   ✓ Dual Mode Attendance`);
//   console.log(`\n📋 Key Endpoints:`);
//   console.log(`   POST /api/attendance/scan - Attendance via QR/RFID`);
//   console.log(`   PUT  /api/student/:userId/rfid - Update student RFID`);
//   console.log(`   GET  /api/attendance/stats - Statistics with scan types`);
//   console.log(`   GET  /api/student/:identifier - Search by Roll or RFID`);
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
mongoose.connect('mongodb://localhost:27017/learner_attendance', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Learner Schema - UPDATED WITH RFID & SUBJECT SUPPORT
const learnerSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
  rfidNumber: { type: String, default: '', unique: true, sparse: true },
  class: { type: String, required: true, default: 'Not Specified' },
  subject: { type: String, default: 'General' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  qrData: { type: Object },
  qrLink: { type: String },
  serialNumber: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

// Attendance Schema - MULTIPLE SESSIONS PER DAY
const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  learnerName: { type: String, required: true },
  checkInTime: { type: Date, required: true },
  checkOutTime: { type: Date },
  date: { type: String, required: true },
  status: { type: String, enum: ['checked-in', 'checked-out'], default: 'checked-in' },
  scanType: { type: String, enum: ['qr', 'rfid', 'manual'], default: 'qr' },
  sessionNumber: { type: Number, default: 1 },
  subject: { type: String, default: 'General' },
  createdAt: { type: Date, default: Date.now }
});

// Holiday Schema
const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  reason: { type: String, default: 'Holiday' },
  createdBy: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const Learner = mongoose.model('Learner', learnerSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Holiday = mongoose.model('Holiday', holidaySchema);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) cb(null, true);
    else cb(new Error('Only Excel and CSV files allowed!'), false);
  }
});

// Helper functions
function extractQRData(qrLink) {
  try {
    if (!qrLink) return null;
    const dataParam = qrLink.split('data=')[1];
    if (dataParam) {
      const decodedData = decodeURIComponent(dataParam);
      return JSON.parse(decodedData);
    }
  } catch (e) {
    console.log('Could not parse QR data:', qrLink);
  }
  return null;
}

function formatTimeForFlutter(date) {
  return date.toISOString();
}

// ========== ROUTES ==========

// 1. Import learners from Excel/CSV
app.post('/api/import-learners', upload.single('learnerFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const learners = [];
    for (const row of data) {
      const rollNumber = row['Roll number'] || row.rollNumber || row.userId || row.UserId;
      const name = row.Name || row.name || row.learner_name || row['Learner Name'];
      const mobile = row.Mobile || row.mobile || row.phone || row.Phone || '';
      const qrLink = row['Qr link'] || row.qrLink || row.qr_link || '';
      const serialNumber = row['S.N'] || row.sn || row.serialNumber || 0;
      const rfidNumber = row.RFID || row.rfid || row.rfid_number || row['RFID Number'] || '';
      const subject = row.Subject || row.subject || row.course || row.Course || 'General';

      const learner = {
        userId: rollNumber ? rollNumber.toString() : '',
        name: name || '',
        rollNumber: rollNumber ? rollNumber.toString() : '',
        rfidNumber: rfidNumber ? rfidNumber.toString() : '',
        class: row.class || row.Class || row.className || 'Not Specified',
        subject: subject,
        email: row.email || row.Email || '',
        phone: mobile ? mobile.toString() : '',
        qrLink: qrLink,
        serialNumber: serialNumber,
        qrData: extractQRData(qrLink)
      };

      if (learner.userId && learner.name && learner.rollNumber) {
        learners.push(learner);
      }
    }

    const result = await Promise.all(
      learners.map(async (learner) => {
        try {
          return await Learner.findOneAndUpdate(
            { userId: learner.userId },
            learner,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.log('Error saving learner:', learner.name, error.message);
          return null;
        }
      })
    );

    const successfulInserts = result.filter(r => r !== null);

    res.json({
      message: `Successfully imported ${successfulInserts.length} learners`,
      count: successfulInserts.length,
      total: learners.length,
      learners: successfulInserts
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import learners: ' + error.message });
  }
});

// 2. Get all learners with optional subject filter
app.get('/api/learners', async (req, res) => {
  try {
    const { subject } = req.query;
    let filter = {};
    
    if (subject && subject !== 'All') {
      filter.subject = subject;
    }

    const learners = await Learner.find(filter).sort({ serialNumber: 1, name: 1 });
    res.json(learners);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get all unique subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await Learner.distinct('subject');
    res.json(subjects.filter(s => s));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Add new learner
app.post('/api/learners', async (req, res) => {
  try {
    const { name, rollNumber, rfidNumber, class: className, phone, email, subject } = req.body;

    if (!name || !rollNumber) {
      return res.status(400).json({ error: 'Name and roll number are required' });
    }

    const existing = await Learner.findOne({ rollNumber: rollNumber.toString() });
    if (existing) {
      return res.status(400).json({ error: 'Learner with this roll number already exists' });
    }

    if (rfidNumber) {
      const existingRFID = await Learner.findOne({ rfidNumber: rfidNumber.toString() });
      if (existingRFID) {
        return res.status(400).json({ error: 'This RFID number is already assigned' });
      }
    }

    const maxSerial = await Learner.findOne().sort({ serialNumber: -1 }).limit(1);
    const nextSerial = maxSerial ? (maxSerial.serialNumber || 0) + 1 : 1;

    const learner = new Learner({
      userId: rollNumber.toString(),
      name,
      rollNumber: rollNumber.toString(),
      rfidNumber: rfidNumber ? rfidNumber.toString() : '',
      class: className || 'Not Specified',
      subject: subject || 'General',
      phone: phone || '',
      email: email || '',
      serialNumber: nextSerial
    });

    await learner.save();
    res.status(201).json({
      message: 'Learner added successfully',
      learner
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. QR/RFID Scan - MULTIPLE SESSIONS SUPPORT
app.post('/api/attendance/scan', async (req, res) => {
  try {
    const { userId, qrData, subject } = req.body;
    let learnerUserId = userId;
    let scanType = 'qr';

    // Parse QR data if provided
    if (qrData && typeof qrData === 'string') {
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.roll_number) {
          learnerUserId = parsed.roll_number.toString();
        }
      } catch {}
    }

    if (!learnerUserId) {
      return res.status(400).json({ error: 'User ID or RFID is required' });
    }

    // Find learner
    let learner = await Learner.findOne({ userId: learnerUserId.toString() });
    if (!learner) {
      learner = await Learner.findOne({ rfidNumber: learnerUserId.toString() });
      if (learner) {
        scanType = 'rfid';
        learnerUserId = learner.userId;
      }
    }

    if (!learner) {
      return res.status(404).json({
        error: `Learner not found with ID/RFID: ${learnerUserId}`
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Check holiday
    const holiday = await Holiday.findOne({ date: today });
    if (holiday) {
      return res.status(400).json({
        error: `Today is a holiday: ${holiday.reason}`,
        isHoliday: true,
        holidayReason: holiday.reason
      });
    }

    // Get today's attendance
    const todayAttendance = await Attendance.find({
      userId: learner.userId.toString(),
      date: today
    }).sort({ createdAt: -1 });

    const lastSession = todayAttendance[0];

    // Check if currently checked-in
    if (lastSession && lastSession.status === 'checked-in') {
      // Check-out
      lastSession.checkOutTime = now;
      lastSession.status = 'checked-out';
      await lastSession.save();

      const duration = Math.round((now - new Date(lastSession.checkInTime)) / 60000);

      return res.json({
        message: `${learner.name} checked out successfully via ${scanType.toUpperCase()}`,
        action: 'check-out',
        learner: learner.name,
        rollNumber: learner.rollNumber,
        userId: learner.userId,
        scanType,
        sessionNumber: lastSession.sessionNumber,
        checkOutTime: formatTimeForFlutter(now),
        duration: `${duration} minutes`
      });
    }

    // Create new check-in
    const sessionNumber = todayAttendance.length + 1;
    const attendance = new Attendance({
      userId: learner.userId.toString(),
      learnerName: learner.name,
      checkInTime: now,
      date: today,
      status: 'checked-in',
      scanType,
      sessionNumber,
      subject: subject || learner.subject || 'General'
    });

    await attendance.save();

    res.json({
      message: `${learner.name} checked in successfully via ${scanType.toUpperCase()} (Session ${sessionNumber})`,
      action: 'check-in',
      learner: learner.name,
      rollNumber: learner.rollNumber,
      userId: learner.userId,
      scanType,
      sessionNumber,
      checkInTime: formatTimeForFlutter(now)
    });
  } catch (error) {
    console.error('Attendance scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Get attendance statistics
app.get('/api/attendance/stats', async (req, res) => {
  try {
    const { subject } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let learnerFilter = {};
    if (subject && subject !== 'All') {
      learnerFilter.subject = subject;
    }

    const totalLearners = await Learner.countDocuments(learnerFilter);
    
    const uniqueAttendees = await Attendance.distinct('userId', { date: today });
    
    let presentToday = uniqueAttendees.length;
    if (subject && subject !== 'All') {
      const subjectLearners = await Learner.find(learnerFilter).select('userId');
      const subjectUserIds = subjectLearners.map(l => l.userId);
      presentToday = uniqueAttendees.filter(id => subjectUserIds.includes(id)).length;
    }
    
    const absentToday = totalLearners - presentToday;
    const checkedIn = await Attendance.countDocuments({ date: today, status: 'checked-in' });
    const checkedOut = await Attendance.countDocuments({ date: today, status: 'checked-out' });
    const qrScans = await Attendance.countDocuments({ date: today, scanType: 'qr' });
    const rfidScans = await Attendance.countDocuments({ date: today, scanType: 'rfid' });
    const holiday = await Holiday.findOne({ date: today });

    res.json({
      totalLearners,
      presentToday,
      absentToday,
      checkedIn,
      checkedOut,
      qrScans,
      rfidScans,
      attendancePercentage: totalLearners > 0 ? ((presentToday / totalLearners) * 100).toFixed(1) : '0.0',
      date: today,
      isHoliday: !!holiday,
      holidayReason: holiday ? holiday.reason : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get attendance records
app.get('/api/attendance', async (req, res) => {
  try {
    const { date, userId, subject, limit = 100 } = req.query;
    let filter = {};

    if (date) filter.date = date;
    if (userId) filter.userId = userId.toString();
    if (subject && subject !== 'All') filter.subject = subject;

    const attendance = await Attendance.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Get attendance for date range
app.get('/api/attendance/range', async (req, res) => {
  try {
    const { start, end, subject } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Both start and end dates are required (format: YYYY-MM-DD)'
      });
    }

    let filter = { date: { $gte: start, $lte: end } };
    if (subject && subject !== 'All') {
      filter.subject = subject;
    }

    const attendance = await Attendance.find(filter).sort({ date: 1, createdAt: 1 });
    const holidays = await Holiday.find({ date: { $gte: start, $lte: end } });

    res.json({
      attendance: attendance.map(record => ({
        userId: record.userId,
        learnerName: record.learnerName,
        date: record.date,
        status: record.status,
        scanType: record.scanType,
        sessionNumber: record.sessionNumber,
        subject: record.subject,
        checkInTime: formatTimeForFlutter(record.checkInTime),
        checkOutTime: record.checkOutTime ? formatTimeForFlutter(record.checkOutTime) : null
      })),
      holidays: holidays.map(h => ({ date: h.date, reason: h.reason }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Holiday Management
app.post('/api/holidays', async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const holiday = new Holiday({ date, reason: reason || 'Holiday' });
    await holiday.save();

    res.json({
      message: `Holiday marked successfully for ${date}`,
      holiday
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Holiday already exists for this date' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/holidays/:date', async (req, res) => {
  try {
    const holiday = await Holiday.findOneAndDelete({ date: req.params.date });
    if (!holiday) return res.status(404).json({ error: 'Holiday not found' });

    res.json({
      message: `Holiday removed successfully for ${req.params.date}`,
      holiday
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/holidays', async (req, res) => {
  try {
    const { start, end } = req.query;
    let filter = {};
    if (start && end) {
      filter.date = { $gte: start, $lte: end };
    }
    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Get learner details
app.get('/api/learner/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier.toString();
    let learner = await Learner.findOne({ userId: identifier });
    if (!learner) {
      learner = await Learner.findOne({ rfidNumber: identifier });
    }

    if (!learner) {
      return res.status(404).json({ error: 'Learner not found' });
    }

    const recentAttendance = await Attendance.find({ userId: learner.userId.toString() })
      .sort({ date: -1, createdAt: -1 })
      .limit(20);

    res.json({
      ...learner.toObject(),
      recentAttendance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Detailed reports
app.get('/api/reports/attendance', async (req, res) => {
  try {
    const { start, end, subject } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    let learnerFilter = {};
    if (subject && subject !== 'All') {
      learnerFilter.subject = subject;
    }

    const learners = await Learner.find(learnerFilter).sort({ serialNumber: 1, name: 1 });
    
    let attendanceFilter = { date: { $gte: start, $lte: end } };
    if (subject && subject !== 'All') {
      attendanceFilter.subject = subject;
    }

    const attendanceRecords = await Attendance.find(attendanceFilter);
    const holidays = await Holiday.find({ date: { $gte: start, $lte: end } });

    const startDate = new Date(start);
    const endDate = new Date(end);
    const holidayDates = new Set(holidays.map(h => h.date));
    
    let workingDays = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (d.getDay() !== 0 && !holidayDates.has(dateStr)) {
        workingDays++;
      }
    }

    const reportData = learners.map(learner => {
      const learnerAttendance = attendanceRecords.filter(r => r.userId === learner.userId);
      const uniqueDaysPresent = new Set(learnerAttendance.map(a => a.date)).size;
      const absentDays = workingDays - uniqueDaysPresent;
      const percentage = workingDays > 0 ? (uniqueDaysPresent / workingDays * 100).toFixed(1) : '0.0';

      return {
        learnerName: learner.name,
        rollNumber: learner.rollNumber,
        rfidNumber: learner.rfidNumber || 'Not assigned',
        className: learner.class,
        subject: learner.subject,
        userId: learner.userId,
        totalDays: workingDays,
        presentDays: uniqueDaysPresent,
        absentDays,
        percentage: parseFloat(percentage),
        totalSessions: learnerAttendance.length,
        qrScans: learnerAttendance.filter(a => a.scanType === 'qr').length,
        rfidScans: learnerAttendance.filter(a => a.scanType === 'rfid').length
      };
    });

    res.json({
      reportData,
      summary: {
        totalLearners: learners.length,
        workingDays,
        holidays: holidays.length,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Update RFID
app.put('/api/learner/:userId/rfid', async (req, res) => {
  try {
    const { rfidNumber } = req.body;
    if (!rfidNumber) return res.status(400).json({ error: 'RFID number is required' });

    const existing = await Learner.findOne({ 
      rfidNumber: rfidNumber.toString(),
      userId: { $ne: req.params.userId }
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'This RFID number is already assigned to another learner',
        assignedTo: existing.name
      });
    }

    const learner = await Learner.findOneAndUpdate(
      { userId: req.params.userId.toString() },
      { rfidNumber: rfidNumber.toString() },
      { new: true }
    );

    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    res.json({
      message: 'RFID number updated successfully',
      learner
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Delete learner
app.delete('/api/learner/:userId', async (req, res) => {
  try {
    const learner = await Learner.findOneAndDelete({ userId: req.params.userId.toString() });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    await Attendance.deleteMany({ userId: req.params.userId.toString() });

    res.json({ 
      message: `Learner ${learner.name} and all attendance records deleted successfully` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Learner Attendance API with QR & RFID Support',
    timestamp: new Date().toISOString(),
    features: [
      'Multiple Sessions Per Day',
      'QR & RFID Scanner',
      'Holiday Management',
      'Subject-wise Filtering',
      'Excel Export (Daily/Weekly/Monthly)'
    ]
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Create uploads directory
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// MongoDB events
mongoose.connection.on('connected', () => console.log('✅ MongoDB connected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/`);
  console.log(`💾 Database: learner_attendance`);
  console.log(`✓ Multiple sessions per day`);
  console.log(`✓ Holiday management`);
  console.log(`✓ Subject-wise filtering`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down...');
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = app;