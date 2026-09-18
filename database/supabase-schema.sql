-- ============================================================================
-- Sri Sai PU and Degree College — Supabase / PostgreSQL schema
--
-- Generated from the live data model by:
--   node backend/scripts/generate-supabase-schema.mjs
--
-- Apply it once in the Supabase dashboard: SQL Editor -> New query -> paste
-- -> Run. It is idempotent, so running it again is safe.
--
-- Every record keeps its original id and every field it had. Relationship
-- fields are lifted out of the jsonb into generated, indexed columns so
-- Postgres enforces the foreign keys.
--
-- RLS is enabled with NO policies on every table: only the backend's
-- service-role key can read or write, so no browser can reach this data
-- directly, even with the anon key.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Singletons and counters
-- --------------------------------------------------------------------------
create table if not exists cms_seq (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists cms_singletons (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
-- Holds collegeProfile, settings and the applied-migration list.

-- --------------------------------------------------------------------------
-- Collections
-- --------------------------------------------------------------------------

-- courseLevels (2 records at migration time)
create table if not exists cms_course_levels (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_course_levels_pkey primary key (id)
);

-- streams (2 records at migration time)
create table if not exists cms_streams (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  level_id text generated always as (nullif(data->>'levelId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_streams_pkey primary key (id)
);
create index if not exists cms_streams_level_id_idx on cms_streams (level_id);

-- departments (12 records at migration time)
create table if not exists cms_departments (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_departments_pkey primary key (id)
);

-- classes (5 records at migration time)
create table if not exists cms_classes (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  level_id text generated always as (nullif(data->>'levelId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_classes_pkey primary key (id)
);
create index if not exists cms_classes_level_id_idx on cms_classes (level_id);

-- sections (2 records at migration time)
create table if not exists cms_sections (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_sections_pkey primary key (id)
);

-- academicYears (1 record at migration time)
create table if not exists cms_academic_years (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_academic_years_pkey primary key (id)
);

-- courses (11 records at migration time)
create table if not exists cms_courses (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  level_id text generated always as (nullif(data->>'levelId', '')) stored,
  stream_id text generated always as (nullif(data->>'stream', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_courses_pkey primary key (id)
);
create index if not exists cms_courses_level_id_idx on cms_courses (level_id);
create index if not exists cms_courses_stream_id_idx on cms_courses (stream_id);

-- subjects (24 records at migration time)
create table if not exists cms_subjects (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  department_id text generated always as (nullif(data->>'department', '')) stored,
  course_id text generated always as (nullif(data->>'courseId', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_subjects_pkey primary key (id)
);
create index if not exists cms_subjects_department_id_idx on cms_subjects (department_id);
create index if not exists cms_subjects_course_id_idx on cms_subjects (course_id);
create index if not exists cms_subjects_class_id_idx on cms_subjects (class_id);

-- faculty (35 records at migration time)
create table if not exists cms_faculty (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  department_id text generated always as (nullif(data->>'department', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_faculty_pkey primary key (id)
);
create index if not exists cms_faculty_department_id_idx on cms_faculty (department_id);

-- students (8 records at migration time)
create table if not exists cms_students (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  course_id text generated always as (nullif(data->>'course', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  section_id text generated always as (nullif(data->>'section', '')) stored,
  department_id text generated always as (nullif(data->>'department', '')) stored,
  academic_year_id text generated always as (nullif(data->>'academicYear', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_students_pkey primary key (id)
);
create index if not exists cms_students_course_id_idx on cms_students (course_id);
create index if not exists cms_students_class_id_idx on cms_students (class_id);
create index if not exists cms_students_section_id_idx on cms_students (section_id);
create index if not exists cms_students_department_id_idx on cms_students (department_id);
create index if not exists cms_students_academic_year_id_idx on cms_students (academic_year_id);

-- users (18 records at migration time)
create table if not exists cms_users (
  id bigint generated always as ((data->>'id')::bigint) stored,
  data jsonb not null,
  linked_id text generated always as (nullif(data->>'linkedId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_users_pkey primary key (id)
);
create index if not exists cms_users_linked_id_idx on cms_users (linked_id);

-- teams (8 records at migration time)
create table if not exists cms_teams (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_teams_pkey primary key (id)
);

-- attendance (20 records at migration time)
create table if not exists cms_attendance (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'student', '')) stored,
  subject_id text generated always as (nullif(data->>'subject', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  academic_year_id text generated always as (nullif(data->>'academicYearId', '')) stored,
  attendance_date text generated always as (nullif(data->>'date', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_attendance_pkey primary key (id)
);
create index if not exists cms_attendance_student_id_idx on cms_attendance (student_id);
create index if not exists cms_attendance_subject_id_idx on cms_attendance (subject_id);
create index if not exists cms_attendance_class_id_idx on cms_attendance (class_id);
create index if not exists cms_attendance_academic_year_id_idx on cms_attendance (academic_year_id);
create index if not exists cms_attendance_attendance_date_idx on cms_attendance (attendance_date);

-- exams (0 records at migration time)
create table if not exists cms_exams (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  subject_id text generated always as (nullif(data->>'subject', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_exams_pkey primary key (id)
);
create index if not exists cms_exams_subject_id_idx on cms_exams (subject_id);

-- marks (0 records at migration time)
create table if not exists cms_marks (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'student', '')) stored,
  subject_id text generated always as (nullif(data->>'subject', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_marks_pkey primary key (id)
);
create index if not exists cms_marks_student_id_idx on cms_marks (student_id);
create index if not exists cms_marks_subject_id_idx on cms_marks (subject_id);

-- fees (4 records at migration time)
create table if not exists cms_fees (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'student', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_fees_pkey primary key (id)
);
create index if not exists cms_fees_student_id_idx on cms_fees (student_id);

-- payments (4 records at migration time)
create table if not exists cms_payments (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'student', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_payments_pkey primary key (id)
);
create index if not exists cms_payments_student_id_idx on cms_payments (student_id);

-- timetable (0 records at migration time)
create table if not exists cms_timetable (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  subject_id text generated always as (nullif(data->>'subject', '')) stored,
  faculty_id text generated always as (nullif(data->>'faculty', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_timetable_pkey primary key (id)
);
create index if not exists cms_timetable_class_id_idx on cms_timetable (class_id);
create index if not exists cms_timetable_subject_id_idx on cms_timetable (subject_id);
create index if not exists cms_timetable_faculty_id_idx on cms_timetable (faculty_id);

-- assignments (0 records at migration time)
create table if not exists cms_assignments (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_by text generated always as (nullif(data->>'createdBy', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_assignments_pkey primary key (id)
);
create index if not exists cms_assignments_created_by_idx on cms_assignments (created_by);

-- notices (1 record at migration time)
create table if not exists cms_notices (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_notices_pkey primary key (id)
);

-- admissionInquiries (0 records at migration time)
create table if not exists cms_admission_inquiries (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_admission_inquiries_pkey primary key (id)
);

-- sportsAchievements (6 records at migration time)
create table if not exists cms_sports_achievements (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_sports_achievements_pkey primary key (id)
);

-- academicMerit (22 records at migration time)
create table if not exists cms_academic_merit (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_academic_merit_pkey primary key (id)
);

-- enrollments (7 records at migration time)
create table if not exists cms_enrollments (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  academic_year_id text generated always as (nullif(data->>'academicYearId', '')) stored,
  course_id text generated always as (nullif(data->>'courseId', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_enrollments_pkey primary key (id)
);
create index if not exists cms_enrollments_student_id_idx on cms_enrollments (student_id);
create index if not exists cms_enrollments_academic_year_id_idx on cms_enrollments (academic_year_id);
create index if not exists cms_enrollments_course_id_idx on cms_enrollments (course_id);
create index if not exists cms_enrollments_class_id_idx on cms_enrollments (class_id);

-- announcements (0 records at migration time)
create table if not exists cms_announcements (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_announcements_pkey primary key (id)
);

-- notifications (85 records at migration time)
create table if not exists cms_notifications (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  user_id text generated always as (nullif(data->>'userId', '')) stored,
  is_read text generated always as (nullif(data->>'read', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_notifications_pkey primary key (id)
);
create index if not exists cms_notifications_user_id_idx on cms_notifications (user_id);
create index if not exists cms_notifications_is_read_idx on cms_notifications (is_read);

-- auditLogs (84 records at migration time)
create table if not exists cms_audit_logs (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  actor_id text generated always as (nullif(data->>'actorId', '')) stored,
  entity_type text generated always as (nullif(data->>'entityType', '')) stored,
  occurred_at text generated always as (nullif(data->>'at', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_audit_logs_pkey primary key (id)
);
create index if not exists cms_audit_logs_actor_id_idx on cms_audit_logs (actor_id);
create index if not exists cms_audit_logs_entity_type_idx on cms_audit_logs (entity_type);
create index if not exists cms_audit_logs_occurred_at_idx on cms_audit_logs (occurred_at);

-- documents (2 records at migration time)
create table if not exists cms_documents (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  owner_id text generated always as (nullif(data->>'ownerId', '')) stored,
  owner_type text generated always as (nullif(data->>'ownerType', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_documents_pkey primary key (id)
);
create index if not exists cms_documents_owner_id_idx on cms_documents (owner_id);
create index if not exists cms_documents_owner_type_idx on cms_documents (owner_type);

-- facultyAssignments (14 records at migration time)
create table if not exists cms_faculty_assignments (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  faculty_id text generated always as (nullif(data->>'facultyId', '')) stored,
  subject_id text generated always as (nullif(data->>'subjectId', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_faculty_assignments_pkey primary key (id)
);
create index if not exists cms_faculty_assignments_faculty_id_idx on cms_faculty_assignments (faculty_id);
create index if not exists cms_faculty_assignments_subject_id_idx on cms_faculty_assignments (subject_id);
create index if not exists cms_faculty_assignments_class_id_idx on cms_faculty_assignments (class_id);

-- timetablePublications (0 records at migration time)
create table if not exists cms_timetable_publications (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_timetable_publications_pkey primary key (id)
);
create index if not exists cms_timetable_publications_class_id_idx on cms_timetable_publications (class_id);

-- classTeachers (4 records at migration time)
create table if not exists cms_class_teachers (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  faculty_id text generated always as (nullif(data->>'facultyId', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_class_teachers_pkey primary key (id)
);
create index if not exists cms_class_teachers_faculty_id_idx on cms_class_teachers (faculty_id);
create index if not exists cms_class_teachers_class_id_idx on cms_class_teachers (class_id);

-- notes (1 record at migration time)
create table if not exists cms_notes (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  subject_id text generated always as (nullif(data->>'subjectId', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  uploaded_by text generated always as (nullif(data->>'uploadedBy', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_notes_pkey primary key (id)
);
create index if not exists cms_notes_subject_id_idx on cms_notes (subject_id);
create index if not exists cms_notes_class_id_idx on cms_notes (class_id);
create index if not exists cms_notes_uploaded_by_idx on cms_notes (uploaded_by);

-- internalMarks (12 records at migration time)
create table if not exists cms_internal_marks (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  subject_id text generated always as (nullif(data->>'subjectId', '')) stored,
  exam_id text generated always as (nullif(data->>'examId', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  status text generated always as (nullif(data->>'status', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_internal_marks_pkey primary key (id)
);
create index if not exists cms_internal_marks_student_id_idx on cms_internal_marks (student_id);
create index if not exists cms_internal_marks_subject_id_idx on cms_internal_marks (subject_id);
create index if not exists cms_internal_marks_exam_id_idx on cms_internal_marks (exam_id);
create index if not exists cms_internal_marks_class_id_idx on cms_internal_marks (class_id);
create index if not exists cms_internal_marks_status_idx on cms_internal_marks (status);

-- leaveRequests (2 records at migration time)
create table if not exists cms_leave_requests (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  class_teacher_id text generated always as (nullif(data->>'classTeacherId', '')) stored,
  status text generated always as (nullif(data->>'status', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_leave_requests_pkey primary key (id)
);
create index if not exists cms_leave_requests_student_id_idx on cms_leave_requests (student_id);
create index if not exists cms_leave_requests_class_teacher_id_idx on cms_leave_requests (class_teacher_id);
create index if not exists cms_leave_requests_status_idx on cms_leave_requests (status);

-- callFollowups (1 record at migration time)
create table if not exists cms_call_followups (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  caller_user_id text generated always as (nullif(data->>'callerUserId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_call_followups_pkey primary key (id)
);
create index if not exists cms_call_followups_student_id_idx on cms_call_followups (student_id);
create index if not exists cms_call_followups_caller_user_id_idx on cms_call_followups (caller_user_id);

-- internalExams (0 records at migration time)
create table if not exists cms_internal_exams (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  academic_year_id text generated always as (nullif(data->>'academicYearId', '')) stored,
  class_id text generated always as (nullif(data->>'classId', '')) stored,
  course_id text generated always as (nullif(data->>'courseId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_internal_exams_pkey primary key (id)
);
create index if not exists cms_internal_exams_academic_year_id_idx on cms_internal_exams (academic_year_id);
create index if not exists cms_internal_exams_class_id_idx on cms_internal_exams (class_id);
create index if not exists cms_internal_exams_course_id_idx on cms_internal_exams (course_id);

-- internalMarkHistory (0 records at migration time)
create table if not exists cms_internal_mark_history (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  mark_id text generated always as (nullif(data->>'markId', '')) stored,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  exam_id text generated always as (nullif(data->>'examId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_internal_mark_history_pkey primary key (id)
);
create index if not exists cms_internal_mark_history_mark_id_idx on cms_internal_mark_history (mark_id);
create index if not exists cms_internal_mark_history_student_id_idx on cms_internal_mark_history (student_id);
create index if not exists cms_internal_mark_history_exam_id_idx on cms_internal_mark_history (exam_id);

-- attendanceHistory (0 records at migration time)
create table if not exists cms_attendance_history (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'student', '')) stored,
  subject_id text generated always as (nullif(data->>'subject', '')) stored,
  attendance_id text generated always as (nullif(data->>'attendanceId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_attendance_history_pkey primary key (id)
);
create index if not exists cms_attendance_history_student_id_idx on cms_attendance_history (student_id);
create index if not exists cms_attendance_history_subject_id_idx on cms_attendance_history (subject_id);
create index if not exists cms_attendance_history_attendance_id_idx on cms_attendance_history (attendance_id);

-- attendanceAlerts (0 records at migration time)
create table if not exists cms_attendance_alerts (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_attendance_alerts_pkey primary key (id)
);
create index if not exists cms_attendance_alerts_student_id_idx on cms_attendance_alerts (student_id);

-- feeInstallments (12 records at migration time)
create table if not exists cms_fee_installments (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_fee_installments_pkey primary key (id)
);
create index if not exists cms_fee_installments_student_id_idx on cms_fee_installments (student_id);

-- receipts (4 records at migration time)
create table if not exists cms_receipts (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  student_id text generated always as (nullif(data->>'studentId', '')) stored,
  payment_id text generated always as (nullif(data->>'paymentId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_receipts_pkey primary key (id)
);
create index if not exists cms_receipts_student_id_idx on cms_receipts (student_id);
create index if not exists cms_receipts_payment_id_idx on cms_receipts (payment_id);

-- galleryItems (1 record at migration time)
create table if not exists cms_gallery_items (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_gallery_items_pkey primary key (id)
);

-- teamMembers (0 records at migration time)
create table if not exists cms_team_members (
  id text generated always as (data->>'id') stored,
  data jsonb not null,
  team_id text generated always as (nullif(data->>'team', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_team_members_pkey primary key (id)
);
create index if not exists cms_team_members_team_id_idx on cms_team_members (team_id);

-- Login sessions are keyed by their JWT id (jti), not an `id` field.
create table if not exists cms_auth_sessions (
  jti text generated always as (data->>'jti') stored,
  data jsonb not null,
  user_id text generated always as (nullif(data->>'userId', '')) stored,
  created_at timestamptz not null default now(),
  constraint cms_auth_sessions_pkey primary key (jti)
);
create index if not exists cms_auth_sessions_user_id_idx on cms_auth_sessions (user_id);

-- --------------------------------------------------------------------------
-- Foreign keys
--
-- Added NOT VALID so existing rows migrate even if a legacy record points
-- at something that was deleted long ago. Run `validate constraint` later
-- once you have reviewed any such rows.
--
-- The referential action is NO ACTION (the default) because these columns
-- are GENERATED from the jsonb: Postgres refuses CASCADE / SET NULL on a
-- column it cannot write to. Deletes are handled by the application, which
-- already clears dependent records (see routes/students.js).
-- --------------------------------------------------------------------------

alter table cms_streams drop constraint if exists cms_streams_level_id_fkey;
alter table cms_streams add constraint cms_streams_level_id_fkey
  foreign key (level_id) references cms_course_levels(id) not valid;

alter table cms_classes drop constraint if exists cms_classes_level_id_fkey;
alter table cms_classes add constraint cms_classes_level_id_fkey
  foreign key (level_id) references cms_course_levels(id) not valid;

alter table cms_courses drop constraint if exists cms_courses_level_id_fkey;
alter table cms_courses add constraint cms_courses_level_id_fkey
  foreign key (level_id) references cms_course_levels(id) not valid;

alter table cms_courses drop constraint if exists cms_courses_stream_id_fkey;
alter table cms_courses add constraint cms_courses_stream_id_fkey
  foreign key (stream_id) references cms_streams(id) not valid;

alter table cms_subjects drop constraint if exists cms_subjects_department_id_fkey;
alter table cms_subjects add constraint cms_subjects_department_id_fkey
  foreign key (department_id) references cms_departments(id) not valid;

alter table cms_subjects drop constraint if exists cms_subjects_course_id_fkey;
alter table cms_subjects add constraint cms_subjects_course_id_fkey
  foreign key (course_id) references cms_courses(id) not valid;

alter table cms_subjects drop constraint if exists cms_subjects_class_id_fkey;
alter table cms_subjects add constraint cms_subjects_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_faculty drop constraint if exists cms_faculty_department_id_fkey;
alter table cms_faculty add constraint cms_faculty_department_id_fkey
  foreign key (department_id) references cms_departments(id) not valid;

alter table cms_students drop constraint if exists cms_students_course_id_fkey;
alter table cms_students add constraint cms_students_course_id_fkey
  foreign key (course_id) references cms_courses(id) not valid;

alter table cms_students drop constraint if exists cms_students_class_id_fkey;
alter table cms_students add constraint cms_students_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_students drop constraint if exists cms_students_section_id_fkey;
alter table cms_students add constraint cms_students_section_id_fkey
  foreign key (section_id) references cms_sections(id) not valid;

alter table cms_students drop constraint if exists cms_students_department_id_fkey;
alter table cms_students add constraint cms_students_department_id_fkey
  foreign key (department_id) references cms_departments(id) not valid;

alter table cms_students drop constraint if exists cms_students_academic_year_id_fkey;
alter table cms_students add constraint cms_students_academic_year_id_fkey
  foreign key (academic_year_id) references cms_academic_years(id) not valid;

alter table cms_attendance drop constraint if exists cms_attendance_student_id_fkey;
alter table cms_attendance add constraint cms_attendance_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_attendance drop constraint if exists cms_attendance_subject_id_fkey;
alter table cms_attendance add constraint cms_attendance_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_attendance drop constraint if exists cms_attendance_class_id_fkey;
alter table cms_attendance add constraint cms_attendance_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_attendance drop constraint if exists cms_attendance_academic_year_id_fkey;
alter table cms_attendance add constraint cms_attendance_academic_year_id_fkey
  foreign key (academic_year_id) references cms_academic_years(id) not valid;

alter table cms_exams drop constraint if exists cms_exams_subject_id_fkey;
alter table cms_exams add constraint cms_exams_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_marks drop constraint if exists cms_marks_student_id_fkey;
alter table cms_marks add constraint cms_marks_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_marks drop constraint if exists cms_marks_subject_id_fkey;
alter table cms_marks add constraint cms_marks_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_fees drop constraint if exists cms_fees_student_id_fkey;
alter table cms_fees add constraint cms_fees_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_payments drop constraint if exists cms_payments_student_id_fkey;
alter table cms_payments add constraint cms_payments_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_timetable drop constraint if exists cms_timetable_class_id_fkey;
alter table cms_timetable add constraint cms_timetable_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_timetable drop constraint if exists cms_timetable_subject_id_fkey;
alter table cms_timetable add constraint cms_timetable_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_timetable drop constraint if exists cms_timetable_faculty_id_fkey;
alter table cms_timetable add constraint cms_timetable_faculty_id_fkey
  foreign key (faculty_id) references cms_faculty(id) not valid;

alter table cms_enrollments drop constraint if exists cms_enrollments_student_id_fkey;
alter table cms_enrollments add constraint cms_enrollments_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_enrollments drop constraint if exists cms_enrollments_academic_year_id_fkey;
alter table cms_enrollments add constraint cms_enrollments_academic_year_id_fkey
  foreign key (academic_year_id) references cms_academic_years(id) not valid;

alter table cms_enrollments drop constraint if exists cms_enrollments_course_id_fkey;
alter table cms_enrollments add constraint cms_enrollments_course_id_fkey
  foreign key (course_id) references cms_courses(id) not valid;

alter table cms_enrollments drop constraint if exists cms_enrollments_class_id_fkey;
alter table cms_enrollments add constraint cms_enrollments_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_faculty_assignments drop constraint if exists cms_faculty_assignments_faculty_id_fkey;
alter table cms_faculty_assignments add constraint cms_faculty_assignments_faculty_id_fkey
  foreign key (faculty_id) references cms_faculty(id) not valid;

alter table cms_faculty_assignments drop constraint if exists cms_faculty_assignments_subject_id_fkey;
alter table cms_faculty_assignments add constraint cms_faculty_assignments_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_faculty_assignments drop constraint if exists cms_faculty_assignments_class_id_fkey;
alter table cms_faculty_assignments add constraint cms_faculty_assignments_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_timetable_publications drop constraint if exists cms_timetable_publications_class_id_fkey;
alter table cms_timetable_publications add constraint cms_timetable_publications_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_class_teachers drop constraint if exists cms_class_teachers_faculty_id_fkey;
alter table cms_class_teachers add constraint cms_class_teachers_faculty_id_fkey
  foreign key (faculty_id) references cms_faculty(id) not valid;

alter table cms_class_teachers drop constraint if exists cms_class_teachers_class_id_fkey;
alter table cms_class_teachers add constraint cms_class_teachers_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_notes drop constraint if exists cms_notes_subject_id_fkey;
alter table cms_notes add constraint cms_notes_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_notes drop constraint if exists cms_notes_class_id_fkey;
alter table cms_notes add constraint cms_notes_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_internal_marks drop constraint if exists cms_internal_marks_student_id_fkey;
alter table cms_internal_marks add constraint cms_internal_marks_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_internal_marks drop constraint if exists cms_internal_marks_subject_id_fkey;
alter table cms_internal_marks add constraint cms_internal_marks_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_internal_marks drop constraint if exists cms_internal_marks_exam_id_fkey;
alter table cms_internal_marks add constraint cms_internal_marks_exam_id_fkey
  foreign key (exam_id) references cms_internal_exams(id) not valid;

alter table cms_internal_marks drop constraint if exists cms_internal_marks_class_id_fkey;
alter table cms_internal_marks add constraint cms_internal_marks_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_leave_requests drop constraint if exists cms_leave_requests_student_id_fkey;
alter table cms_leave_requests add constraint cms_leave_requests_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_leave_requests drop constraint if exists cms_leave_requests_class_teacher_id_fkey;
alter table cms_leave_requests add constraint cms_leave_requests_class_teacher_id_fkey
  foreign key (class_teacher_id) references cms_faculty(id) not valid;

alter table cms_call_followups drop constraint if exists cms_call_followups_student_id_fkey;
alter table cms_call_followups add constraint cms_call_followups_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_internal_exams drop constraint if exists cms_internal_exams_academic_year_id_fkey;
alter table cms_internal_exams add constraint cms_internal_exams_academic_year_id_fkey
  foreign key (academic_year_id) references cms_academic_years(id) not valid;

alter table cms_internal_exams drop constraint if exists cms_internal_exams_class_id_fkey;
alter table cms_internal_exams add constraint cms_internal_exams_class_id_fkey
  foreign key (class_id) references cms_classes(id) not valid;

alter table cms_internal_exams drop constraint if exists cms_internal_exams_course_id_fkey;
alter table cms_internal_exams add constraint cms_internal_exams_course_id_fkey
  foreign key (course_id) references cms_courses(id) not valid;

alter table cms_internal_mark_history drop constraint if exists cms_internal_mark_history_student_id_fkey;
alter table cms_internal_mark_history add constraint cms_internal_mark_history_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_internal_mark_history drop constraint if exists cms_internal_mark_history_exam_id_fkey;
alter table cms_internal_mark_history add constraint cms_internal_mark_history_exam_id_fkey
  foreign key (exam_id) references cms_internal_exams(id) not valid;

alter table cms_attendance_history drop constraint if exists cms_attendance_history_student_id_fkey;
alter table cms_attendance_history add constraint cms_attendance_history_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_attendance_history drop constraint if exists cms_attendance_history_subject_id_fkey;
alter table cms_attendance_history add constraint cms_attendance_history_subject_id_fkey
  foreign key (subject_id) references cms_subjects(id) not valid;

alter table cms_attendance_alerts drop constraint if exists cms_attendance_alerts_student_id_fkey;
alter table cms_attendance_alerts add constraint cms_attendance_alerts_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_fee_installments drop constraint if exists cms_fee_installments_student_id_fkey;
alter table cms_fee_installments add constraint cms_fee_installments_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_receipts drop constraint if exists cms_receipts_student_id_fkey;
alter table cms_receipts add constraint cms_receipts_student_id_fkey
  foreign key (student_id) references cms_students(id) not valid;

alter table cms_team_members drop constraint if exists cms_team_members_team_id_fkey;
alter table cms_team_members add constraint cms_team_members_team_id_fkey
  foreign key (team_id) references cms_teams(id) not valid;

-- --------------------------------------------------------------------------
-- Row Level Security: deny everything except the service-role key
-- --------------------------------------------------------------------------
alter table cms_seq enable row level security;
alter table cms_singletons enable row level security;
alter table cms_auth_sessions enable row level security;
alter table cms_course_levels enable row level security;
alter table cms_streams enable row level security;
alter table cms_departments enable row level security;
alter table cms_classes enable row level security;
alter table cms_sections enable row level security;
alter table cms_academic_years enable row level security;
alter table cms_courses enable row level security;
alter table cms_subjects enable row level security;
alter table cms_faculty enable row level security;
alter table cms_students enable row level security;
alter table cms_users enable row level security;
alter table cms_teams enable row level security;
alter table cms_attendance enable row level security;
alter table cms_exams enable row level security;
alter table cms_marks enable row level security;
alter table cms_fees enable row level security;
alter table cms_payments enable row level security;
alter table cms_timetable enable row level security;
alter table cms_assignments enable row level security;
alter table cms_notices enable row level security;
alter table cms_admission_inquiries enable row level security;
alter table cms_sports_achievements enable row level security;
alter table cms_academic_merit enable row level security;
alter table cms_enrollments enable row level security;
alter table cms_announcements enable row level security;
alter table cms_notifications enable row level security;
alter table cms_audit_logs enable row level security;
alter table cms_documents enable row level security;
alter table cms_faculty_assignments enable row level security;
alter table cms_timetable_publications enable row level security;
alter table cms_class_teachers enable row level security;
alter table cms_notes enable row level security;
alter table cms_internal_marks enable row level security;
alter table cms_leave_requests enable row level security;
alter table cms_call_followups enable row level security;
alter table cms_internal_exams enable row level security;
alter table cms_internal_mark_history enable row level security;
alter table cms_attendance_history enable row level security;
alter table cms_attendance_alerts enable row level security;
alter table cms_fee_installments enable row level security;
alter table cms_receipts enable row level security;
alter table cms_gallery_items enable row level security;
alter table cms_team_members enable row level security;

-- --------------------------------------------------------------------------
-- Keep updated_at honest
-- --------------------------------------------------------------------------
create or replace function cms_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
drop trigger if exists cms_seq_touch on cms_seq;
create trigger cms_seq_touch before update on cms_seq for each row execute function cms_touch_updated_at();
drop trigger if exists cms_singletons_touch on cms_singletons;
create trigger cms_singletons_touch before update on cms_singletons for each row execute function cms_touch_updated_at();
drop trigger if exists cms_course_levels_touch on cms_course_levels;
create trigger cms_course_levels_touch before update on cms_course_levels for each row execute function cms_touch_updated_at();
drop trigger if exists cms_streams_touch on cms_streams;
create trigger cms_streams_touch before update on cms_streams for each row execute function cms_touch_updated_at();
drop trigger if exists cms_departments_touch on cms_departments;
create trigger cms_departments_touch before update on cms_departments for each row execute function cms_touch_updated_at();
drop trigger if exists cms_classes_touch on cms_classes;
create trigger cms_classes_touch before update on cms_classes for each row execute function cms_touch_updated_at();
drop trigger if exists cms_sections_touch on cms_sections;
create trigger cms_sections_touch before update on cms_sections for each row execute function cms_touch_updated_at();
drop trigger if exists cms_academic_years_touch on cms_academic_years;
create trigger cms_academic_years_touch before update on cms_academic_years for each row execute function cms_touch_updated_at();
drop trigger if exists cms_courses_touch on cms_courses;
create trigger cms_courses_touch before update on cms_courses for each row execute function cms_touch_updated_at();
drop trigger if exists cms_subjects_touch on cms_subjects;
create trigger cms_subjects_touch before update on cms_subjects for each row execute function cms_touch_updated_at();
drop trigger if exists cms_faculty_touch on cms_faculty;
create trigger cms_faculty_touch before update on cms_faculty for each row execute function cms_touch_updated_at();
drop trigger if exists cms_students_touch on cms_students;
create trigger cms_students_touch before update on cms_students for each row execute function cms_touch_updated_at();
drop trigger if exists cms_users_touch on cms_users;
create trigger cms_users_touch before update on cms_users for each row execute function cms_touch_updated_at();
drop trigger if exists cms_teams_touch on cms_teams;
create trigger cms_teams_touch before update on cms_teams for each row execute function cms_touch_updated_at();
drop trigger if exists cms_attendance_touch on cms_attendance;
create trigger cms_attendance_touch before update on cms_attendance for each row execute function cms_touch_updated_at();
drop trigger if exists cms_exams_touch on cms_exams;
create trigger cms_exams_touch before update on cms_exams for each row execute function cms_touch_updated_at();
drop trigger if exists cms_marks_touch on cms_marks;
create trigger cms_marks_touch before update on cms_marks for each row execute function cms_touch_updated_at();
drop trigger if exists cms_fees_touch on cms_fees;
create trigger cms_fees_touch before update on cms_fees for each row execute function cms_touch_updated_at();
drop trigger if exists cms_payments_touch on cms_payments;
create trigger cms_payments_touch before update on cms_payments for each row execute function cms_touch_updated_at();
drop trigger if exists cms_timetable_touch on cms_timetable;
create trigger cms_timetable_touch before update on cms_timetable for each row execute function cms_touch_updated_at();
drop trigger if exists cms_assignments_touch on cms_assignments;
create trigger cms_assignments_touch before update on cms_assignments for each row execute function cms_touch_updated_at();
drop trigger if exists cms_notices_touch on cms_notices;
create trigger cms_notices_touch before update on cms_notices for each row execute function cms_touch_updated_at();
drop trigger if exists cms_admission_inquiries_touch on cms_admission_inquiries;
create trigger cms_admission_inquiries_touch before update on cms_admission_inquiries for each row execute function cms_touch_updated_at();
drop trigger if exists cms_sports_achievements_touch on cms_sports_achievements;
create trigger cms_sports_achievements_touch before update on cms_sports_achievements for each row execute function cms_touch_updated_at();
drop trigger if exists cms_academic_merit_touch on cms_academic_merit;
create trigger cms_academic_merit_touch before update on cms_academic_merit for each row execute function cms_touch_updated_at();
drop trigger if exists cms_enrollments_touch on cms_enrollments;
create trigger cms_enrollments_touch before update on cms_enrollments for each row execute function cms_touch_updated_at();
drop trigger if exists cms_announcements_touch on cms_announcements;
create trigger cms_announcements_touch before update on cms_announcements for each row execute function cms_touch_updated_at();
drop trigger if exists cms_notifications_touch on cms_notifications;
create trigger cms_notifications_touch before update on cms_notifications for each row execute function cms_touch_updated_at();
drop trigger if exists cms_audit_logs_touch on cms_audit_logs;
create trigger cms_audit_logs_touch before update on cms_audit_logs for each row execute function cms_touch_updated_at();
drop trigger if exists cms_documents_touch on cms_documents;
create trigger cms_documents_touch before update on cms_documents for each row execute function cms_touch_updated_at();
drop trigger if exists cms_faculty_assignments_touch on cms_faculty_assignments;
create trigger cms_faculty_assignments_touch before update on cms_faculty_assignments for each row execute function cms_touch_updated_at();
drop trigger if exists cms_timetable_publications_touch on cms_timetable_publications;
create trigger cms_timetable_publications_touch before update on cms_timetable_publications for each row execute function cms_touch_updated_at();
drop trigger if exists cms_class_teachers_touch on cms_class_teachers;
create trigger cms_class_teachers_touch before update on cms_class_teachers for each row execute function cms_touch_updated_at();
drop trigger if exists cms_notes_touch on cms_notes;
create trigger cms_notes_touch before update on cms_notes for each row execute function cms_touch_updated_at();
drop trigger if exists cms_internal_marks_touch on cms_internal_marks;
create trigger cms_internal_marks_touch before update on cms_internal_marks for each row execute function cms_touch_updated_at();
drop trigger if exists cms_leave_requests_touch on cms_leave_requests;
create trigger cms_leave_requests_touch before update on cms_leave_requests for each row execute function cms_touch_updated_at();
drop trigger if exists cms_call_followups_touch on cms_call_followups;
create trigger cms_call_followups_touch before update on cms_call_followups for each row execute function cms_touch_updated_at();
drop trigger if exists cms_internal_exams_touch on cms_internal_exams;
create trigger cms_internal_exams_touch before update on cms_internal_exams for each row execute function cms_touch_updated_at();
drop trigger if exists cms_internal_mark_history_touch on cms_internal_mark_history;
create trigger cms_internal_mark_history_touch before update on cms_internal_mark_history for each row execute function cms_touch_updated_at();
drop trigger if exists cms_attendance_history_touch on cms_attendance_history;
create trigger cms_attendance_history_touch before update on cms_attendance_history for each row execute function cms_touch_updated_at();
drop trigger if exists cms_attendance_alerts_touch on cms_attendance_alerts;
create trigger cms_attendance_alerts_touch before update on cms_attendance_alerts for each row execute function cms_touch_updated_at();
drop trigger if exists cms_fee_installments_touch on cms_fee_installments;
create trigger cms_fee_installments_touch before update on cms_fee_installments for each row execute function cms_touch_updated_at();
drop trigger if exists cms_receipts_touch on cms_receipts;
create trigger cms_receipts_touch before update on cms_receipts for each row execute function cms_touch_updated_at();
drop trigger if exists cms_gallery_items_touch on cms_gallery_items;
create trigger cms_gallery_items_touch before update on cms_gallery_items for each row execute function cms_touch_updated_at();
drop trigger if exists cms_team_members_touch on cms_team_members;
create trigger cms_team_members_touch before update on cms_team_members for each row execute function cms_touch_updated_at();
