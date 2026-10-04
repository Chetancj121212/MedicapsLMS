export type UserRole =
  | "MASTER_ADMIN"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "DEPARTMENT_ADMIN"
  | "COURSE_INSTRUCTOR"
  | "STUDENT";

export interface User {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
  full_name?: string;
  email?: string;
  department?: string;
  student?: StudentProfile;
}

export interface ManagedAdmin {
  id: number;
  full_name?: string;
  email?: string;
  username: string;
  department?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  full_name: string;
  enrollment_number: string;
  email?: string;
  department: string;
  program?: string;
  semester?: number;
  academic_year?: string;
  created_at: string;
}

export interface CourseListItem {
  id: number;
  course_code: string;
  title: string;
  short_description?: string;
  instructor_name?: string;
  thumbnail?: string;
  estimated_duration?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  module_count: number;
  lecture_count: number;
  quiz_count: number;
}

export interface Lecture {
  id: number;
  module_id: number;
  title: string;
  description?: string;
  video_path?: string;
  video_source_type?: "youtube" | "google_drive" | "local";
  video_source_url?: string;
  video_id?: string;
  thumbnail?: string;
  duration?: number;
  order_index: number;
  completion_threshold: number;
  is_required: boolean;
  is_published: boolean;
}

export interface QuizOption {
  id: number;
  option_text: string;
  order_index: number;
  is_correct?: boolean;
}

export interface Question {
  id: number;
  question_text: string;
  question_type: "MCQ" | "TRUE_FALSE";
  marks: number;
  order_index: number;
  options: QuizOption[];
  explanation?: string;
}

export interface QuizBrief {
  id: number;
  title: string;
  description?: string;
  passing_percentage: number;
  max_attempts?: number;
  randomize_questions: boolean;
  is_required: boolean;
  is_published: boolean;
  is_final_assessment: boolean;
  order_index: number;
  questions?: Question[];
}

export interface Module {
  id: number;
  course_id: number;
  title: string;
  description?: string;
  order_index: number;
  is_required: boolean;
  lectures: Lecture[];
  quizzes: QuizBrief[];
}

export interface CourseDetail {
  id: number;
  course_code: string;
  title: string;
  short_description?: string;
  description?: string;
  instructor_name?: string;
  thumbnail?: string;
  estimated_duration?: string;
  status: string;
  created_at: string;
  modules: Module[];
}

export interface CurriculumItemStatus {
  id: number;
  type: "lecture" | "quiz";
  title: string;
  duration?: number;
  video_path?: string;
  video_source_type?: "youtube" | "google_drive" | "local";
  video_source_url?: string;
  video_id?: string;
  is_locked: boolean;
  is_completed: boolean;
  lock_reason?: string;
  order_index: number;
  completion_threshold?: number;
  passing_percentage?: number;
  max_attempts?: number;
  is_final?: boolean;
  progress?: {
    watched_seconds: number;
    completion_percentage: number;
    last_position_seconds: number;
    watched_segments?: [number, number][];
    unique_watched_seconds?: number;
    active_screen_time_seconds?: number;
    video_play_time_seconds?: number;
    last_activity_at?: string;
  };
}

export interface CurriculumModuleStatus {
  id: number;
  title: string;
  order_index: number;
  is_locked: boolean;
  is_completed: boolean;
  lock_reason?: string;
  items: CurriculumItemStatus[];
}

export interface EligibilityBreakdown {
  eligible: boolean;
  course_completed: boolean;
  lectures: {
    total_required: number;
    completed: number;
    remaining: number;
  };
  module_quizzes: {
    total_required: number;
    passed: number;
    remaining: number;
  };
  final_assessment: {
    total_required: number;
    passed: number;
    remaining: number;
    best_score: number | null;
  };
  missing_requirements: string[];
}

export interface CourseCurriculumStatus {
  enrollment: {
    id: number;
    course_id: number;
    status: "ENROLLED" | "IN_PROGRESS" | "COMPLETED";
    progress_percentage: number;
    enrolled_at: string;
    completed_at?: string;
  };
  modules: CurriculumModuleStatus[];
  final_quizzes: CurriculumItemStatus[];
  total_lectures: number;
  completed_lectures: number;
  current_module?: string;
  current_item?: string;
  certificate?: {
    certificate_number: string;
    issued_at: string;
    is_revoked: boolean;
  };
  eligibility?: EligibilityBreakdown;
}

export interface QuizStudentView {
  id: number;
  title: string;
  description?: string;
  passing_percentage: number;
  max_attempts?: number;
  randomize_questions: boolean;
  is_final_assessment: boolean;
  questions: Question[];
  total_questions: number;
  attempt_count: number;
  has_passed: boolean;
}

export interface QuizSubmissionResult {
  attempt_id: number;
  attempt_number: number;
  score: number;
  total_marks: number;
  percentage: number;
  passed: boolean;
  hint?: string;
}

export interface CertificateInfo {
  certificateNumber: string;
  studentName: string;
  enrollmentNumber?: string;
  courseName: string;
  department?: string;
  institution?: string;
  issuedAt: string;
  revoked: boolean;
  revokedAt?: string;
  downloadUrl?: string;
}

export interface VerificationResponse {
  valid: boolean;
  message?: string;
  certificate?: CertificateInfo;
}

export type Student = StudentProfile;
export type Course = CourseDetail;
export type Quiz = QuizBrief;

export interface Progress {
  watched_seconds: number;
  completion_percentage: number;
  last_position_seconds: number;
  watched_segments?: [number, number][];
  unique_watched_seconds?: number;
  active_screen_time_seconds?: number;
  video_play_time_seconds?: number;
  completion_threshold?: number;
  last_activity_at?: string;
}

export type Certificate = CertificateInfo;
