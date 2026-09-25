import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import PageTransition from "./components/PageTransition";
import Loader from "./components/Loader";

import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const Home = lazy(() => import("./pages/Home"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Students = lazy(() => import("./pages/Students"));
const Faculty = lazy(() => import("./pages/Faculty"));
const Departments = lazy(() => import("./pages/Departments"));
const Academics = lazy(() => import("./pages/Academics"));
const AdminTimetable = lazy(() => import("./pages/AdminTimetable"));
const Exams = lazy(() => import("./pages/Exams"));
const Fees = lazy(() => import("./pages/Fees"));
const Notices = lazy(() => import("./pages/Notices"));
const Assignments = lazy(() => import("./pages/Assignments"));
const Reports = lazy(() => import("./pages/Reports"));
const AdmissionInquiries = lazy(() => import("./pages/AdmissionInquiries"));
const CollegeProfile = lazy(() => import("./pages/CollegeProfile"));
const SportsAchievementsAdmin = lazy(() => import("./pages/SportsAchievementsAdmin"));
const AcademicMeritAdmin = lazy(() => import("./pages/AcademicMeritAdmin"));
const GalleryAdmin = lazy(() => import("./pages/GalleryAdmin"));
const UserAccounts = lazy(() => import("./pages/UserAccounts"));
const EnrollStudent = lazy(() => import("./pages/EnrollStudent"));
const AnnouncementsAdmin = lazy(() => import("./pages/AnnouncementsAdmin"));
const AnnouncementsView = lazy(() => import("./pages/AnnouncementsView"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const AcademicSetup = lazy(() => import("./pages/AcademicSetup"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const FacultyAssignments = lazy(() => import("./pages/FacultyAssignments"));
const AttendanceReport = lazy(() => import("./pages/AttendanceReport"));
const AttendanceRegisters = lazy(() => import("./pages/AttendanceRegisters"));
const InternalMarks = lazy(() => import("./pages/InternalMarks"));
const MyInternalMarks = lazy(() => import("./pages/MyInternalMarks"));
const LeaveRequests = lazy(() => import("./pages/LeaveRequests"));
const AcademicPolicies = lazy(() => import("./pages/AcademicPolicies"));

const FacultyDirectory = lazy(() => import("./pages/FacultyDirectory"));
const FacultyProfile = lazy(() => import("./pages/FacultyProfile"));
const PublicSports = lazy(() => import("./pages/PublicSports"));
const PublicAchievements = lazy(() => import("./pages/PublicAchievements"));
const PublicGallery = lazy(() => import("./pages/PublicGallery"));
const DepartmentsPublic = lazy(() => import("./pages/DepartmentsPublic"));
const DepartmentProfile = lazy(() => import("./pages/DepartmentProfile"));
const TeamsPublic = lazy(() => import("./pages/TeamsPublic"));
const TeamProfile = lazy(() => import("./pages/TeamProfile"));
const TeamMemberProfile = lazy(() => import("./pages/TeamMemberProfile"));
const TeamsAdmin = lazy(() => import("./pages/TeamsAdmin"));
const TeamMembersAdmin = lazy(() => import("./pages/TeamMembersAdmin"));

const FacultyDashboard = lazy(() => import("./pages/FacultyDashboard"));
const AttendanceMark = lazy(() => import("./pages/Attendance"));
const Marks = lazy(() => import("./pages/Marks"));
const FacultyTimetable = lazy(() => import("./pages/FacultyTimetable"));

const AttendanceStaffDashboard = lazy(() => import("./pages/AttendanceStaffDashboard"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));

const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const StudentAttendance = lazy(() => import("./pages/StudentAttendance"));
const Results = lazy(() => import("./pages/Results"));
const StudentFees = lazy(() => import("./pages/StudentFees"));
const StudentTimetable = lazy(() => import("./pages/StudentTimetable"));
const NoticesView = lazy(() => import("./pages/NoticesView"));

function Wrapped({ role, title, children }) {
  return (
    <ProtectedRoute role={role}>
      <Layout role={role} title={title}>
        <PageTransition>
          <Suspense fallback={<Loader label="Loading…" />}>{children}</Suspense>
        </PageTransition>
      </Layout>
    </ProtectedRoute>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        {/* Each role's sign-in can be linked directly, e.g. /login/faculty. */}
        <Route path="/login/:role" element={<Login />} />
        <Route path="/" element={<Suspense fallback={<Loader full label="Loading…" />}><Home /></Suspense>} />

        {/* Public site */}
        <Route path="/faculty-directory" element={<Suspense fallback={<Loader full label="Loading…" />}><FacultyDirectory /></Suspense>} />
        <Route path="/faculty-directory/:id" element={<Suspense fallback={<Loader full label="Loading…" />}><FacultyProfile /></Suspense>} />
        <Route path="/sports" element={<Suspense fallback={<Loader full label="Loading…" />}><PublicSports /></Suspense>} />
        <Route path="/achievements" element={<Suspense fallback={<Loader full label="Loading…" />}><PublicAchievements /></Suspense>} />
        <Route path="/gallery" element={<Suspense fallback={<Loader full label="Loading…" />}><PublicGallery /></Suspense>} />
        <Route path="/departments" element={<Suspense fallback={<Loader full label="Loading…" />}><DepartmentsPublic /></Suspense>} />
        <Route path="/departments/:id" element={<Suspense fallback={<Loader full label="Loading…" />}><DepartmentProfile /></Suspense>} />
        <Route path="/teams" element={<Suspense fallback={<Loader full label="Loading…" />}><TeamsPublic /></Suspense>} />
        <Route path="/teams/:id" element={<Suspense fallback={<Loader full label="Loading…" />}><TeamProfile /></Suspense>} />
        <Route path="/members/:id" element={<Suspense fallback={<Loader full label="Loading…" />}><TeamMemberProfile /></Suspense>} />

        {/* Admin */}
        <Route path="/admin" element={<Wrapped role="Admin" title="Admin Dashboard"><AdminDashboard /></Wrapped>} />
        <Route path="/admin/students" element={<Wrapped role="Admin" title="Student Management"><Students /></Wrapped>} />
        <Route path="/admin/enroll" element={<Wrapped role="Admin" title="Enroll Student"><EnrollStudent /></Wrapped>} />
        <Route path="/admin/users" element={<Wrapped role="Admin" title="Login Accounts"><UserAccounts /></Wrapped>} />
        <Route path="/admin/faculty-assignments" element={<Wrapped role="Admin" title="Teaching Assignments"><FacultyAssignments /></Wrapped>} />
        <Route path="/admin/academic-setup" element={<Wrapped role="Admin" title="Academic Setup"><AcademicSetup /></Wrapped>} />
        <Route path="/admin/announcements" element={<Wrapped role="Admin" title="Announcements"><AnnouncementsAdmin /></Wrapped>} />
        <Route path="/admin/audit" element={<Wrapped role="Admin" title="Audit Log"><AuditLog /></Wrapped>} />
        <Route path="/admin/faculty" element={<Wrapped role="Admin" title="Faculty Management"><Faculty /></Wrapped>} />
        <Route path="/admin/departments" element={<Wrapped role="Admin" title="Departments"><Departments /></Wrapped>} />
        <Route path="/admin/academics" element={<Wrapped role="Admin" title="Courses & Subjects"><Academics /></Wrapped>} />
        <Route path="/admin/timetable" element={<Wrapped role="Admin" title="Timetable"><AdminTimetable /></Wrapped>} />
        <Route path="/admin/exams" element={<Wrapped role="Admin" title="Examinations"><Exams /></Wrapped>} />
        <Route path="/admin/attendance" element={<Wrapped role="Admin" title="Mark Attendance"><AttendanceMark /></Wrapped>} />
        <Route path="/admin/attendance/registers" element={<Wrapped role="Admin" title="Attendance Management"><AttendanceRegisters /></Wrapped>} />
        <Route path="/admin/attendance/reports" element={<Wrapped role="Admin" title="Attendance Reports"><AttendanceReport /></Wrapped>} />
        <Route path="/admin/internal-marks" element={<Wrapped role="Admin" title="Internal Marks"><InternalMarks /></Wrapped>} />
        <Route path="/admin/leave-requests" element={<Wrapped role="Admin" title="Leave Requests"><LeaveRequests /></Wrapped>} />
        <Route path="/admin/academic-policies" element={<Wrapped role="Admin" title="Academic Policies"><AcademicPolicies /></Wrapped>} />
        <Route path="/admin/fees" element={<Wrapped role="Admin" title="Fee Management"><Fees /></Wrapped>} />
        <Route path="/admin/assignments" element={<Wrapped role="Admin" title="Assignments"><Assignments /></Wrapped>} />
        <Route path="/admin/notices" element={<Wrapped role="Admin" title="Notices"><Notices /></Wrapped>} />
        <Route path="/admin/reports" element={<Wrapped role="Admin" title="Reports"><Reports /></Wrapped>} />
        <Route path="/admin/admissions" element={<Wrapped role="Admin" title="Admissions Inquiries"><AdmissionInquiries /></Wrapped>} />
        <Route path="/admin/college-profile" element={<Wrapped role="Admin" title="College Profile"><CollegeProfile /></Wrapped>} />
        <Route path="/admin/sports-achievements" element={<Wrapped role="Admin" title="Sports Achievements"><SportsAchievementsAdmin /></Wrapped>} />
        <Route path="/admin/academic-merit" element={<Wrapped role="Admin" title="Academic Merit List"><AcademicMeritAdmin /></Wrapped>} />
        <Route path="/admin/gallery" element={<Wrapped role="Admin" title="Gallery"><GalleryAdmin /></Wrapped>} />
        <Route path="/admin/teams" element={<Wrapped role="Admin" title="Teams"><TeamsAdmin /></Wrapped>} />
        <Route path="/admin/team-members" element={<Wrapped role="Admin" title="Team Members"><TeamMembersAdmin /></Wrapped>} />

        {/* Faculty */}
        <Route path="/faculty" element={<Wrapped role="Faculty" title="Faculty Dashboard"><FacultyDashboard /></Wrapped>} />
        <Route path="/faculty/attendance" element={<Wrapped role="Faculty" title="Mark Attendance"><AttendanceMark /></Wrapped>} />
        <Route path="/faculty/marks" element={<Wrapped role="Faculty" title="Marks Entry"><Marks /></Wrapped>} />
        <Route path="/faculty/assignments" element={<Wrapped role="Faculty" title="Assignments"><Assignments /></Wrapped>} />
        <Route path="/faculty/timetable" element={<Wrapped role="Faculty" title="My Timetable"><FacultyTimetable /></Wrapped>} />
        <Route path="/faculty/notices" element={<Wrapped role="Faculty" title="Notices"><Notices /></Wrapped>} />
        <Route path="/faculty/announcements" element={<Wrapped role="Faculty" title="Announcements"><AnnouncementsView /></Wrapped>} />
        <Route path="/faculty/report" element={<Wrapped role="Faculty" title="Attendance Reports"><AttendanceReport /></Wrapped>} />
        <Route path="/faculty/attendance/registers" element={<Wrapped role="Faculty" title="Attendance Management"><AttendanceRegisters /></Wrapped>} />
        <Route path="/faculty/internal-marks" element={<Wrapped role="Faculty" title="Internal Marks"><InternalMarks /></Wrapped>} />
        <Route path="/faculty/leave-requests" element={<Wrapped role="Faculty" title="Leave Requests"><LeaveRequests /></Wrapped>} />

        {/* Attendance Staff */}
        <Route path="/attendance-staff" element={<Wrapped role="Attendance Staff" title="Mark Attendance"><AttendanceStaffDashboard /></Wrapped>} />
        <Route path="/attendance-staff/registers" element={<Wrapped role="Attendance Staff" title="Attendance Management"><AttendanceRegisters /></Wrapped>} />
        <Route path="/attendance-staff/report" element={<Wrapped role="Attendance Staff" title="Attendance Reports"><AttendanceReport /></Wrapped>} />
        <Route path="/attendance-staff/announcements" element={<Wrapped role="Attendance Staff" title="Announcements"><AnnouncementsView /></Wrapped>} />

        {/* Parent */}
        <Route path="/parent" element={<Wrapped role="Parent" title="Parent Dashboard"><ParentDashboard /></Wrapped>} />
        <Route path="/parent/attendance" element={<Wrapped role="Parent" title="Attendance"><StudentAttendance /></Wrapped>} />
        <Route path="/parent/internal-marks" element={<Wrapped role="Parent" title="Internal Marks"><MyInternalMarks /></Wrapped>} />
        <Route path="/parent/leave" element={<Wrapped role="Parent" title="Leave Requests"><LeaveRequests /></Wrapped>} />
        <Route path="/parent/announcements" element={<Wrapped role="Parent" title="Announcements"><AnnouncementsView /></Wrapped>} />

        {/* Student */}
        <Route path="/student" element={<Wrapped role="Student" title="Student Dashboard"><StudentDashboard /></Wrapped>} />
        <Route path="/student/profile" element={<Wrapped role="Student" title="My Profile"><StudentProfile /></Wrapped>} />
        <Route path="/student/announcements" element={<Wrapped role="Student" title="Announcements"><AnnouncementsView /></Wrapped>} />
        <Route path="/student/attendance" element={<Wrapped role="Student" title="My Attendance"><StudentAttendance /></Wrapped>} />
        <Route path="/student/internal-marks" element={<Wrapped role="Student" title="Internal Marks"><MyInternalMarks /></Wrapped>} />
        <Route path="/student/leave" element={<Wrapped role="Student" title="Leave Requests"><LeaveRequests /></Wrapped>} />
        <Route path="/student/results" element={<Wrapped role="Student" title="Marks & Results"><Results /></Wrapped>} />
        <Route path="/student/fees" element={<Wrapped role="Student" title="Fee Status"><StudentFees /></Wrapped>} />
        <Route path="/student/timetable" element={<Wrapped role="Student" title="My Timetable"><StudentTimetable /></Wrapped>} />
        <Route path="/student/assignments" element={<Wrapped role="Student" title="Assignments"><Assignments /></Wrapped>} />
        <Route path="/student/notices" element={<Wrapped role="Student" title="Notices"><NoticesView /></Wrapped>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <DataProvider>
              <AnimatedRoutes />
            </DataProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
