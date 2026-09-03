export interface UserProfile {
  id: string;
  email: string;
  phone_number?: string;
  full_name?: string;
  state: string;
  school: string;
  department: string;
  level: string;
  semester?: 1 | 2;
  is_pro: boolean;
  avatar_url?: string;
  cover_url?: string;
  is_admin?: boolean;
  payment_status?: 'idle' | 'awaiting_approval' | 'approved';
  payment_plan?: 'monthly' | 'semester';
  payment_amount?: number;
  payment_requested_at?: string;
  used_coupon?: string;
  is_rep?: boolean;
  rep_coupon_code?: string;
  rep_earnings?: number;
  rep_withdrawn?: number;
  rep_bank_name?: string;
  rep_bank_account?: string;
  rep_bank_accounts?: BankAccount[];
  coupon_uses?: number;
  streak?: number;
  last_login_date?: string;
  active_days?: string[];
  ai_credits_used?: Record<string, number>;
  free_chat_used?: number;
  free_topics_unlocked?: string[];
  study_hours_by_date?: Record<string, number>;
  academic_stats_by_date?: Record<string, {
    answered: number;
    right: number;
    coins: number;
    finished_reading: number;
    started_reading: number;
  }>;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name?: string;
}

export interface WithdrawalRequest {
  id?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  bank_name: string;
  account_number: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

export interface Course {
  id: string;
  school: string;
  department: string;
  level: string;
  title: string;
  code: string;
  description: string;
  topics: Topic[];
  thumbnail?: string;
  is_ocw?: boolean;
  curriculum?: string;
  // Curriculum-based fields
  semester?: 1 | 2;
  credit_units?: number;
  program_type?: 'polytechnic' | 'university';
  source?: 'NBTE' | 'CCMAS' | 'custom';
}

export interface Topic {
  id: string;
  course_id: string;
  title: string;
  code?: string; // e.g. "2.1"
  objective?: string;
  keywords?: string[];
  prerequisites?: string[];
  next_topic?: string;
  content?: string;
  chapter?: string; // Lesson title (e.g., "Lesson 2: Algorithms and Flowcharts")
  chapter_order?: number; // Lesson number
  order?: number; // Topic order within lesson
  key_takeaways?: string;
  quiz_questions?: string;
  estimated_minutes?: number;
}

export interface Lesson {
  lessonNumber: number;
  title: string;
  description?: string;
  estimatedTime?: number; // in minutes
  curriculumObjectives?: string[];
  topics: Topic[];
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  color: string;
  tags: string[];
  isLocked: boolean;
  createdAt: any;
  updatedAt: any;
}
