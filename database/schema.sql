-- ============================================================================
-- College Management System — Reference MySQL Schema
-- This mirrors the JSON-file data model used by backend/db.js exactly.
-- To move the app to MySQL in production, create this schema and rewrite
-- backend/db.js to use mysql2 queries instead of the JSON file — no route
-- files need to change, since they only ever call load()/save().
-- ============================================================================

CREATE DATABASE IF NOT EXISTS college_management_system;
USE college_management_system;

CREATE TABLE departments (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  hod VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  department_id VARCHAR(10) NOT NULL,
  duration VARCHAR(30),
  semesters INT DEFAULT 6,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE faculty (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  department_id VARCHAR(10) NOT NULL,
  designation VARCHAR(50),
  qualification VARCHAR(150),
  experience VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

CREATE TABLE subjects (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  course_id VARCHAR(10) NOT NULL,
  semester INT NOT NULL,
  credits INT DEFAULT 3,
  faculty_id VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL
);

CREATE TABLE students (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  gender ENUM('Male','Female','Other') NOT NULL,
  dob DATE,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(255),
  department_id VARCHAR(10) NOT NULL,
  course_id VARCHAR(10) NOT NULL,
  semester INT NOT NULL,
  admission_year INT,
  status ENUM('Active','Inactive') DEFAULT 'Active',
  guardian VARCHAR(100),
  guardian_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
);

-- Login accounts. linked_id points to students.id or faculty.id depending on role.
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Admin','Faculty','Student') NOT NULL,
  name VARCHAR(100) NOT NULL,
  linked_id VARCHAR(20),
  email VARCHAR(150),
  must_reset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance (
  id VARCHAR(60) PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  subject_id VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  status ENUM('Present','Absent') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_attendance (student_id, subject_id, date)
);

CREATE TABLE exams (
  id VARCHAR(10) PRIMARY KEY,
  type VARCHAR(60) NOT NULL,
  subject_id VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  time VARCHAR(50),
  room VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE marks (
  id VARCHAR(60) PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  subject_id VARCHAR(10) NOT NULL,
  internal INT DEFAULT 0,
  internal_max INT DEFAULT 25,
  assignment INT DEFAULT 0,
  assignment_max INT DEFAULT 10,
  practical INT DEFAULT 0,
  practical_max INT DEFAULT 20,
  exam INT DEFAULT 0,
  exam_max INT DEFAULT 45,
  total INT,
  max_total INT,
  percentage DECIMAL(5,2),
  grade VARCHAR(2),
  result ENUM('Pass','Fail'),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_marks (student_id, subject_id)
);

CREATE TABLE fees (
  id VARCHAR(30) PRIMARY KEY,
  student_id VARCHAR(20) UNIQUE NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  paid DECIMAL(10,2) DEFAULT 0,
  status ENUM('Paid','Partially Paid','Pending') DEFAULT 'Pending',
  due_date DATE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id VARCHAR(40) PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  mode VARCHAR(30),
  receipt VARCHAR(40),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE timetable (
  id VARCHAR(10) PRIMARY KEY,
  day ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  time VARCHAR(30) NOT NULL,
  subject_id VARCHAR(10) NOT NULL,
  faculty_id VARCHAR(10) NOT NULL,
  room VARCHAR(30),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
);

CREATE TABLE assignments (
  id VARCHAR(10) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  subject_id VARCHAR(10) NOT NULL,
  faculty_id VARCHAR(10) NOT NULL,
  deadline DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
);

CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id VARCHAR(10) NOT NULL,
  student_id VARCHAR(20) NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_submission (assignment_id, student_id)
);

CREATE TABLE notices (
  id VARCHAR(10) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  category VARCHAR(30),
  date DATE NOT NULL,
  posted_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
