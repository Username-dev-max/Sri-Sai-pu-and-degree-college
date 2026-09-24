/* =========================================================================
   db.js — lightweight JSON-file persistence layer.
   No external database server required (works out of the box, "free").
   Swap-in note: every function below maps 1:1 to a SQL table (see
   /database/schema.sql in the project root) so migrating to MySQL later
   only means rewriting this file's functions, not the routes that call it.
   ========================================================================= */
const fs = require("fs");
const path = require("path");

// Location comes from storage.js (DATA_DIR), defaulting to this folder.
const { DB_PATH } = require("./storage");

function seed() {
  return {
    seq: { student: 1, faculty: 35, user: 5 },
    // Real subject-departments, derived from the actual faculty roster below.
    // vision/mission are intentionally blank — admin-editable, never invented.
    departments: [
      { id: "DEP01", name: "Kannada", code: "KAN", hod: "", vision: "", mission: "" },
      { id: "DEP02", name: "English", code: "ENG", hod: "", vision: "", mission: "" },
      { id: "DEP03", name: "Hindi", code: "HIN", hod: "", vision: "", mission: "" },
      { id: "DEP04", name: "Economics", code: "ECO", hod: "", vision: "", mission: "" },
      { id: "DEP05", name: "Business Studies", code: "BST", hod: "", vision: "", mission: "" },
      { id: "DEP06", name: "Accountancy", code: "ACC", hod: "", vision: "", mission: "" },
      { id: "DEP07", name: "Computer Science", code: "CS", hod: "", vision: "", mission: "" },
      { id: "DEP08", name: "Physics", code: "PHY", hod: "", vision: "", mission: "" },
      { id: "DEP09", name: "Mathematics", code: "MAT", hod: "", vision: "", mission: "" },
      { id: "DEP10", name: "Chemistry", code: "CHE", hod: "", vision: "", mission: "" },
      { id: "DEP11", name: "Biology", code: "BIO", hod: "", vision: "", mission: "" },
      { id: "DEP12", name: "Physical Education", code: "PE", hod: "", vision: "", mission: "" },
    ],
    /* Combinations and degree programs the college actually offers, taken
       from its own published admission posters. `active` is what the
       enrollment form filters on, so Admin controls what can be chosen
       without rows being deleted and history being lost.

       The four inactive rows at the end are the other standard Karnataka
       PUC combinations. They are shipped switched OFF and appear nowhere
       until an Admin enables one — the posters confirm only EBACs and
       HEBA for commerce, so nothing here claims an offering the college
       has not advertised. */
    courses: [
      { id: "C01", name: "PCMB", fullName: "Physics, Chemistry, Mathematics, Biology", levelId: "LVL_PUC", stream: "STR01", department: "DEP08", duration: "2 Years", semesters: 2, subjects: ["SUB04", "SUB05", "SUB06", "SUB07"], active: true },
      { id: "C02", name: "PCMCs", fullName: "Physics, Chemistry, Mathematics, Computer Science", levelId: "LVL_PUC", stream: "STR01", department: "DEP08", duration: "2 Years", semesters: 2, subjects: ["SUB04", "SUB05", "SUB06", "SUB08"], active: true },
      { id: "C03", name: "EBACs", fullName: "Economics, Business Studies, Accountancy, Computer Science", levelId: "LVL_PUC", stream: "STR02", department: "DEP04", duration: "2 Years", semesters: 2, subjects: ["SUB09", "SUB10", "SUB11", "SUB08"], active: true },
      { id: "C07", name: "HEBA", fullName: "History, Economics, Business Studies, Accountancy", levelId: "LVL_PUC", stream: "STR02", department: "DEP04", duration: "2 Years", semesters: 2, subjects: ["SUB12", "SUB09", "SUB10", "SUB11"], active: true },
      { id: "C04", name: "B.Com", fullName: "Bachelor of Commerce", levelId: "LVL_DEG", stream: "", department: "DEP06", duration: "3 Years", semesters: 6, subjects: [], active: true },
      { id: "C05", name: "BCA", fullName: "Bachelor of Computer Applications", levelId: "LVL_DEG", stream: "", department: "DEP07", duration: "3 Years", semesters: 6, subjects: [], active: true },
      { id: "C06", name: "BBA", fullName: "Bachelor of Business Administration", levelId: "LVL_DEG", stream: "", department: "DEP05", duration: "3 Years", semesters: 6, subjects: [], active: true },
      { id: "C08", name: "CEBA", fullName: "Computer Science, Economics, Business Studies, Accountancy", levelId: "LVL_PUC", stream: "STR02", department: "DEP04", duration: "2 Years", semesters: 2, subjects: ["SUB08", "SUB09", "SUB10", "SUB11"], active: false },
      { id: "C09", name: "SEBA", fullName: "Statistics, Economics, Business Studies, Accountancy", levelId: "LVL_PUC", stream: "STR02", department: "DEP04", duration: "2 Years", semesters: 2, subjects: ["SUB13", "SUB09", "SUB10", "SUB11"], active: false },
      { id: "C10", name: "MEBA", fullName: "Mathematics, Economics, Business Studies, Accountancy", levelId: "LVL_PUC", stream: "STR02", department: "DEP04", duration: "2 Years", semesters: 2, subjects: ["SUB06", "SUB09", "SUB10", "SUB11"], active: false },
      { id: "C11", name: "MSBA", fullName: "Mathematics, Statistics, Business Studies, Accountancy", levelId: "LVL_PUC", stream: "STR02", department: "DEP04", duration: "2 Years", semesters: 2, subjects: ["SUB06", "SUB13", "SUB10", "SUB11"], active: false },
    ],

    /* Subjects are stored here and referenced by id from the combinations
       above, so the frontend never hard-codes a combination's subject list.
       History and Statistics have no matching department in the faculty
       roster, so their department is left blank rather than guessed. */
    subjects: [
      { id: "SUB01", name: "Kannada", code: "KAN", department: "DEP01", type: "Language" },
      { id: "SUB02", name: "English", code: "ENG", department: "DEP02", type: "Language" },
      { id: "SUB03", name: "Hindi", code: "HIN", department: "DEP03", type: "Language" },
      { id: "SUB04", name: "Physics", code: "PHY", department: "DEP08", type: "Core" },
      { id: "SUB05", name: "Chemistry", code: "CHE", department: "DEP10", type: "Core" },
      { id: "SUB06", name: "Mathematics", code: "MAT", department: "DEP09", type: "Core" },
      { id: "SUB07", name: "Biology", code: "BIO", department: "DEP11", type: "Core" },
      { id: "SUB08", name: "Computer Science", code: "CS", department: "DEP07", type: "Core" },
      { id: "SUB09", name: "Economics", code: "ECO", department: "DEP04", type: "Core" },
      { id: "SUB10", name: "Business Studies", code: "BST", department: "DEP05", type: "Core" },
      { id: "SUB11", name: "Accountancy", code: "ACC", department: "DEP06", type: "Core" },
      { id: "SUB12", name: "History", code: "HIS", department: "", type: "Core" },
      { id: "SUB13", name: "Statistics", code: "STA", department: "", type: "Core" },
      { id: "SUB14", name: "Physical Education", code: "PE", department: "DEP12", type: "Core" },
    ],
    // Real 35-member faculty roster. No email/phone was supplied for any of
    // these — left blank rather than invented (see routes/faculty.js, which
    // no longer requires them). Two records ("Umesh Sir", "Roy M")
    // had no clear subject/experience/qualification in the source list and
    // are marked "[VERIFY]" rather than guessed.
    faculty: [
      { id: "F001", name: "Murali Krishna", email: "", phone: "", department: "DEP01", designation: "Assistant Professor", qualification: "D.Ed, B.Ed, M.A", experience: "8 Years" },
      { id: "F002", name: "Chalapathi H.R", email: "", phone: "", department: "DEP01", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "15 Years" },
      { id: "F003", name: "Anil Kumar V", email: "", phone: "", department: "DEP01", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "9 Years" },
      { id: "F004", name: "Shivappa K.N", email: "", phone: "", department: "DEP01", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "3 Years" },
      { id: "F005", name: "Purnima K.R", email: "", phone: "", department: "DEP01", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "7 Years" },
      { id: "F006", name: "Tejaswini", email: "", phone: "", department: "DEP02", designation: "Assistant Professor", qualification: "M.A, B.Ed, English Literature", experience: "8 Years" },
      { id: "F007", name: "Nagesh R", email: "", phone: "", department: "DEP02", designation: "Assistant Professor", qualification: "M.A, B.Ed, KSET", experience: "12 Years" },
      { id: "F008", name: "Vishwanath", email: "", phone: "", department: "DEP02", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "8 Years" },
      { id: "F009", name: "Leena", email: "", phone: "", department: "DEP02", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "7 Years" },
      { id: "F010", name: "Mary Preeda", email: "", phone: "", department: "DEP02", designation: "Assistant Professor", qualification: "M.A, D.Ed, B.Ed", experience: "3 Years" },
      { id: "F011", name: "Baby Anitha", email: "", phone: "", department: "DEP04", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "22 Years" },
      { id: "F012", name: "Kishore S", email: "", phone: "", department: "DEP04", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "3 Years" },
      { id: "F013", name: "Sathish Reddy", email: "", phone: "", department: "DEP05", designation: "Assistant Professor", qualification: "M.Com, B.Ed", experience: "15 Years" },
      { id: "F014", name: "Bhoomika M.N", email: "", phone: "", department: "DEP05", designation: "Assistant Professor", qualification: "M.Com, B.Ed", experience: "3 Years" },
      { id: "F015", name: "Pallavi K.L", email: "", phone: "", department: "DEP05", designation: "Assistant Professor", qualification: "M.Com, B.Ed", experience: "3 Years" },
      { id: "F016", name: "Naveen Kumar A.S", email: "", phone: "", department: "DEP06", designation: "Assistant Professor", qualification: "M.Com, B.Ed", experience: "15 Years" },
      { id: "F017", name: "Lokesh", email: "", phone: "", department: "DEP06", designation: "Assistant Professor", qualification: "M.Com, B.Ed", experience: "5 Years" },
      { id: "F018", name: "Swathi J.S", email: "", phone: "", department: "DEP06", designation: "Assistant Professor", qualification: "M.Com, B.Ed", experience: "4 Years" },
      { id: "F019", name: "Shashi Kumar P.V", email: "", phone: "", department: "DEP07", designation: "Assistant Professor", qualification: "M.Sc Computer Science", experience: "23 Years" },
      { id: "F020", name: "Leema Prathibha", email: "", phone: "", department: "DEP07", designation: "Assistant Professor", qualification: "B.E, B.Ed, M.Tech", experience: "4 Years" },
      { id: "F021", name: "Praveen", email: "", phone: "", department: "DEP07", designation: "Assistant Professor", qualification: "MCA, B.Ed", experience: "3 Years" },
      { id: "F022", name: "Yagandhar A", email: "", phone: "", department: "DEP08", designation: "Assistant Professor", qualification: "M.Sc, B.Ed", experience: "22 Years" },
      { id: "F023", name: "Naveen Kumar H.S", email: "", phone: "", department: "DEP09", designation: "Assistant Professor", qualification: "M.Sc, B.Ed", experience: "5 Years" },
      { id: "F024", name: "Nagesh K.M", email: "", phone: "", department: "DEP10", designation: "Assistant Professor", qualification: "M.Sc, B.Ed, KSET", experience: "16 Years" },
      { id: "F025", name: "Sowmya A", email: "", phone: "", department: "DEP11", designation: "Assistant Professor", qualification: "M.Sc, B.Ed", experience: "7 Years" },
      { id: "F026", name: "Vinod B", email: "", phone: "", department: "DEP11", designation: "Assistant Professor", qualification: "M.Sc, B.Ed", experience: "3 Years" },
      { id: "F027", name: "Dhanush", email: "", phone: "", department: "DEP10", designation: "Assistant Professor", qualification: "M.Sc, B.Ed", experience: "3 Years" },
      { id: "F028", name: "Mounika K", email: "", phone: "", department: "DEP09", designation: "Assistant Professor", qualification: "M.Sc, B.Ed", experience: "3 Years" },
      { id: "F029", name: "Rashmitha", email: "", phone: "", department: "DEP08", designation: "Assistant Professor", qualification: "M.Sc, B.Ed", experience: "8 Years" },
      { id: "F030", name: "Sumithra V", email: "", phone: "", department: "DEP03", designation: "Assistant Professor", qualification: "M.A, B.Ed", experience: "15 Years" },
      { id: "F031", name: "Umesh Sir", email: "", phone: "", department: "", designation: "[VERIFY]", qualification: "[VERIFY]", experience: "[VERIFY]" },
      { id: "F032", name: "Roy M", email: "", phone: "", department: "", designation: "[VERIFY]", qualification: "[VERIFY]", experience: "[VERIFY]" },
      { id: "F033", name: "Shanmuga V", email: "", phone: "", department: "DEP12", designation: "Assistant Professor", qualification: "M.P.Ed", experience: "6 Years" },
      { id: "F034", name: "K. Pavithra Ravi", email: "", phone: "", department: "DEP07", designation: "Assistant Professor", qualification: "MCA", experience: "10 Years" },
      { id: "F035", name: "Swathi Kamalini M", email: "", phone: "", department: "DEP07", designation: "Assistant Professor", qualification: "M.Tech", experience: "3 Years" },
    ],
    // No real student data was supplied. One generically-labeled demo record is
    // kept only so the Student dashboard can be logged into and tested — never
    // presented on the public site.
    students: [
      { id: "S001", name: "[ADD STUDENT NAME]", gender: "", dob: "", email: "", phone: "", address: "", department: "DEP07", course: "C04", semester: 1, admissionYear: 2026, status: "Active", guardian: "", guardianPhone: "" },
    ],
    users: [
      // No password appears here. ensureSeedUsers() gives each account a real
      // one on first run, from SEED_ADMIN_PASSWORD or a generated value.
      { id: 1, username: "admin", password: null, role: "Admin", name: "Admin", linkedId: null, email: "satishreddy.kv0@gmail.com", mustReset: false },
      // The demo logins for the other roles exist so each dashboard can be
      // signed into while developing. A real deployment must not gain a login
      // nobody asked for, so production starts with the administrator alone and
      // every other account is created deliberately by an administrator.
      ...(process.env.NODE_ENV === "production"
        ? []
        : [
          { id: 2, username: "shashi.pv", password: null, role: "Faculty", name: "Shashi Kumar P.V", linkedId: "F019", email: "", mustReset: false },
          { id: 3, username: "demo.student", password: null, role: "Student", name: "[ADD STUDENT NAME]", linkedId: "S001", email: "", mustReset: false },
          // Attendance Staff marks attendance but has no academic record of their own.
          { id: 4, username: "attendance.staff", password: null, role: "Attendance Staff", name: "[ADD STAFF NAME]", linkedId: null, email: "", mustReset: false },
          // A Parent account is linked to the student whose record they may view
          // (same linkedId pattern the Student/Faculty accounts already use).
          { id: 5, username: "demo.parent", password: null, role: "Parent", name: "[ADD PARENT NAME]", linkedId: "S001", email: "", mustReset: false },
          ]),
    ],
    attendance: [],
    // Cleared: the old exam rows referenced fictional St. Joseph subject ids.
    // Admin/Faculty re-populate these for real subjects going forward.
    exams: [],
    marks: [],
    fees: [],
    payments: [],
    timetable: [],
    assignments: [],
    notices: [
      { id: "N01", title: "II PUC Annual Examination results, April 2022 — 1st place in K.G.F. Taluk", body: "Sri Sai PU and Degree College secured 1st place in K.G.F. Taluk in the II PUC Annual Examination, April 2022. See the Achievements page for the full list of meritorious students.", category: "Exam", date: "2022-04-01", postedBy: "Admin Office" },
    ],
    admissionInquiries: [],
    // Real, admin-manageable sports achievements (state-level results supplied
    // by the college). No player names or extra statistics were provided, so
    // none are shown.
    sportsAchievements: [
      { id: "SPT01", year: "2023", sport: "Kabaddi", category: "Boys", level: "State Level" },
      { id: "SPT02", year: "2024", sport: "Kabaddi", category: "Boys", level: "State Level" },
      { id: "SPT03", year: "2026", sport: "Tennis / Volleyball", category: "Boys", level: "State Level" },
      { id: "SPT04", year: "2024", sport: "Billiards", category: "", level: "State Level" },
      { id: "SPT05", year: "2024", sport: "Floor Ball", category: "", level: "State Level" },
      { id: "SPT06", year: "2024", sport: "Kho-Kho", category: "Boys", level: "State Level" },
    ],
    // Real, admin-manageable historical exam results. This is the II PUC
    // April 2022 batch (1st place, K.G.F. Taluk) — shown as historical result
    // information, never as the current student database. Future years can
    // be added the same way through /admin (same collection, different
    // examLabel).
    academicMerit: [
      { id: "MER01", name: "Divya", marks: 589, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER02", name: "Kiran", marks: 581, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER03", name: "Bhargavi", marks: 580, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER04", name: "Bhoomi", marks: 572, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER05", name: "Likitha", marks: 570, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER06", name: "Bhavya", marks: 564, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER07", name: "Balaraju", marks: 563, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER08", name: "Mounika L", marks: 562, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER09", name: "Suvarnal", marks: 561, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER10", name: "Fareen", marks: 558, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER11", name: "Raghavendra", marks: 553, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER12", name: "Ranjitha", marks: 550, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER13", name: "Preethi", marks: 548, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER14", name: "Afreen", marks: 547, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER15", name: "Mounika D.R", marks: 545, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER16", name: "Sudeep", marks: 543, examLabel: "II PUC Annual Examination — April 2022" },
      { id: "MER17", name: "Amrutha", marks: 542, examLabel: "II PUC Annual Examination — April 2022" },
    ],
    /* ---------------------------------------------------------------
       Academic structure. Enrollment reads these rather than hard-coded
       frontend lists, so the college configures what it actually offers.
       --------------------------------------------------------------- */

    // Top-level course levels. A PUC student picks a stream then a
    // combination; a Degree student picks a program directly.
    courseLevels: [
      { id: "LVL_PUC", name: "PUC", hasStreams: true, order: 1 },
      { id: "LVL_DEG", name: "Degree", hasStreams: false, order: 2 },
    ],

    // Streams sit under PUC only.
    streams: [
      { id: "STR01", name: "Science", levelId: "LVL_PUC", order: 1 },
      { id: "STR02", name: "Commerce", levelId: "LVL_PUC", order: 2 },
    ],

    // Year/class within a level ("I PUC", "II PUC", degree years).
    classes: [
      { id: "CLS01", name: "I PUC", levelId: "LVL_PUC", order: 1 },
      { id: "CLS02", name: "II PUC", levelId: "LVL_PUC", order: 2 },
      { id: "CLS03", name: "1st Year", levelId: "LVL_DEG", order: 3 },
      { id: "CLS04", name: "2nd Year", levelId: "LVL_DEG", order: 4 },
      { id: "CLS05", name: "3rd Year", levelId: "LVL_DEG", order: 5 },
    ],

    // Sections within a class. None are seeded — the college adds the
    // sections it actually runs rather than inheriting invented ones.
    sections: [],

    // Academic years. Admin marks one current; stats and enrollment
    // default to it.
    academicYears: [],

    // Enrollment joins a student to an academic year + class + section +
    // combination. A student can have one row per academic year, which is
    // what makes year-on-year admission statistics possible.
    enrollments: [],

    // Announcements supersede plain notices: they carry an audience so a
    // targeted item only reaches the roles/streams/classes it names.
    announcements: [],

    // Per-user in-app notifications generated by admin actions.
    notifications: [],

    // Immutable admin action trail.
    auditLogs: [],

    // Uploaded documents. `private: true` rows are never served publicly —
    // they are fetched through an authorising route, not /uploads static.
    documents: [],

    // Which faculty teaches which subject to which class/section/year.
    facultyAssignments: [],

    // One row per class whose timetable has been published. Until a row
    // exists and is published, timetable entries are Admin-only drafts.
    timetablePublications: [],

    /* -------------------------- Task 3 modules -------------------------- */

    // Class teacher per academic year + class + section. A class teacher
    // gains extra reach over THAT class only — never unrelated ones.
    classTeachers: [],

    // Study notes a faculty member uploads for a class/section/subject.
    notes: [],

    // Internal assessment marks: one row per student, subject and exam.
    // Kept apart from the legacy `marks` collection, whose fixed component
    // scheme (internal/assignment/practical/exam) doesn't fit named exams.
    internalMarks: [],

    // Student leave/absence requests, routed to the class teacher.
    leaveRequests: [],

    // Parent call follow-ups. Append-only: every call is its own record, so
    // a later call can never overwrite what an earlier one recorded.
    callFollowups: [],

    // Internal marks v2: exams are configured by an Admin; marks carry a
    // DRAFT -> SUBMITTED -> PUBLISHED status; every change is kept in history.
    internalExams: [],
    internalMarkHistory: [],
    // Attendance corrections (old status -> new status, who, when, why).
    attendanceHistory: [],
    // Low-attendance alerts, so a student is notified once per drop below the
    // threshold rather than on every register.
    attendanceAlerts: [],
    // Admin-editable academic policy. Empty here: defaults live in
    // academics.js and are merged in on read.
    settings: {},

    // Server-side login sessions, one per issued token (see middleware/auth).
    // Logout revokes a session, which is what makes a token stop working
    // immediately instead of lingering until it expires.
    authSessions: [],

    // Fee installments and receipts hang off the existing `fees` rows.
    feeInstallments: [],
    receipts: [],

    galleryItems: [],
    // "Developed By" section: the student/dev teams behind this system. Real
    // team names and member details will be supplied later — placeholders
    // only, no invented names/roles/emails.
    teams: [
      { id: "TEAM01", name: "[TEAM 01 NAME]", description: "" },
      { id: "TEAM02", name: "[TEAM 02 NAME]", description: "" },
      { id: "TEAM03", name: "[TEAM 03 NAME]", description: "" },
      { id: "TEAM04", name: "[TEAM 04 NAME]", description: "" },
      { id: "TEAM05", name: "[TEAM 05 NAME]", description: "" },
      { id: "TEAM06", name: "[TEAM 06 NAME]", description: "" },
      { id: "TEAM07", name: "[TEAM 07 NAME]", description: "" },
      { id: "TEAM08", name: "[TEAM 08 NAME]", description: "" },
    ],
    teamMembers: [],
    // Singleton, admin-editable college profile record. Only the fields the
    // user has explicitly supplied are filled in — everything else stays
    // blank until an Admin fills it in via /admin/college-profile, rather
    // than shipping invented institutional facts.
    collegeProfile: {
      name: "Sri Sai PU and Degree College",
      shortName: "",
      tagline: "",
      description: "",
      establishedYear: "",
      principalName: "",
      principalTitle: "",
      address: "Kottur Village, V. Kotta Main Road, Bethamangala, K.G.F. Taluk, Kolar District, Karnataka.",
      phone: "",
      email: "satishreddy.kv0@gmail.com",
      website: "",
      vision: "",
      mission: "",
      social: { facebook: "", twitter: "", instagram: "", linkedin: "" },
    },
  };
}

/* -------------------------------------------------------------------------
   Record-level migrations.

   load() already backfills whole collections that are new. This handles the
   other half: fields added to records that ALREADY exist in a live data.json.
   Every step must be idempotent — it runs on every boot — and must never
   overwrite a value an admin has set.
   ------------------------------------------------------------------------- */
function migrate(db) {
  let changed = false;
  const now = new Date().toISOString();

  // One-time migrations are recorded by name so they never run twice. This
  // matters for anything that INSERTS rows: without it, a row an admin
  // deliberately deleted would silently reappear on the next boot.
  if (!Array.isArray(db._migrations)) {
    db._migrations = [];
    changed = true;
  }
  const once = (name, fn) => {
    if (db._migrations.includes(name)) return;
    fn();
    db._migrations.push(name);
    changed = true;
  };

  // Make the other standard Karnataka PUC combinations available to enable.
  // They are inserted switched OFF, so they appear only in Academic Setup
  // and nowhere a student or visitor can see until an Admin turns one on.
  once("optional-puc-combinations", () => {
    const have = new Set(db.courses.map((c) => (c.name || "").toLowerCase()));
    seed()
      .courses.filter((c) => c.active === false && !have.has(c.name.toLowerCase()))
      .forEach((c) => db.courses.push({ ...c }));
  });

  // Accounts gained a lifecycle: status, creation date and last-login stamp.
  // Existing accounts are treated as Active so nobody is locked out by an
  // upgrade; `createdAt` is unknowable retrospectively and is left null
  // rather than back-dated to a date that never happened.
  db.users.forEach((u) => {
    if (u.status === undefined) {
      u.status = "Active";
      changed = true;
    }
    if (u.createdAt === undefined) {
      u.createdAt = null;
      changed = true;
    }
    if (u.lastLogin === undefined) {
      u.lastLogin = null;
      changed = true;
    }
    // A Parent may be linked to several children. `linkedId` stays as the
    // single-child field every existing route already reads; `linkedIds` is
    // the authoritative list and is kept in sync with it.
    if (u.role === "Parent" && !Array.isArray(u.linkedIds)) {
      u.linkedIds = u.linkedId ? [u.linkedId] : [];
      changed = true;
    }
  });

  // Courses gained level/stream/subject wiring. Match on name so the real
  // rows written through the API pick up their structure; anything
  // unrecognised is left for an Admin to classify rather than guessed into
  // a stream it may not belong to.
  const courseDefaults = new Map(seed().courses.map((c) => [c.name.toLowerCase(), c]));
  db.courses.forEach((c) => {
    const d = courseDefaults.get((c.name || "").toLowerCase());
    if (c.active === undefined) {
      c.active = true;
      changed = true;
    }
    if (c.levelId === undefined) {
      c.levelId = d ? d.levelId : "";
      changed = true;
    }
    if (c.stream === undefined) {
      c.stream = d ? d.stream : "";
      changed = true;
    }
    if (!Array.isArray(c.subjects)) {
      c.subjects = d ? [...d.subjects] : [];
      changed = true;
    }
    if (c.fullName === undefined) {
      c.fullName = d ? d.fullName : "";
      changed = true;
    }
  });

  // Subjects are referenced by combination rows, so seed them if the
  // collection is still empty from before they existed.
  if (Array.isArray(db.subjects) && db.subjects.length === 0) {
    db.subjects = seed().subjects;
    changed = true;
  }

  // Students gained enrollment-facing fields.
  db.students.forEach((s) => {
    for (const [field, value] of Object.entries({
      photoUrl: "",
      admissionNumber: s.id,
      emergencyContact: "",
      bloodGroup: "",
      category: "",
      levelId: "",
      stream: "",
      section: "",
      rollNumber: "",
      academicYear: "",
    })) {
      if (s[field] === undefined) {
        s[field] = value;
        changed = true;
      }
    }
  });

  // Faculty gained assignment and employment fields. Salary is admin-only —
  // it is never included in any public or student-facing projection.
  db.faculty.forEach((f) => {
    for (const [field, value] of Object.entries({
      photoUrl: "",
      joiningDate: "",
      salary: "",
      status: "Active",
      subjects: [],
      classes: [],
    })) {
      if (f[field] === undefined) {
        f[field] = Array.isArray(value) ? [] : value;
        changed = true;
      }
    }
  });

  // Sequence counters for the collections added later.
  const seqDefaults = {
    announcement: 0, notification: 0, audit: 0, enrollment: 0,
    document: 0, receipt: 0, installment: 0, assignment: 0, timetable: 0,
    note: 0, internalMark: 0, classTeacher: 0, leave: 0, followup: 0,
  };
  for (const [k, v] of Object.entries(seqDefaults)) {
    if (db.seq[k] === undefined) {
      db.seq[k] = v;
      changed = true;
    }
  }

  // A current academic year is required before anyone can be enrolled.
  // Derive the first one from today's date (Indian academic year starts in
  // June) rather than asking the Admin to bootstrap it by hand.
  if (Array.isArray(db.academicYears) && db.academicYears.length === 0) {
    const d = new Date(now);
    const startYear = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
    db.academicYears.push({
      id: `AY${startYear}`,
      label: `${startYear}-${String(startYear + 1).slice(2)}`,
      startDate: `${startYear}-06-01`,
      endDate: `${startYear + 1}-05-31`,
      isCurrent: true,
    });
    changed = true;
  }

  /* ---------------------------------------------------------------------
     BCA structure and teaching assignments.

     This is REAL configuration supplied by the college, not demo data. It
     is recorded once, so an Admin can change or delete any of it without it
     reappearing on the next boot. It runs last, after the academic year is
     guaranteed to exist, and is scoped to that year — these assignments are
     explicitly not assumed to carry into future years.
     --------------------------------------------------------------------- */
  once("bca-structure-2026", () => {
    const year = (db.academicYears || []).find((y) => y.isCurrent) || (db.academicYears || [])[0];
    const yearId = year ? year.id : "";
    const bca = db.courses.find((c) => (c.name || "").toLowerCase() === "bca");
    if (!bca) return; // no BCA programme on this install — nothing to wire
    const dept = bca.department || "DEP07";

    // Only the sections the college named for BCA 1st Year. 2nd and 3rd Year
    // run as a single class, so no section is invented for them — their
    // assignments use an empty sectionId, meaning the whole class.
    const ensureSection = (id, name) => {
      if (!db.sections.some((s) => s.id === id)) db.sections.push({ id, name });
    };
    ensureSection("SEC_AI", "AI");
    ensureSection("SEC_GEN", "General");

    const YEAR1 = "CLS03";
    const YEAR2 = "CLS04";
    const YEAR3 = "CLS05";

    // Subject names are recorded exactly as supplied. Each carries the class
    // it is taught in: every BCA student shares one course, so without this
    // a 3rd Year student would appear on a 1st Year C Programming register.
    const BCA_SUBJECTS = [
      ["BSUB01", "C Programming (Theory)", "CPT", YEAR1],
      ["BSUB02", "C Programming (Lab)", "CPL", YEAR1],
      ["BSUB03", "FOC", "FOC", YEAR1],
      ["BSUB04", "DAA", "DAA", YEAR2],
      ["BSUB05", "Java", "JAVA", YEAR2],
      ["BSUB06", "Activities", "ACT", YEAR2],
      ["BSUB07", "DBMS", "DBMS", YEAR2],
      ["BSUB08", "Software Engineering", "SE", YEAR3],
      ["BSUB09", "Web Development", "WD", YEAR3],
      ["BSUB10", "Data Analysis", "DA", YEAR3],
    ];
    BCA_SUBJECTS.forEach(([id, name, code, classId]) => {
      if (!db.subjects.some((s) => s.id === id)) {
        db.subjects.push({ id, name, code, department: dept, type: "Core", courseId: bca.id, classId });
      }
    });
    bca.subjects = [...new Set([...(bca.subjects || []), ...BCA_SUBJECTS.map(([id]) => id)])];

    // The four faculty named in the brief, matched to their OFFICIAL roster
    // records so the roster's own spelling is preserved.
    const byName = (re) => db.faculty.find((f) => re.test(f.name || ""));
    const pavitra = byName(/pavithra/i); // "K. Pavithra Ravi"
    const praveen = byName(/^praveen$/i); // "Praveen"
    const roy = byName(/\broy\b/i); // "Shrimati Roy M"
    const umesh = byName(/umesh/i); // "Umesh Sir"

    // Roy and Umesh had no department on file. Teaching only BCA subjects
    // places them in BCA's department. Their designation, qualification and
    // experience were not supplied, so those stay marked [VERIFY].
    [roy, umesh].forEach((f) => {
      if (f && !f.department) f.department = dept;
    });

    const assign = (fac, subjectId, classId, sectionId = "") => {
      if (!fac) return;
      const exists = db.facultyAssignments.some(
        (a) =>
          a.facultyId === fac.id && a.subjectId === subjectId && a.classId === classId &&
          (a.sectionId || "") === sectionId && a.academicYearId === yearId
      );
      if (exists) return;
      db.seq.assignment = (db.seq.assignment || 0) + 1;
      db.facultyAssignments.push({
        id: `FA${String(db.seq.assignment).padStart(4, "0")}`,
        facultyId: fac.id,
        subjectId,
        classId,
        sectionId,
        academicYearId: yearId,
        assignedBy: null,
        assignedAt: now,
        source: "college-configuration",
      });
    };
    // Pavitra's C Programming was given per year, not per section, so it
    // covers the whole of 1st Year. Roy's FOC was named for both sections.
    assign(pavitra, "BSUB01", YEAR1);
    assign(pavitra, "BSUB02", YEAR1);
    assign(pavitra, "BSUB04", YEAR2);
    assign(pavitra, "BSUB08", YEAR3);
    assign(praveen, "BSUB09", YEAR3);
    assign(praveen, "BSUB05", YEAR2);
    assign(praveen, "BSUB06", YEAR2);
    assign(roy, "BSUB03", YEAR1, "SEC_AI");
    assign(roy, "BSUB03", YEAR1, "SEC_GEN");
    assign(umesh, "BSUB07", YEAR2);
    assign(umesh, "BSUB10", YEAR3);

    // Keep each faculty record's denormalised subject/class lists in step.
    [pavitra, praveen, roy, umesh].filter(Boolean).forEach((f) => {
      const rows = db.facultyAssignments.filter((a) => a.facultyId === f.id);
      f.subjects = [...new Set(rows.map((a) => a.subjectId))];
      f.classes = [...new Set(rows.map((a) => a.classId).filter(Boolean))];
    });

    const classTeacher = (fac, classId, sectionId, label) => {
      if (!fac) return;
      const taken = db.classTeachers.some(
        (t) => t.classId === classId && (t.sectionId || "") === sectionId && t.academicYearId === yearId
      );
      if (taken) return;
      db.seq.classTeacher = (db.seq.classTeacher || 0) + 1;
      db.classTeachers.push({
        id: `CT${String(db.seq.classTeacher).padStart(4, "0")}`,
        academicYearId: yearId,
        courseId: bca.id,
        classId,
        sectionId,
        facultyId: fac.id,
        label,
        assignedAt: now,
        source: "college-configuration",
      });
    };
    classTeacher(pavitra, YEAR1, "SEC_AI", "BCA 1st Year — AI");
    classTeacher(roy, YEAR1, "SEC_GEN", "BCA 1st Year — General");
    classTeacher(umesh, YEAR2, "", "BCA 2nd Year");
    classTeacher(praveen, YEAR3, "", "BCA 3rd Year");
  });

  // Internal marks v2. Marks entered before exams existed carried only a free
  // text exam label. Each distinct label per academic year + class + section
  // becomes a configured exam, and the marks point at it. Those marks were
  // already shown to students and parents, so they are carried over as
  // PUBLISHED — the upgrade neither hides nor invents anything.
  once("internal-marks-v2", () => {
    db.internalExams = db.internalExams || [];
    db.internalMarkHistory = db.internalMarkHistory || [];
    const yearId = (db.academicYears.find((y) => y.isCurrent) || db.academicYears[0] || {}).id || "";
    (db.internalMarks || []).forEach((m) => {
      if (m.examId) return;
      const ay = m.academicYearId || yearId;
      let exam = db.internalExams.find(
        (e) => e.name === m.exam && e.academicYearId === ay && e.classId === m.classId && (e.sectionId || "") === (m.sectionId || "")
      );
      if (!exam) {
        db.seq.exam = (db.seq.exam || 0) + 1;
        exam = {
          id: `EXM${String(db.seq.exam).padStart(4, "0")}`,
          name: m.exam,
          type: m.exam,
          academicYearId: ay,
          classId: m.classId,
          sectionId: m.sectionId || "",
          courseId: m.courseId || "",
          semester: "",
          startDate: "",
          endDate: "",
          maxMarks: m.maxMarks,
          subjectMaxMarks: {},
          status: "ACTIVE",
          createdBy: null,
          createdByName: "Migrated from earlier marks",
          createdAt: m.enteredAt || now,
          updatedAt: null,
        };
        db.internalExams.push(exam);
      }
      if (exam.maxMarks !== m.maxMarks) exam.subjectMaxMarks[m.subjectId] = m.maxMarks;
      m.examId = exam.id;
      m.academicYearId = ay;
      m.status = m.status || "PUBLISHED";
      m.publishedAt = m.publishedAt || m.updatedAt || m.enteredAt || now;
      m.publishedBy = m.publishedBy || m.enteredBy || null;
    });
  });

  // Attendance v2: every register belongs to an academic year.
  once("attendance-v2", () => {
    const yearId = (db.academicYears.find((y) => y.isCurrent) || db.academicYears[0] || {}).id || "";
    (db.attendance || []).forEach((a) => {
      if (!a.academicYearId) a.academicYearId = yearId;
      if (a.period === undefined || a.period === null) a.period = "";
    });
  });

  return changed;
}

let cache = null;
let usingSupabase = false;

/**
 * Bring the database into memory.
 *
 * With Supabase configured this reads every table from Postgres; otherwise it
 * reads the local JSON file exactly as before. Must be awaited before the
 * first request — server.js does that.
 *
 * Either way, `load()` keeps returning the same plain-object shape, so no
 * route, service or business rule changes.
 */
async function initStore() {
  const { isEnabled } = require("./supabase");
  if (!isEnabled()) {
    load();
    return { mode: "file", location: DB_PATH };
  }
  const { hydrate, flush } = require("./supabaseStore");
  const shape = seed();
  cache = await hydrate(shape);
  // A collection added to seed() after the last migration starts empty.
  for (const key of Object.keys(shape)) {
    if (cache[key] === undefined) cache[key] = shape[key];
  }
  usingSupabase = true;
  if (migrate(cache)) await flush(cache);
  return { mode: "supabase", collections: Object.keys(cache).length };
}

function load() {
  if (cache) return cache;
  if (usingSupabase) {
    throw new Error("The database has not been loaded yet. initStore() must finish before the first request.");
  }
  if (!fs.existsSync(DB_PATH)) {
    // A brand-new install must end up identical to an upgraded one, so the
    // migrations run here too. Without this, the very first boot had no
    // academic year (enrollment failed), no BCA configuration and no account
    // status fields until the backend happened to be restarted.
    cache = seed();
    migrate(cache);
    save(cache);
  } else {
    cache = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    // Backfill top-level keys added after this data.json was first created,
    // so existing persisted databases pick up new collections/records
    // without a reset (see seed() above for the canonical shape).
    const defaults = seed();
    let changed = false;
    for (const key of Object.keys(defaults)) {
      if (!(key in cache)) {
        cache[key] = defaults[key];
        changed = true;
      }
    }
    if (migrate(cache)) changed = true;
    if (changed) save(cache);
  }
  return cache;
}

function save(data = cache) {
  if (usingSupabase) {
    // Writes only what changed, queued so two saves never interleave.
    require("./supabaseStore").flush(data);
    return;
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/** Wait for every queued Supabase write. A no-op on the local file. */
function flushNow() {
  return usingSupabase ? require("./supabaseStore").flushNow() : Promise.resolve();
}

function nextId(prefix, counterKey) {
  const db = load();
  db.seq[counterKey] = (db.seq[counterKey] || 0) + 1;
  const n = db.seq[counterKey];
  save(db);
  return `${prefix}${n}`;
}

module.exports = { load, save, nextId, seed, DB_PATH, initStore, flushNow, isSupabase: () => usingSupabase };
